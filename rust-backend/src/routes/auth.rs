use crate::error::{AppError, Result};
use crate::middleware::{AuthUser, ValidatedJson};
use crate::models::{AuthResponse, LoginRequest, RegisterRequest, User, UserResponse};
use crate::services::{AuthService, CryptoService};
use crate::state::AppState;
use axum::{extract::State, Extension, Json};
use std::sync::Arc;

pub async fn register(
    State(state): State<Arc<AppState>>,
    ValidatedJson(req): ValidatedJson<RegisterRequest>,
) -> Result<Json<AuthResponse>> {
    let auth_service = AuthService::new(state.config.clone());
    let crypto_service = CryptoService::new();

    // Check if username already exists
    let existing =
        sqlx::query_as::<_, User>("SELECT * FROM users WHERE username = $1 OR email = $2")
            .bind(&req.username)
            .bind(&req.email)
            .fetch_optional(&state.db)
            .await?;

    if existing.is_some() {
        return Err(AppError::Conflict(
            "Username or email already exists".to_string(),
        ));
    }

    // Check if this is the first user
    let user_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(&state.db)
        .await?;
    let is_first_user = user_count == 0;

    // Generate keypair
    let (public_key, _private_key) = crypto_service.generate_keypair()?;

    // Hash password
    let password_hash = auth_service.hash_password(&req.password)?;

    // Create user
    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (username, email, password_hash, public_key, display_name, is_admin)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *",
    )
    .bind(&req.username)
    .bind(&req.email)
    .bind(&password_hash)
    .bind(&public_key)
    .bind(req.display_name.as_ref().unwrap_or(&req.username))
    .bind(is_first_user)
    .fetch_one(&state.db)
    .await?;

    // Generate token
    let token = auth_service.generate_token(user.id)?;

    if is_first_user {
        tracing::info!("First user registered as ADMIN: {}", user.username);
    } else {
        tracing::info!("New user registered: {}", user.username);
    }

    Ok(Json(AuthResponse {
        message: "User registered successfully".to_string(),
        token,
        user: user.into(),
    }))
}

pub async fn login(
    State(state): State<Arc<AppState>>,
    ValidatedJson(req): ValidatedJson<LoginRequest>,
) -> Result<Json<AuthResponse>> {
    let auth_service = AuthService::new(state.config.clone());

    // Find user
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE username = $1")
        .bind(&req.username)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::Authentication("Invalid credentials".to_string()))?;

    // Verify password
    let valid = auth_service.verify_password(&req.password, &user.password_hash)?;
    if !valid {
        return Err(AppError::Authentication("Invalid credentials".to_string()));
    }

    // Check if banned
    if user.is_banned {
        return Err(AppError::Authorization(
            "Your account has been banned. Please contact an administrator.".to_string(),
        ));
    }

    // Update last seen
    sqlx::query("UPDATE users SET last_seen = NOW() WHERE id = $1")
        .bind(user.id)
        .execute(&state.db)
        .await?;

    // Generate token
    let token = auth_service.generate_token(user.id)?;

    tracing::info!("User logged in: {}", user.username);

    Ok(Json(AuthResponse {
        message: "Login successful".to_string(),
        token,
        user: user.into(),
    }))
}

pub async fn logout(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<serde_json::Value>> {
    sqlx::query("UPDATE users SET is_online = false, last_seen = NOW() WHERE id = $1")
        .bind(auth.user_id)
        .execute(&state.db)
        .await?;

    Ok(Json(
        serde_json::json!({ "message": "Logged out successfully" }),
    ))
}

pub async fn me(Extension(auth): Extension<AuthUser>) -> Result<Json<serde_json::Value>> {
    Ok(Json(
        serde_json::json!({ "user": UserResponse::from(auth.user) }),
    ))
}

pub async fn list_users(State(state): State<Arc<AppState>>) -> Result<Json<serde_json::Value>> {
    let users = sqlx::query_as::<_, User>(
        "SELECT id, username, email, password_hash, public_key, display_name, avatar,
         is_online, last_seen, is_admin, is_banned, created_at
         FROM users ORDER BY username ASC",
    )
    .fetch_all(&state.db)
    .await?;

    let user_responses: Vec<UserResponse> = users.into_iter().map(|u| u.into()).collect();

    Ok(Json(serde_json::json!({ "users": user_responses })))
}
