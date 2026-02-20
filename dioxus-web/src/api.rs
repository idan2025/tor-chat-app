use crate::models::{LoginRequest, Message, RegisterRequest, Room, User};
use crate::utils::storage;
use reqwest::Client;
use serde_json::Value;

pub struct ApiClient {
    client: Client,
    base_url: String,
}

impl ApiClient {
    pub fn new() -> Self {
        let base_url = Self::get_base_url();

        Self {
            client: Client::new(),
            base_url,
        }
    }

    fn get_base_url() -> String {
        // Use stored server URL, or fall back to current window origin
        // reqwest 0.13 requires absolute URLs
        storage::get_server_url().unwrap_or_else(|| {
            web_sys::window()
                .and_then(|w| w.location().origin().ok())
                .unwrap_or_default()
        })
    }

    fn get_auth_header(&self) -> Option<String> {
        storage::get_token().map(|token| format!("Bearer {}", token))
    }

    async fn request(&self, method: reqwest::Method, path: &str) -> reqwest::RequestBuilder {
        let url = format!("{}{}", self.base_url, path);
        let mut req = self.client.request(method, &url);

        if let Some(auth) = self.get_auth_header() {
            req = req.header("Authorization", auth);
        }

        req
    }

    // Auth endpoints
    pub async fn register(&self, req: RegisterRequest) -> Result<Value, String> {
        let response = self
            .request(reqwest::Method::POST, "/api/auth/register")
            .await
            .json(&req)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if response.status().is_success() {
            response.json().await.map_err(|e| e.to_string())
        } else {
            Err(format!("Registration failed: {}", response.status()))
        }
    }

    pub async fn login(&self, req: LoginRequest) -> Result<Value, String> {
        let response = self
            .request(reqwest::Method::POST, "/api/auth/login")
            .await
            .json(&req)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if response.status().is_success() {
            response.json().await.map_err(|e| e.to_string())
        } else {
            Err(format!("Login failed: {}", response.status()))
        }
    }

    pub async fn logout(&self) -> Result<(), String> {
        let response = self
            .request(reqwest::Method::POST, "/api/auth/logout")
            .await
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if response.status().is_success() {
            Ok(())
        } else {
            Err(format!("Logout failed: {}", response.status()))
        }
    }

    pub async fn get_me(&self) -> Result<User, String> {
        let response = self
            .request(reqwest::Method::GET, "/api/auth/me")
            .await
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if response.status().is_success() {
            let data: Value = response.json().await.map_err(|e| e.to_string())?;
            serde_json::from_value(data["user"].clone()).map_err(|e| e.to_string())
        } else {
            Err(format!("Failed to get user: {}", response.status()))
        }
    }

    // Room endpoints
    pub async fn get_rooms(&self) -> Result<Vec<Room>, String> {
        let response = self
            .request(reqwest::Method::GET, "/api/rooms")
            .await
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if response.status().is_success() {
            let data: Value = response.json().await.map_err(|e| e.to_string())?;
            serde_json::from_value(data["rooms"].clone()).map_err(|e| e.to_string())
        } else {
            Err(format!("Failed to get rooms: {}", response.status()))
        }
    }

    pub async fn create_room(
        &self,
        name: String,
        description: Option<String>,
        is_public: bool,
    ) -> Result<Room, String> {
        let body = serde_json::json!({
            "name": name,
            "description": description,
            "isPublic": is_public,
        });

        let response = self
            .request(reqwest::Method::POST, "/api/rooms")
            .await
            .json(&body)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if response.status().is_success() {
            let data: Value = response.json().await.map_err(|e| e.to_string())?;
            serde_json::from_value(data["room"].clone()).map_err(|e| e.to_string())
        } else {
            Err(format!("Failed to create room: {}", response.status()))
        }
    }

    pub async fn get_room_messages(
        &self,
        room_id: &str,
        limit: usize,
        offset: usize,
    ) -> Result<Vec<Message>, String> {
        let url = format!(
            "/api/rooms/{}/messages?limit={}&offset={}",
            room_id, limit, offset
        );
        let response = self
            .request(reqwest::Method::GET, &url)
            .await
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if response.status().is_success() {
            let data: Value = response.json().await.map_err(|e| e.to_string())?;
            serde_json::from_value(data["messages"].clone()).map_err(|e| e.to_string())
        } else {
            Err(format!("Failed to get messages: {}", response.status()))
        }
    }

    pub async fn join_room(&self, room_id: &str) -> Result<(), String> {
        let response = self
            .request(
                reqwest::Method::POST,
                &format!("/api/rooms/{}/join", room_id),
            )
            .await
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if response.status().is_success() {
            Ok(())
        } else {
            Err(format!("Failed to join room: {}", response.status()))
        }
    }

