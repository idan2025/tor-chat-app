use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Message {
    pub id: Uuid,
    pub room_id: Uuid,
    pub user_id: Uuid,
    pub content: String,
    pub message_type: String,
    pub reply_to: Option<Uuid>,
    pub forwarded_from: Option<Uuid>,
    pub reactions: serde_json::Value,
    pub metadata: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct SendMessageRequest {
    pub room_id: Uuid,

    #[validate(length(min = 1))]
    pub content: String,

    pub message_type: Option<String>,
    pub reply_to: Option<Uuid>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct EditMessageRequest {
    #[validate(length(min = 1))]
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct AddReactionRequest {
    pub emoji: String,
}

#[derive(Debug, Serialize)]
pub struct MessageResponse {
    pub id: Uuid,
    pub room_id: Uuid,
    pub sender: SenderInfo,
    pub content: String,
    pub message_type: String,
    pub reply_to: Option<Uuid>,
    pub forwarded_from: Option<Uuid>,
    pub reactions: serde_json::Value,
    pub metadata: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct SenderInfo {
    pub id: Uuid,
    pub username: String,
    pub display_name: Option<String>,
    pub avatar: Option<String>,
}
