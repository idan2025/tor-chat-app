use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub email: Option<String>,
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
    pub avatar: Option<String>,
    #[serde(rename = "publicKey")]
    pub public_key: Option<String>,
    #[serde(rename = "isOnline")]
    pub is_online: bool,
    #[serde(rename = "lastSeen")]
    pub last_seen: Option<DateTime<Utc>>,
    #[serde(rename = "isAdmin")]
    pub is_admin: bool,
    #[serde(rename = "isBanned")]
    pub is_banned: bool,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Room {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "isPublic")]
    pub is_public: bool,
    #[serde(rename = "creatorId")]
    pub creator_id: Uuid,
    #[serde(rename = "roomKey")]
    pub room_key: Option<String>,
    #[serde(rename = "maxMembers")]
    pub max_members: i32,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: Uuid,
    #[serde(rename = "roomId")]
    pub room_id: Uuid,
    #[serde(rename = "userId")]
    pub user_id: Uuid,
    pub content: String,
    #[serde(rename = "messageType")]
    pub message_type: String,
    #[serde(rename = "replyTo")]
    pub reply_to: Option<Uuid>,
    #[serde(rename = "forwardedFrom")]
    pub forwarded_from: Option<Uuid>,
    pub reactions: serde_json::Value,
    pub metadata: Option<serde_json::Value>,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
    #[serde(rename = "updatedAt")]
    pub updated_at: Option<DateTime<Utc>>,
    pub user: Option<User>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub email: String,
    pub password: String,
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
}
