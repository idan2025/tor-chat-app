use crate::models::{Message, Room, User};
use crate::services::AuthService;
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use socketioxide::extract::{Data, SocketRef, State};
use std::sync::Arc;
use uuid::Uuid;

// Helper to get user info from socket
async fn get_socket_user_info(socket: &SocketRef, state: &AppState) -> Option<(Uuid, User)> {
    state.get_socket_user(&socket.id.to_string()).await
}

#[derive(Debug, Deserialize)]
pub struct AuthData {
    token: String,
}

#[derive(Debug, Deserialize)]
pub struct JoinRoomData {
    #[serde(rename = "roomId")]
    room_id: String,
}

#[derive(Debug, Deserialize)]
pub struct LeaveRoomData {
    #[serde(rename = "roomId")]
    room_id: String,
}

#[derive(Debug, Deserialize)]
pub struct SendMessageData {
    #[serde(rename = "roomId")]
    room_id: String,
    content: String,
    #[serde(rename = "messageType")]
    message_type: Option<String>,
    #[serde(rename = "replyTo")]
    reply_to: Option<String>,
    metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct TypingData {
    #[serde(rename = "roomId")]
    room_id: String,
    typing: bool,
}

#[derive(Debug, Deserialize)]
pub struct ReactionData {
    #[serde(rename = "messageId")]
    message_id: String,
    emoji: String,
}

#[derive(Debug, Deserialize)]
pub struct EditMessageData {
    #[serde(rename = "messageId")]
    message_id: String,
    content: String,
}

#[derive(Debug, Deserialize)]
pub struct DeleteMessageData {
    #[serde(rename = "messageId")]
    message_id: String,
}

#[derive(Debug, Deserialize)]
pub struct MarkReadData {
    #[serde(rename = "roomId")]
    room_id: String,
    #[serde(rename = "messageId")]
    message_id: String,
}

#[derive(Debug, Deserialize)]
pub struct ForwardMessageData {
    #[serde(rename = "messageId")]
    message_id: String,
    #[serde(rename = "targetRoomId")]
    target_room_id: String,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    error: String,
}

// Helper to get user from token
async fn get_user_from_token(token: &str, state: &AppState) -> Option<(Uuid, User)> {
    let auth_service = AuthService::new(state.config.clone());
    let user_id = auth_service.verify_token(token).ok()?;

    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&state.db)
        .await
        .ok()??;

    Some((user_id, user))
}

// Helper to check room membership
async fn check_room_membership(room_id: Uuid, user_id: Uuid, state: &AppState) -> bool {
    sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2)",
    )
    .bind(room_id)
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or(false)
}

// 1. authenticate - Handle socket authentication
pub async fn on_authenticate(
    socket: SocketRef,
    Data(data): Data<AuthData>,
    State(state): State<Arc<AppState>>,
) {
    match get_user_from_token(&data.token, state).await {
        Some((user_id, user)) => {
            // Associate socket with user
            state
                .associate_socket_user(socket.id.to_string(), user_id, user.clone())
                .await;

            // Track socket connection
            state.add_user_socket(user_id, socket.id.to_string()).await;

            // Update user online status
            let _ = sqlx::query("UPDATE users SET is_online = true WHERE id = $1")
                .bind(user_id)
                .execute(&state.db)
                .await;

            tracing::info!(
                "User {} authenticated on socket {}",
                user.username,
                socket.id
            );

            socket
                .emit(
                    "authenticated",
                    serde_json::json!({
                        "userId": user_id,
                        "username": user.username
                    }),
                )
                .ok();

            // Broadcast user online to all sockets
            socket
                .broadcast()
                .emit(
                    "user_online",
                    serde_json::json!({
                        "userId": user_id,
                        "username": user.username
                    }),
                )
                .ok();
        }
        None => {
            socket
                .emit(
                    "error",
                    ErrorResponse {
                        error: "Authentication failed".to_string(),
                    },
                )
                .ok();
            socket.disconnect().ok();
        }
    }
}