    // Admin endpoints
    pub async fn admin_get_stats(&self) -> Result<Value, String> {
        let response = self
            .request(reqwest::Method::GET, "/api/admin/stats")
            .await
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if response.status().is_success() {
            response.json().await.map_err(|e| e.to_string())
        } else {
            Err(format!("Failed to get stats: {}", response.status()))
        }
    }

    pub async fn admin_get_users(&self) -> Result<Vec<User>, String> {
        let response = self
            .request(reqwest::Method::GET, "/api/admin/users")
            .await
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if response.status().is_success() {
            let data: Value = response.json().await.map_err(|e| e.to_string())?;
            serde_json::from_value(data["users"].clone()).map_err(|e| e.to_string())
        } else {
            Err(format!("Failed to get users: {}", response.status()))
        }
    }

    pub async fn admin_ban_user(&self, user_id: &str) -> Result<(), String> {
        let response = self
            .request(
                reqwest::Method::POST,
                &format!("/api/admin/users/{}/ban", user_id),
            )
            .await
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if response.status().is_success() {
            Ok(())
        } else {
            Err(format!("Failed to ban user: {}", response.status()))
        }
    }

    pub async fn leave_room(&self, room_id: &str) -> Result<(), String> {
        let response = self
            .request(
                reqwest::Method::POST,
                &format!("/api/rooms/{}/leave", room_id),
            )
            .await
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if response.status().is_success() {
            Ok(())
        } else {
            Err(format!("Failed to leave room: {}", response.status()))
        }
    }

    pub async fn delete_room(&self, room_id: &str) -> Result<(), String> {
        let response = self
            .request(reqwest::Method::DELETE, &format!("/api/rooms/{}", room_id))
            .await
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if response.status().is_success() {
            Ok(())
        } else {
            Err(format!("Failed to delete room: {}", response.status()))
        }
    }

    pub async fn get_room_members(&self, room_id: &str) -> Result<Vec<Value>, String> {
        let response = self
            .request(
                reqwest::Method::GET,
                &format!("/api/rooms/{}/members", room_id),
            )
            .await
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if response.status().is_success() {
            let data: Value = response.json().await.map_err(|e| e.to_string())?;
            serde_json::from_value(data["members"].clone()).map_err(|e| e.to_string())
        } else {
            Err(format!("Failed to get members: {}", response.status()))
        }
    }

    pub async fn admin_promote_user(&self, user_id: &str) -> Result<(), String> {
        let response = self
            .request(
                reqwest::Method::POST,
                &format!("/api/admin/users/{}/promote", user_id),
            )
            .await
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if response.status().is_success() {
            Ok(())
        } else {
            Err(format!("Failed to promote user: {}", response.status()))
        }
    }

    pub async fn admin_demote_user(&self, user_id: &str) -> Result<(), String> {
        let response = self
            .request(
                reqwest::Method::POST,
                &format!("/api/admin/users/{}/demote", user_id),
            )
            .await
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if response.status().is_success() {
            Ok(())
        } else {
            Err(format!("Failed to demote user: {}", response.status()))
        }
    }

    pub async fn admin_unban_user(&self, user_id: &str) -> Result<(), String> {
        let response = self
            .request(
                reqwest::Method::POST,
                &format!("/api/admin/users/{}/unban", user_id),
            )
            .await
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if response.status().is_success() {
            Ok(())
        } else {
            Err(format!("Failed to unban user: {}", response.status()))
        }
    }

    pub async fn admin_delete_user(&self, user_id: &str) -> Result<(), String> {
        let response = self
            .request(
                reqwest::Method::DELETE,
                &format!("/api/admin/users/{}", user_id),
            )
            .await
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if response.status().is_success() {
            Ok(())
        } else {
            Err(format!("Failed to delete user: {}", response.status()))
        }
    }

    pub async fn admin_get_rooms(&self) -> Result<Vec<Value>, String> {
        let response = self
            .request(reqwest::Method::GET, "/api/admin/rooms")
            .await
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if response.status().is_success() {
            let data: Value = response.json().await.map_err(|e| e.to_string())?;
            serde_json::from_value(data["rooms"].clone()).map_err(|e| e.to_string())
        } else {
            Err(format!("Failed to get rooms: {}", response.status()))
        }
    }

    pub async fn admin_delete_room(&self, room_id: &str) -> Result<(), String> {
        let response = self
            .request(
                reqwest::Method::DELETE,
                &format!("/api/admin/rooms/{}", room_id),
            )
            .await
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if response.status().is_success() {
            Ok(())
        } else {
            Err(format!("Failed to delete room: {}", response.status()))
        }
    }
}

impl Default for ApiClient {
    fn default() -> Self {
        Self::new()
    }
}
