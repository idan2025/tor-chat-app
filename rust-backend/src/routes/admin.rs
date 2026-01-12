use crate::error::{AppError, Result};
use crate::middleware::AuthUser;
use crate::models::{Room, RoomResponse, User, UserResponse};
use crate::state::AppState;
use axum::{
    extract::{Path, State},
    Extension, Json,
};
use std::sync::Arc;
use uuid::Uuid;

// Middleware helper to check admin status
fn check_admin(auth: &AuthUser) -> Result<()> {
    if !auth.user.is_admin {
        return Err(AppError::Authorization("Admin access required".to_string()));
    }
    Ok(())
}

// GET /api/admin/users - List all users
pub async fn list_users(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<serde_json::Value>> {
    check_admin(&auth)?;

    let users = sqlx::query_as::<_, User>("SELECT * FROM users ORDER BY created_at DESC")
        .fetch_all(&state.db)
        .await?;

    let user_responses: Vec<UserResponse> = users.into_iter().map(|u| u.into()).collect();

    Ok(Json(serde_json::json!({ "users": user_responses })))
}

// POST /api/admin/users/:id/promote - Promote user to admin
pub async fn promote_user(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthUser>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    check_admin(&auth)?;

    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    if user.is_admin {
        return Err(AppError::BadRequest("User is already an admin".to_string()));
    }

    sqlx::query("UPDATE users SET is_admin = true WHERE id = $1")
        .bind(user_id)
        .execute(&state.db)
        .await?;

    tracing::info!(
        "User {} promoted to admin by {}",
        user.username,
        auth.user.username
    );

    Ok(Json(serde_json::json!({
        "message": "User promoted to admin successfully"
    })))
}

// POST /api/admin/users/:id/demote - Demote admin to regular user
pub async fn demote_user(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthUser>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    check_admin(&auth)?;

    // Can't demote yourself
    if user_id == auth.user_id {
        return Err(AppError::BadRequest("Cannot demote yourself".to_string()));
    }

    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    if !user.is_admin {
        return Err(AppError::BadRequest("User is not an admin".to_string()));
    }

    // Check if this is the last admin
    let admin_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE is_admin = true")
        .fetch_one(&state.db)
        .await?;

    if admin_count <= 1 {
        return Err(AppError::BadRequest(
            "Cannot demote the last admin".to_string(),
        ));
    }

    sqlx::query("UPDATE users SET is_admin = false WHERE id = $1")
        .bind(user_id)
        .execute(&state.db)
        .await?;

    tracing::info!(
        "User {} demoted from admin by {}",
        user.username,
        auth.user.username
    );

    Ok(Json(serde_json::json!({
        "message": "User demoted successfully"
    })))
}

// POST /api/admin/users/:id/ban - Ban user
pub async fn ban_user(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthUser>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    check_admin(&auth)?;

    // Can't ban yourself
    if user_id == auth.user_id {
        return Err(AppError::BadRequest("Cannot ban yourself".to_string()));
    }

    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    // Can't ban other admins
    if user.is_admin {
        return Err(AppError::BadRequest(
            "Cannot ban an admin. Demote them first.".to_string(),
        ));
    }

    if user.is_banned {
        return Err(AppError::BadRequest("User is already banned".to_string()));
    }

    sqlx::query("UPDATE users SET is_banned = true, is_online = false WHERE id = $1")
        .bind(user_id)
        .execute(&state.db)
        .await?;

    tracing::info!(
        "User {} banned by admin {}",
        user.username,
        auth.user.username
    );

    Ok(Json(serde_json::json!({
        "message": "User banned successfully"
    })))
}

// POST /api/admin/users/:id/unban - Unban user
pub async fn unban_user(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthUser>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    check_admin(&auth)?;

    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    if !user.is_banned {
        return Err(AppError::BadRequest("User is not banned".to_string()));
    }

    sqlx::query("UPDATE users SET is_banned = false WHERE id = $1")
        .bind(user_id)
        .execute(&state.db)
        .await?;

    tracing::info!(
        "User {} unbanned by admin {}",
        user.username,
        auth.user.username
    );

    Ok(Json(serde_json::json!({
        "message": "User unbanned successfully"
    })))
}

// DELETE /api/admin/users/:id - Delete user
pub async fn delete_user(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthUser>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    check_admin(&auth)?;

    // Can't delete yourself
    if user_id == auth.user_id {
        return Err(AppError::BadRequest("Cannot delete yourself".to_string()));
    }

    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    // Check if user is creator of any rooms
    let room_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM rooms WHERE creator_id = $1")
        .bind(user_id)
        .fetch_one(&state.db)
        .await?;

    if room_count > 0 {
        return Err(AppError::BadRequest(format!(
            "User is creator of {} room(s). Delete or transfer those rooms first.",
            room_count
        )));
    }

    sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(user_id)
        .execute(&state.db)
        .await?;

    tracing::info!(
        "User {} deleted by admin {}",
        user.username,
        auth.user.username
    );

    Ok(Json(serde_json::json!({
        "message": "User deleted successfully"
    })))
}

// GET /api/admin/rooms - List all rooms
pub async fn list_rooms(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<serde_json::Value>> {
    check_admin(&auth)?;

    let rooms = sqlx::query_as::<_, Room>("SELECT * FROM rooms ORDER BY created_at DESC")
        .fetch_all(&state.db)
        .await?;

    let mut room_responses = Vec::new();
    for room in rooms {
        let member_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM room_members WHERE room_id = $1")
                .bind(room.id)
                .fetch_one(&state.db)
                .await?;

        let message_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM messages WHERE room_id = $1")
                .bind(room.id)
                .fetch_one(&state.db)
                .await?;

        let creator = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
            .bind(room.creator_id)
            .fetch_one(&state.db)
            .await?;

        let mut room_resp = serde_json::to_value(RoomResponse::from(room)).unwrap();
        if let Some(obj) = room_resp.as_object_mut() {
            obj.insert("memberCount".to_string(), serde_json::json!(member_count));
            obj.insert("messageCount".to_string(), serde_json::json!(message_count));
            obj.insert(
                "creator".to_string(),
                serde_json::json!({
                    "id": creator.id,
                    "username": creator.username,
                    "displayName": creator.display_name,
                }),
            );
        }
        room_responses.push(room_resp);
    }

    Ok(Json(serde_json::json!({ "rooms": room_responses })))
}

// DELETE /api/admin/rooms/:id - Delete room
pub async fn delete_room(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthUser>,
    Path(room_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    check_admin(&auth)?;

    let room = sqlx::query_as::<_, Room>("SELECT * FROM rooms WHERE id = $1")
        .bind(room_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Room not found".to_string()))?;

    sqlx::query("DELETE FROM rooms WHERE id = $1")
        .bind(room_id)
        .execute(&state.db)
        .await?;

    tracing::info!("Room {} deleted by admin {}", room.name, auth.user.username);

    Ok(Json(serde_json::json!({
        "message": "Room deleted successfully"
    })))
}

// GET /api/admin/stats - Get server statistics
pub async fn get_stats(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<serde_json::Value>> {
    check_admin(&auth)?;

    let total_users: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(&state.db)
        .await?;

    let online_users: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE is_online = true")
        .fetch_one(&state.db)
        .await?;

    let banned_users: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE is_banned = true")
        .fetch_one(&state.db)
        .await?;

    let admin_users: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE is_admin = true")
        .fetch_one(&state.db)
        .await?;

    let total_rooms: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM rooms")
        .fetch_one(&state.db)
        .await?;

    let public_rooms: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM rooms WHERE is_public = true")
        .fetch_one(&state.db)
        .await?;

    let total_messages: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM messages")
        .fetch_one(&state.db)
        .await?;

    // Get most active rooms (by message count)
    #[derive(sqlx::FromRow)]
    struct ActiveRoom {
        id: uuid::Uuid,
        name: String,
        message_count: Option<i64>,
    }

    let active_rooms = sqlx::query_as::<_, ActiveRoom>(
        r#"
        SELECT r.id, r.name, COUNT(m.id) as message_count
        FROM rooms r
        LEFT JOIN messages m ON r.id = m.room_id
        GROUP BY r.id, r.name
        ORDER BY message_count DESC
        LIMIT 5
        "#,
    )
    .fetch_all(&state.db)
    .await?;

    let active_rooms_json: Vec<_> = active_rooms
        .iter()
        .map(|r| {
            serde_json::json!({
                "id": r.id,
                "name": r.name,
                "messageCount": r.message_count.unwrap_or(0)
            })
        })
        .collect();

    // Get recent registrations (last 24 hours)
    let recent_registrations: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '24 hours'",
    )
    .fetch_one(&state.db)
    .await?;

    // Get active sockets count
    let active_sockets = state.socket_users.read().await.len();

    Ok(Json(serde_json::json!({
        "users": {
            "total": total_users,
            "online": online_users,
            "banned": banned_users,
            "admins": admin_users,
            "recentRegistrations": recent_registrations,
        },
        "rooms": {
            "total": total_rooms,
            "public": public_rooms,
        },
        "messages": {
            "total": total_messages,
        },
        "sockets": {
            "active": active_sockets,
        },
        "activeRooms": active_rooms_json,
    })))
}