// 2. join_room - Join a room
pub async fn on_join_room(
    socket: SocketRef,
    Data(data): Data<JoinRoomData>,
    State(state): State<Arc<AppState>>,
) {
    let user_id = match get_socket_user_info(&socket, state).await {
        Some((id, _)) => id,
        None => {
            socket
                .emit(
                    "error",
                    ErrorResponse {
                        error: "Not authenticated".to_string(),
                    },
                )
                .ok();
            return;
        }
    };

    let room_id = match Uuid::parse_str(&data.room_id) {
        Ok(id) => id,
        Err(_) => {
            socket
                .emit(
                    "error",
                    ErrorResponse {
                        error: "Invalid room ID".to_string(),
                    },
                )
                .ok();
            return;
        }
    };

    // Check membership
    if !check_room_membership(room_id, user_id, state).await {
        socket
            .emit(
                "error",
                ErrorResponse {
                    error: "Not a member of this room".to_string(),
                },
            )
            .ok();
        return;
    }

    // Join socket room
    socket.join(data.room_id.clone()).ok();

    tracing::info!("User {} joined room {}", user_id, room_id);

    socket
        .emit(
            "joined_room",
            serde_json::json!({
                "roomId": data.room_id
            }),
        )
        .ok();
}

// 3. leave_room - Leave a room
pub async fn on_leave_room(socket: SocketRef, Data(data): Data<LeaveRoomData>) {
    socket.leave(data.room_id.clone()).ok();

    socket
        .emit(
            "left_room",
            serde_json::json!({
                "roomId": data.room_id
            }),
        )
        .ok();
}

// 4. send_message - Send a message to a room
pub async fn on_send_message(
    socket: SocketRef,
    Data(data): Data<SendMessageData>,
    State(state): State<Arc<AppState>>,
) {
    let (user_id, user) = match get_socket_user_info(&socket, state).await {
        Some((id, u)) => (id, u),
        None => return,
    };

    let room_id = match Uuid::parse_str(&data.room_id) {
        Ok(id) => id,
        Err(_) => return,
    };

    // Check membership
    if !check_room_membership(room_id, user_id, state).await {
        socket
            .emit(
                "error",
                ErrorResponse {
                    error: "Not a member of this room".to_string(),
                },
            )
            .ok();
        return;
    }

    let reply_to = data.reply_to.and_then(|s| Uuid::parse_str(&s).ok());
    let message_type = data.message_type.unwrap_or_else(|| "text".to_string());

    // Create message
    let message = match sqlx::query_as::<_, Message>(
        "INSERT INTO messages (room_id, user_id, content, message_type, reply_to, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *",
    )
    .bind(room_id)
    .bind(user_id)
    .bind(&data.content)
    .bind(&message_type)
    .bind(reply_to)
    .bind(&data.metadata)
    .fetch_one(&state.db)
    .await
    {
        Ok(msg) => msg,
        Err(e) => {
            tracing::error!("Failed to create message: {}", e);
            socket
                .emit(
                    "error",
                    ErrorResponse {
                        error: "Failed to send message".to_string(),
                    },
                )
                .ok();
            return;
        }
    };

    let message_response = serde_json::json!({
        "id": message.id,
        "roomId": message.room_id,
        "userId": message.user_id,
        "content": message.content,
        "messageType": message.message_type,
        "replyTo": message.reply_to,
        "forwardedFrom": message.forwarded_from,
        "reactions": message.reactions,
        "metadata": message.metadata,
        "createdAt": message.created_at,
        "updatedAt": message.updated_at,
        "user": {
            "id": user.id,
            "username": user.username,
            "displayName": user.display_name,
            "avatar": user.avatar,
            "publicKey": user.public_key,
        }
    });

    // Broadcast to room
    socket
        .within(data.room_id)
        .emit("new_message", &message_response)
        .ok();
}

// 5. typing - Indicate typing status
pub async fn on_typing(
    socket: SocketRef,
    Data(data): Data<TypingData>,
    State(state): State<Arc<AppState>>,
) {
    let (user_id, user) = match get_socket_user_info(&socket, state).await {
        Some((id, u)) => (id, u),
        None => return,
    };

    let room_id = match Uuid::parse_str(&data.room_id) {
        Ok(id) => id,
        Err(_) => return,
    };

    // Check membership
    if !check_room_membership(room_id, user_id, state).await {
        return;
    }

    // Broadcast typing status to room (excluding sender)
    socket
        .broadcast()
        .within(data.room_id)
        .emit(
            "user_typing",
            serde_json::json!({
                "userId": user_id,
                "username": user.username,
                "typing": data.typing
            }),
        )
        .ok();
}

