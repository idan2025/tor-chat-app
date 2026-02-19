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
    #[sqlx(rename = "type")]
    pub room_type: String,
    pub encryption_key: String,
    pub creator_id: Option<Uuid>,
    pub max_members: i32,
    pub is_public: bool,
    pub avatar: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateRoomRequest {
    #[validate(length(min = 1, max = 100))]
    pub name: String,

    #[validate(length(max = 500))]
    pub description: Option<String>,

    #[serde(rename = "type")]
    pub room_type: Option<String>,

    #[validate(range(min = 2, max = 1000))]
    pub max_members: Option<i32>,

    pub is_public: Option<bool>,

    pub avatar: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RoomResponse {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub room_type: String,
    pub room_key: Option<String>,
    pub creator_id: Option<Uuid>,
    pub max_members: i32,
    pub is_public: bool,
    pub avatar: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl Room {
    pub fn to_public_json(&self) -> RoomResponse {
        RoomResponse {
            id: self.id,
            name: self.name.clone(),
            description: self.description.clone(),
            room_type: self.room_type.clone(),
            room_key: None,
            creator_id: self.creator_id,
            max_members: self.max_members,
            is_public: self.is_public,
            avatar: self.avatar.clone(),
            created_at: self.created_at,
        }
    }

    pub fn to_member_json(&self) -> RoomResponse {
        RoomResponse {
            id: self.id,
            name: self.name.clone(),
            description: self.description.clone(),
            room_type: self.room_type.clone(),
            room_key: Some(self.encryption_key.clone()),
            creator_id: self.creator_id,
            max_members: self.max_members,
            is_public: self.is_public,
            avatar: self.avatar.clone(),
            created_at: self.created_at,
        }
    }
}
