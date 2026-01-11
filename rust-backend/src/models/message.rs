use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Message {
    pub id: Uuid,
    pub room_id: Uuid,
    pub sender_id: Uuid,
    pub encrypted_content: String,
    pub message_type: String,
    pub metadata: serde_json::Value,
    pub attachments: Vec<String>,
    pub parent_message_id: Option<Uuid>,
    pub is_edited: bool,
    pub edited_at: Option<DateTime<Utc>>,
    pub is_deleted: bool,
    pub deleted_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct SendMessageRequest {
    pub room_id: Uuid,

    #[validate(length(min = 1))]
    pub encrypted_content: String,

    pub message_type: Option<String>,
    pub attachments: Option<Vec<String>>,
    pub parent_message_id: Option<Uuid>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct EditMessageRequest {
    #[validate(length(min = 1))]
    pub encrypted_content: String,
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
    pub encrypted_content: String,
    pub message_type: String,
    pub metadata: serde_json::Value,
    pub attachments: Vec<String>,
    pub parent_message_id: Option<Uuid>,
    pub is_edited: bool,
    pub edited_at: Option<DateTime<Utc>>,
    pub is_deleted: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct SenderInfo {
    pub id: Uuid,
    pub username: String,
    pub display_name: Option<String>,
    pub avatar: Option<String>,
}