// 6. add_reaction - Add reaction to a message
pub async fn on_add_reaction(
    socket: SocketRef,
    Data(data): Data<ReactionData>,
    State(state): State<Arc<AppState>>,
) {
    let user_id = match get_socket_user_info(&socket, state).await {
        Some((id, _)) => id,
        None => return,
    };

    let message_id = match Uuid::parse_str(&data.message_id) {
        Ok(id) => id,
        Err(_) => return,
    };

    // Get message and check room membership
    let message = match sqlx::query_as::<_, Message>("SELECT * FROM messages WHERE id = $1")
        .bind(message_id)
        .fetch_optional(&state.db)
        .await
    {
        Ok(Some(msg)) => msg,
        _ => return,
    };

    if !check_room_membership(message.room_id, user_id, state).await {
        return;
    }

    // Update reactions (assuming reactions is JSONB)
    let mut reactions: serde_json::Value = message.reactions;
    if let Some(obj) = reactions.as_object_mut() {
        let emoji_key = data.emoji.clone();
        let users = obj.entry(emoji_key).or_insert(serde_json::json!([]));
        if let Some(arr) = users.as_array_mut() {
            let user_id_str = user_id.to_string();
            if !arr.iter().any(|v| v.as_str() == Some(&user_id_str)) {
                arr.push(serde_json::json!(user_id_str));
            }
        }
    }

    let _ = sqlx::query("UPDATE messages SET reactions = $1 WHERE id = $2")
        .bind(&reactions)
        .bind(message_id)
        .execute(&state.db)
        .await;

    // Broadcast reaction to room
    socket
        .within(message.room_id.to_string())
        .emit(
            "reaction_added",
            serde_json::json!({
                "messageId": message_id,
                "userId": user_id,
                "emoji": data.emoji,
                "reactions": reactions
            }),
        )
        .ok();
}

// 7. remove_reaction - Remove reaction from a message
pub async fn on_remove_reaction(
    socket: SocketRef,
    Data(data): Data<ReactionData>,
    State(state): State<Arc<AppState>>,
) {
    let user_id = match get_socket_user_info(&socket, state).await {
        Some((id, _)) => id,
        None => return,
    };

    let message_id = match Uuid::parse_str(&data.message_id) {
        Ok(id) => id,
        Err(_) => return,
    };

    let message = match sqlx::query_as::<_, Message>("SELECT * FROM messages WHERE id = $1")
        .bind(message_id)
        .fetch_optional(&state.db)
        .await
    {
        Ok(Some(msg)) => msg,
        _ => return,
    };

    if !check_room_membership(message.room_id, user_id, state).await {
        return;
    }

    let mut reactions: serde_json::Value = message.reactions;
    if let Some(obj) = reactions.as_object_mut() {
        if let Some(users) = obj.get_mut(&data.emoji) {
            if let Some(arr) = users.as_array_mut() {
                let user_id_str = user_id.to_string();
                arr.retain(|v| v.as_str() != Some(&user_id_str));
                if arr.is_empty() {
                    obj.remove(&data.emoji);
                }
            }
        }
    }

    let _ = sqlx::query("UPDATE messages SET reactions = $1 WHERE id = $2")
        .bind(&reactions)
        .bind(message_id)
        .execute(&state.db)
        .await;

    socket
        .within(message.room_id.to_string())
        .emit(
            "reaction_removed",
            serde_json::json!({
                "messageId": message_id,
                "userId": user_id,
                "emoji": data.emoji,
                "reactions": reactions
            }),
        )
        .ok();
}

