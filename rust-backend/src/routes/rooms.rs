use crate::error::{AppError, Result};
use crate::middleware::{AuthUser, ValidatedJson};
use crate::models::{CreateRoomRequest, Message, Room, RoomMember, RoomResponse, User};
use crate::services::CryptoService;
use crate::state::AppState;
use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct PaginationQuery {
    #[serde(default = "default_limit")]
    limit: i64,
    #[serde(default)]
    offset: i64,
}

fn default_limit() -> i64 {
    50
}

#[derive(Deserialize)]
pub struct SearchQuery {
    q: String,
}

#[derive(Serialize)]
pub struct MessageResponse {
    pub id: Uuid,
    pub room_id: Uuid,
    pub user_id: Uuid,
    pub content: String,
    pub message_type: String,
    pub reply_to: Option<Uuid>,
    pub forwarded_from: Option<Uuid>,
    pub reactions: serde_json::Value,
    pub metadata: Option<serde_json::Value>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
    pub user: serde_json::Value,
}

// GET /api/rooms - List public rooms
pub async fn list_rooms(
    State(state): State<Arc<AppState>>,
    Extension(_auth): Extension<AuthUser>,
) -> Result<Json<serde_json::Value>> {
    let rooms = sqlx::query_as::<_, Room>(
        "SELECT * FROM rooms WHERE is_public = true ORDER BY created_at DESC",
    )
    .fetch_all(&state.db)
    .await?;

    let room_responses: Vec<RoomResponse> = rooms.into_iter().map(|r| r.into()).collect();

    Ok(Json(serde_json::json!({ "rooms": room_responses })))
}

// POST /api/rooms - Create room
pub async fn create_room(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthUser>,
    ValidatedJson(req): ValidatedJson<CreateRoomRequest>,
) -> Result<Json<serde_json::Value>> {
    let crypto_service = CryptoService::new();

    // Only admins can create public rooms
    if req.is_public && !auth.user.is_admin {
        return Err(AppError::Authorization(
            "Only admins can create public rooms".to_string(),
        ));
    }

    // Generate room encryption key
    let room_key = crypto_service.generate_room_key();

    let room = sqlx::query_as::<_, Room>(
        "INSERT INTO rooms (name, description, is_public, creator_id, room_key, max_members)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *",
    )
    .bind(&req.name)
    .bind(&req.description)
    .bind(req.is_public)
    .bind(auth.user_id)
    .bind(&room_key)
    .bind(req.max_members.unwrap_or(100))
    .fetch_one(&state.db)
    .await?;

    // Add creator as member
    sqlx::query("INSERT INTO room_members (room_id, user_id, role) VALUES ($1, $2, $3)")
        .bind(room.id)
        .bind(auth.user_id)
        .bind("admin")
        .execute(&state.db)
        .await?;

    tracing::info!("Room created: {} by user {}", room.name, auth.user.username);

    Ok(Json(serde_json::json!({
        "message": "Room created successfully",
        "room": room.to_member_json()
    })))
}

// GET /api/rooms/:id - Get room details
pub async fn get_room(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthUser>,
    Path(room_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let room = sqlx::query_as::<_, Room>("SELECT * FROM rooms WHERE id = $1")
        .bind(room_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Room not found".to_string()))?;

    // Check if user is member
    let is_member = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2)",
    )
    .bind(room_id)
    .bind(auth.user_id)
    .fetch_one(&state.db)
    .await?;

    // Auto-join public rooms
    if !is_member && room.is_public {
        let member_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM room_members WHERE room_id = $1")
                .bind(room_id)
                .fetch_one(&state.db)
                .await?;

        if member_count >= room.max_members as i64 {
            return Err(AppError::BadRequest("Room is full".to_string()));
        }

        sqlx::query("INSERT INTO room_members (room_id, user_id, role) VALUES ($1, $2, $3)")
            .bind(room_id)
            .bind(auth.user_id)
            .bind("member")
            .execute(&state.db)
            .await?;

        tracing::info!(
            "User {} auto-joined public room {}",
            auth.user.username,
            room.name
        );
    } else if !is_member {
        return Err(AppError::Authorization(
            "Not a member of this room".to_string(),
        ));
    }

    Ok(Json(serde_json::json!({
        "room": room.to_member_json()
    })))
}

// POST /api/rooms/:id/join - Join room
pub async fn join_room(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthUser>,
    Path(room_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let room = sqlx::query_as::<_, Room>("SELECT * FROM rooms WHERE id = $1")
        .bind(room_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Room not found".to_string()))?;

    // Check if already member
    let is_member = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2)",
    )
    .bind(room_id)
    .bind(auth.user_id)
    .fetch_one(&state.db)
    .await?;

    if is_member {
        return Err(AppError::BadRequest(
            "Already a member of this room".to_string(),
        ));
    }

    // Check capacity
    let member_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM room_members WHERE room_id = $1")
            .bind(room_id)
            .fetch_one(&state.db)
            .await?;

    if member_count >= room.max_members as i64 {
        return Err(AppError::BadRequest("Room is full".to_string()));
    }

    sqlx::query("INSERT INTO room_members (room_id, user_id, role) VALUES ($1, $2, $3)")
        .bind(room_id)
        .bind(auth.user_id)
        .bind("member")
        .execute(&state.db)
        .await?;

    tracing::info!("User {} joined room {}", auth.user.username, room.name);

    Ok(Json(serde_json::json!({
        "message": "Joined room successfully",
        "room": room.to_member_json()
    })))
}

