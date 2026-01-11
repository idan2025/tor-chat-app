use crate::error::{AppError, Result};
use crate::models::User;
use crate::services::AuthService;
use crate::state::AppState;
use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Clone)]
pub struct AuthUser {
    pub user_id: Uuid,
    pub user: User,
}

pub async fn auth_middleware(
    State(state): State<Arc<AppState>>,
    mut req: Request,
    next: Next,
) -> Result<Response> {
    // Extract token from Authorization header
    let token = req
        .headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
        .ok_or_else(|| AppError::Authentication("Missing authorization token".to_string()))?;

    // Verify token
    let auth_service = AuthService::new(state.config.clone());
    let user_id = auth_service.verify_token(token)?;

    // Get user from database
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::Authentication("User not found".to_string()))?;

    // Check if user is banned
    if user.is_banned {
        return Err(AppError::Authorization(
            "Your account has been banned".to_string(),
        ));
    }

    // Store auth user in request extensions
    req.extensions_mut().insert(AuthUser {
        user_id,
        user: user.clone(),
    });

    Ok(next.run(req).await)
}

pub async fn admin_middleware(
    mut req: Request,
    next: Next,
) -> Result<Response> {
    // Get authenticated user from extensions
    let auth_user = req
        .extensions()
        .get::<AuthUser>()
        .ok_or_else(|| AppError::Authentication("Not authenticated".to_string()))?;

    // Check if user is admin
    if !auth_user.user.is_admin {
        return Err(AppError::Authorization(
            "Admin access required".to_string(),
        ));
    }

    Ok(next.run(req).await)
}