// 8. edit_message - Edit a message
pub async fn on_edit_message(
    socket: SocketRef,
    Data(data): Data<EditMessageData>,
    State(state): State<Arc<AppState>>,
) {
    let user_id = match get_socket_user_info(&socket, state).await {
        Some((id, _)) => id,
        None => return,
    };

    let message_id = match Uuid::parse_str(&data.message_id) {
        Ok(id) => id,
        Err(_) => return,
    };

    let message = match sqlx::query_as::<_, Message>("SELECT * FROM messages WHERE id = $1")
        .bind(message_id)
        .fetch_optional(&state.db)
        .await
    {
        Ok(Some(msg)) => msg,
        _ => return,
    };

    // Only message owner can edit
    if message.user_id != user_id {
        socket
            .emit(
                "error",
                ErrorResponse {
                    error: "Can only edit your own messages".to_string(),
                },
            )
            .ok();
        return;
    }

    let _ = sqlx::query("UPDATE messages SET content = $1, updated_at = NOW() WHERE id = $2")
        .bind(&data.content)
        .bind(message_id)
        .execute(&state.db)
        .await;

    socket
        .within(message.room_id.to_string())
        .emit(
            "message_edited",
            serde_json::json!({
                "messageId": message_id,
                "content": data.content,
                "updatedAt": chrono::Utc::now()
            }),
        )
        .ok();
}

// 9. delete_message - Delete a message
pub async fn on_delete_message(
    socket: SocketRef,
    Data(data): Data<DeleteMessageData>,
    State(state): State<Arc<AppState>>,
) {
    let (user_id, user) = match get_socket_user_info(&socket, state).await {
        Some((id, u)) => (id, u),
        None => return,
    };

    let message_id = match Uuid::parse_str(&data.message_id) {
        Ok(id) => id,
        Err(_) => return,
    };

    let message = match sqlx::query_as::<_, Message>("SELECT * FROM messages WHERE id = $1")
        .bind(message_id)
        .fetch_optional(&state.db)
        .await
    {
        Ok(Some(msg)) => msg,
        _ => return,
    };

    // Only message owner or admin can delete
    if message.user_id != user_id && !user.is_admin {
        socket
            .emit(
                "error",
                ErrorResponse {
                    error: "Permission denied".to_string(),
                },
            )
            .ok();
        return;
    }

    let _ = sqlx::query("DELETE FROM messages WHERE id = $1")
        .bind(message_id)
        .execute(&state.db)
        .await;

    socket
        .within(message.room_id.to_string())
        .emit(
            "message_deleted",
            serde_json::json!({
                "messageId": message_id
            }),
        )
        .ok();
}

// 10. mark_read - Mark message as read
pub async fn on_mark_read(
    socket: SocketRef,
    Data(data): Data<MarkReadData>,
    State(state): State<Arc<AppState>>,
) {
    let user_id = match get_socket_user_info(&socket, state).await {
        Some((id, _)) => id,
        None => return,
    };

    let room_id = match Uuid::parse_str(&data.room_id) {
        Ok(id) => id,
        Err(_) => return,
    };

    if !check_room_membership(room_id, user_id, state).await {
        return;
    }

    // Broadcast read receipt to room
    socket
        .broadcast()
        .within(data.room_id)
        .emit(
            "message_read",
            serde_json::json!({
                "userId": user_id,
                "messageId": data.message_id
            }),
        )
        .ok();
}