// POST /api/rooms/:id/leave - Leave room
pub async fn leave_room(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthUser>,
    Path(room_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let room = sqlx::query_as::<_, Room>("SELECT * FROM rooms WHERE id = $1")
        .bind(room_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Room not found".to_string()))?;

    // Can't leave if you're the creator
    if room.creator_id == Some(auth.user_id) {
        return Err(AppError::BadRequest(
            "Room creator cannot leave. Delete the room instead.".to_string(),
        ));
    }

    let result = sqlx::query("DELETE FROM room_members WHERE room_id = $1 AND user_id = $2")
        .bind(room_id)
        .bind(auth.user_id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Not a member of this room".to_string()));
    }

    tracing::info!("User {} left room {}", auth.user.username, room.name);

    Ok(Json(
        serde_json::json!({ "message": "Left room successfully" }),
    ))
}

// DELETE /api/rooms/:id - Delete room
pub async fn delete_room(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthUser>,
    Path(room_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let room = sqlx::query_as::<_, Room>("SELECT * FROM rooms WHERE id = $1")
        .bind(room_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Room not found".to_string()))?;

    // Only creator or admin can delete
    if room.creator_id != Some(auth.user_id) && !auth.user.is_admin {
        return Err(AppError::Authorization(
            "Only room creator or admin can delete room".to_string(),
        ));
    }

    sqlx::query("DELETE FROM rooms WHERE id = $1")
        .bind(room_id)
        .execute(&state.db)
        .await?;

    tracing::info!("Room {} deleted by user {}", room.name, auth.user.username);

    Ok(Json(
        serde_json::json!({ "message": "Room deleted successfully" }),
    ))
}

// GET /api/rooms/:id/messages - Get messages
pub async fn get_messages(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthUser>,
    Path(room_id): Path<Uuid>,
    Query(pagination): Query<PaginationQuery>,
) -> Result<Json<serde_json::Value>> {
    // Check if user is member
    let is_member = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2)",
    )
    .bind(room_id)
    .bind(auth.user_id)
    .fetch_one(&state.db)
    .await?;

    if !is_member {
        return Err(AppError::Authorization(
            "Not a member of this room".to_string(),
        ));
    }

    let messages = sqlx::query_as::<_, Message>(
        "SELECT * FROM messages
         WHERE room_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3",
    )
    .bind(room_id)
    .bind(pagination.limit)
    .bind(pagination.offset)
    .fetch_all(&state.db)
    .await?;

    // Fetch user info for each message
    let mut message_responses = Vec::new();
    for msg in messages {
        let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
            .bind(msg.user_id)
            .fetch_one(&state.db)
            .await?;

        message_responses.push(MessageResponse {
            id: msg.id,
            room_id: msg.room_id,
            user_id: msg.user_id,
            content: msg.content,
            message_type: msg.message_type,
            reply_to: msg.reply_to,
            forwarded_from: msg.forwarded_from,
            reactions: msg.reactions,
            metadata: msg.metadata,
            created_at: msg.created_at,
            updated_at: msg.updated_at,
            user: serde_json::json!({
                "id": user.id,
                "username": user.username,
                "displayName": user.display_name,
                "avatar": user.avatar,
                "publicKey": user.public_key,
            }),
        });
    }

    Ok(Json(serde_json::json!({ "messages": message_responses })))
}

// GET /api/rooms/:id/members - Get room members
pub async fn get_members(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthUser>,
    Path(room_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    // Check if user is member
    let is_member = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2)",
    )
    .bind(room_id)
    .bind(auth.user_id)
    .fetch_one(&state.db)
    .await?;

    if !is_member {
        return Err(AppError::Authorization(
            "Not a member of this room".to_string(),
        ));
    }

    let members = sqlx::query_as::<_, RoomMember>("SELECT * FROM room_members WHERE room_id = $1")
        .bind(room_id)
        .fetch_all(&state.db)
        .await?;

    let mut member_responses = Vec::new();
    for member in members {
        let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
            .bind(member.user_id)
            .fetch_one(&state.db)
            .await?;

        member_responses.push(serde_json::json!({
            "userId": member.user_id,
            "role": member.role,
            "joinedAt": member.joined_at,
            "user": {
                "id": user.id,
                "username": user.username,
                "displayName": user.display_name,
                "avatar": user.avatar,
                "isOnline": user.is_online,
                "lastSeen": user.last_seen,
            }
        }));
    }

    Ok(Json(serde_json::json!({ "members": member_responses })))
}

// POST /api/rooms/:id/members - Add member (admin only)
pub async fn add_member(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthUser>,
    Path(room_id): Path<Uuid>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>> {
    let user_id = payload
        .get("userId")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok())
        .ok_or_else(|| AppError::BadRequest("Invalid userId".to_string()))?;

    // Check if requester is room admin or global admin
    let member = sqlx::query_as::<_, RoomMember>(
        "SELECT * FROM room_members WHERE room_id = $1 AND user_id = $2",
    )
    .bind(room_id)
    .bind(auth.user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::Authorization("Not a member of this room".to_string()))?;

    if member.role != "admin" && !auth.user.is_admin {
        return Err(AppError::Authorization(
            "Only room admins can add members".to_string(),
        ));
    }

    // Check if user exists
    let target_user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    // Check capacity
    let member_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM room_members WHERE room_id = $1")
            .bind(room_id)
            .fetch_one(&state.db)
            .await?;

    let room = sqlx::query_as::<_, Room>("SELECT * FROM rooms WHERE id = $1")
        .bind(room_id)
        .fetch_one(&state.db)
        .await?;

    if member_count >= room.max_members as i64 {
        return Err(AppError::BadRequest("Room is full".to_string()));
    }

    // Add member
    sqlx::query(
        "INSERT INTO room_members (room_id, user_id, role) VALUES ($1, $2, $3)
         ON CONFLICT (room_id, user_id) DO NOTHING",
    )
    .bind(room_id)
    .bind(user_id)
    .bind("member")
    .execute(&state.db)
    .await?;

    tracing::info!(
        "User {} added to room {} by {}",
        target_user.username,
        room.name,
        auth.user.username
    );

    Ok(Json(
        serde_json::json!({ "message": "Member added successfully" }),
    ))
}

// DELETE /api/rooms/:id/members/:userId - Remove member
pub async fn remove_member(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthUser>,
    Path((room_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>> {
    let room = sqlx::query_as::<_, Room>("SELECT * FROM rooms WHERE id = $1")
        .bind(room_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Room not found".to_string()))?;

    // Check if requester is room admin or global admin
    let member = sqlx::query_as::<_, RoomMember>(
        "SELECT * FROM room_members WHERE room_id = $1 AND user_id = $2",
    )
    .bind(room_id)
    .bind(auth.user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::Authorization("Not a member of this room".to_string()))?;

    if member.role != "admin" && !auth.user.is_admin {
        return Err(AppError::Authorization(
            "Only room admins can remove members".to_string(),
        ));
    }

    // Can't remove creator
    if Some(user_id) == room.creator_id {
        return Err(AppError::BadRequest(
            "Cannot remove room creator".to_string(),
        ));
    }

    let result = sqlx::query("DELETE FROM room_members WHERE room_id = $1 AND user_id = $2")
        .bind(room_id)
        .bind(user_id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Member not found".to_string()));
    }

    tracing::info!("User {} removed from room {}", user_id, room.name);

    Ok(Json(
        serde_json::json!({ "message": "Member removed successfully" }),
    ))
}

// GET /api/rooms/:id/search - Search messages
pub async fn search_messages(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthUser>,
    Path(room_id): Path<Uuid>,
    Query(query): Query<SearchQuery>,
) -> Result<Json<serde_json::Value>> {
    // Check if user is member
    let is_member = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2)",
    )
    .bind(room_id)
    .bind(auth.user_id)
    .fetch_one(&state.db)
    .await?;

    if !is_member {
        return Err(AppError::Authorization(
            "Not a member of this room".to_string(),
        ));
    }

    // Return all messages for client-side decryption and search
    // Since messages are encrypted, we can't search server-side
    let messages = sqlx::query_as::<_, Message>(
        "SELECT * FROM messages WHERE room_id = $1 ORDER BY created_at DESC",
    )
    .bind(room_id)
    .fetch_all(&state.db)
    .await?;

    let mut message_responses = Vec::new();
    for msg in messages {
        let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
            .bind(msg.user_id)
            .fetch_one(&state.db)
            .await?;

        message_responses.push(MessageResponse {
            id: msg.id,
            room_id: msg.room_id,
            user_id: msg.user_id,
            content: msg.content,
            message_type: msg.message_type,
            reply_to: msg.reply_to,
            forwarded_from: msg.forwarded_from,
            reactions: msg.reactions,
            metadata: msg.metadata,
            created_at: msg.created_at,
            updated_at: msg.updated_at,
            user: serde_json::json!({
                "id": user.id,
                "username": user.username,
                "displayName": user.display_name,
                "avatar": user.avatar,
                "publicKey": user.public_key,
            }),
        });
    }

    Ok(Json(serde_json::json!({
        "messages": message_responses,
        "query": query.q
    })))
}
