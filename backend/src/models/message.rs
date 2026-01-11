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
pub struct CreateMessageRequest {
    pub room_id: Uuid,

    #[validate(length(min = 1))]
    pub encrypted_content: String,

    #[validate(custom = "validate_message_type")]
    pub message_type: String,

    pub attachments: Option<Vec<String>>,
    pub parent_message_id: Option<Uuid>,
}

fn validate_message_type(message_type: &str) -> Result<(), validator::ValidationError> {
    let valid_types = ["text", "file", "image", "video", "system"];
    if valid_types.contains(&message_type) {
        Ok(())
    } else {
        Err(validator::ValidationError::new("invalid_message_type"))
    }
}

#[derive(Debug, Deserialize)]
pub struct EditMessageRequest {
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
    pub sender_id: Uuid,
    pub sender_username: String,
    pub sender_display_name: Option<String>,
    pub sender_avatar: Option<String>,
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