// 11. forward_message - Forward a message to another room
pub async fn on_forward_message(
    socket: SocketRef,
    Data(data): Data<ForwardMessageData>,
    State(state): State<Arc<AppState>>,
) {
    let (user_id, user) = match get_socket_user_info(&socket, state).await {
        Some((id, u)) => (id, u),
        None => return,
    };

    let message_id = match Uuid::parse_str(&data.message_id) {
        Ok(id) => id,
        Err(_) => return,
    };

    let target_room_id = match Uuid::parse_str(&data.target_room_id) {
        Ok(id) => id,
        Err(_) => return,
    };

    // Get original message
    let original_message =
        match sqlx::query_as::<_, Message>("SELECT * FROM messages WHERE id = $1")
            .bind(message_id)
            .fetch_optional(&state.db)
            .await
        {
            Ok(Some(msg)) => msg,
            _ => return,
        };

    // Check membership in both rooms
    if !check_room_membership(original_message.room_id, user_id, state).await {
        return;
    }
    if !check_room_membership(target_room_id, user_id, state).await {
        return;
    }

    // Create forwarded message
    let forwarded_message = match sqlx::query_as::<_, Message>(
        "INSERT INTO messages (room_id, user_id, content, message_type, forwarded_from, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *",
    )
    .bind(target_room_id)
    .bind(user_id)
    .bind(&original_message.content)
    .bind(&original_message.message_type)
    .bind(message_id)
    .bind(&original_message.metadata)
    .fetch_one(&state.db)
    .await
    {
        Ok(msg) => msg,
        Err(_) => return,
    };

    let message_response = serde_json::json!({
        "id": forwarded_message.id,
        "roomId": forwarded_message.room_id,
        "userId": forwarded_message.user_id,
        "content": forwarded_message.content,
        "messageType": forwarded_message.message_type,
        "forwardedFrom": forwarded_message.forwarded_from,
        "metadata": forwarded_message.metadata,
        "createdAt": forwarded_message.created_at,
        "user": {
            "id": user.id,
            "username": user.username,
            "displayName": user.display_name,
            "avatar": user.avatar,
            "publicKey": user.public_key,
        }
    });

    socket
        .within(data.target_room_id)
        .emit("new_message", &message_response)
        .ok();
}

// 12. disconnect - Handle socket disconnect
pub async fn on_disconnect(socket: SocketRef, State(state): State<Arc<AppState>>) {
    if let Some((user_id, _)) = get_socket_user_info(&socket, state).await {
        // Remove from tracking
        state.remove_socket_user(&socket.id.to_string()).await;
        state
            .remove_user_socket(user_id, &socket.id.to_string())
            .await;

        // Update user online status
        let _ = sqlx::query("UPDATE users SET is_online = false, last_seen = NOW() WHERE id = $1")
            .bind(user_id)
            .execute(&state.db)
            .await;

        tracing::info!("User {} disconnected from socket {}", user_id, socket.id);

        // Broadcast user offline
        socket
            .broadcast()
            .emit(
                "user_offline",
                serde_json::json!({
                    "userId": user_id
                }),
            )
            .ok();
    }
}

// Additional events for room management

// 13. room_created - Broadcast when a room is created
pub fn broadcast_room_created(socket: &SocketRef, room: &Room) {
    socket
        .broadcast()
        .emit(
            "room_created",
            serde_json::json!({
                "id": room.id,
                "name": room.name,
                "description": room.description,
                "isPublic": room.is_public,
                "creatorId": room.creator_id,
                "createdAt": room.created_at
            }),
        )
        .ok();
}

// 14. room_deleted - Broadcast when a room is deleted
pub fn broadcast_room_deleted(socket: &SocketRef, room_id: Uuid) {
    socket
        .broadcast()
        .emit(
            "room_deleted",
            serde_json::json!({
                "roomId": room_id
            }),
        )
        .ok();
}

// 15. member_joined - Broadcast when a user joins a room
pub fn broadcast_member_joined(socket: &SocketRef, room_id: Uuid, user_id: Uuid, username: &str) {
    socket
        .within(room_id.to_string())
        .emit(
            "member_joined",
            serde_json::json!({
                "roomId": room_id,
                "userId": user_id,
                "username": username
            }),
        )
        .ok();
}

// 16. member_left - Broadcast when a user leaves a room
pub fn broadcast_member_left(socket: &SocketRef, room_id: Uuid, user_id: Uuid, username: &str) {
    socket
        .within(room_id.to_string())
        .emit(
            "member_left",
            serde_json::json!({
                "roomId": room_id,
                "userId": user_id,
                "username": username
            }),
        )
        .ok();
}

// 17. member_removed - Broadcast when a user is removed from a room
pub fn broadcast_member_removed(socket: &SocketRef, room_id: Uuid, user_id: Uuid) {
    socket
        .within(room_id.to_string())
        .emit(
            "member_removed",
            serde_json::json!({
                "roomId": room_id,
                "userId": user_id
            }),
        )
        .ok();
}

// 18. user_banned - Broadcast when a user is banned
pub fn broadcast_user_banned(socket: &SocketRef, user_id: Uuid) {
    socket
        .broadcast()
        .emit(
            "user_banned",
            serde_json::json!({
                "userId": user_id
            }),
        )
        .ok();
}
