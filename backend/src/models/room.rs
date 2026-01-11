use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Room {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub room_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub encryption_key: Option<String>,
    pub creator_id: Option<Uuid>,
    pub max_members: i32,
    pub avatar: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateRoomRequest {
    #[validate(length(min = 1, max = 100))]
    pub name: String,

    pub description: Option<String>,

    #[serde(rename = "type")]
    #[validate(custom = "validate_room_type")]
    pub room_type: String,

    #[validate(range(min = 2, max = 1000))]
    pub max_members: Option<i32>,

    pub avatar: Option<String>,
}

fn validate_room_type(room_type: &str) -> Result<(), validator::ValidationError> {
    if room_type == "public" || room_type == "private" {
        Ok(())
    } else {
        Err(validator::ValidationError::new("invalid_room_type"))
    }
}

#[derive(Debug, Serialize)]
pub struct RoomResponse {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub room_type: String,
    pub encryption_key: Option<String>,
    pub creator_id: Option<Uuid>,
    pub max_members: i32,
    pub avatar: Option<String>,
    pub member_count: Option<i64>,
    pub created_at: DateTime<Utc>,
}
