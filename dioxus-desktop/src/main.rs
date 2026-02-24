#![allow(non_snake_case)]

mod tor_manager;

use chrono::{DateTime, Utc};
use dioxus::prelude::*;
use futures_util::{SinkExt, StreamExt};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tokio_tungstenite::tungstenite;
use uuid::Uuid;

use tor_manager::{TorManager, TorStatus};

// ============================================
// Models
// ============================================

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub email: Option<String>,
    #[serde(rename = "displayName", alias = "display_name")]
    pub display_name: Option<String>,
    pub avatar: Option<String>,
    #[serde(rename = "publicKey", alias = "public_key")]
    pub public_key: Option<String>,
    #[serde(rename = "isOnline", alias = "is_online", default)]
    pub is_online: bool,
    #[serde(rename = "lastSeen", alias = "last_seen")]
    pub last_seen: Option<DateTime<Utc>>,
    #[serde(rename = "isAdmin", alias = "is_admin", default)]
    pub is_admin: bool,
    #[serde(rename = "isBanned", alias = "is_banned", default)]
    pub is_banned: bool,
    #[serde(rename = "createdAt", alias = "created_at")]
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Room {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "isPublic", alias = "is_public", default)]
    pub is_public: bool,
    #[serde(rename = "creatorId", alias = "creator_id")]
    pub creator_id: Option<Uuid>,
    #[serde(
        rename = "encryptionKey",
        alias = "encryption_key",
        alias = "roomKey",
        alias = "room_key"
    )]
    pub encryption_key: Option<String>,
    #[serde(rename = "maxMembers", alias = "max_members", default)]
    pub max_members: i32,
    #[serde(rename = "createdAt", alias = "created_at")]
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: Uuid,
    #[serde(rename = "roomId", alias = "room_id")]
    pub room_id: Uuid,
    #[serde(
        rename = "userId",
        alias = "user_id",
        alias = "senderId",
        alias = "sender_id"
    )]
    pub user_id: Uuid,
    #[serde(alias = "encryptedContent", alias = "encrypted_content")]
    pub content: String,
    #[serde(rename = "messageType", alias = "message_type", default)]
    pub message_type: String,
    #[serde(rename = "createdAt", alias = "created_at")]
    pub created_at: Option<DateTime<Utc>>,
    pub user: Option<User>,
}

// ============================================
// Storage
// ============================================

fn get_config_dir() -> PathBuf {
    directories::ProjectDirs::from("com", "torchat", "desktop")
        .map(|dirs| dirs.config_dir().to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."))
}

fn get_config_path() -> PathBuf {
    get_config_dir().join("config.json")
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppConfig {
    pub server_url: Option<String>,
    pub token: Option<String>,
}

fn load_config() -> AppConfig {
    let path = get_config_path();
    if path.exists() {
        fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    } else {
        AppConfig::default()
    }
}

fn save_config(config: &AppConfig) {
    let path = get_config_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let _ = fs::write(
        &path,
        serde_json::to_string_pretty(config).unwrap_or_default(),
    );
}

// ============================================
// Socket.IO Client (Engine.IO over WebSocket)
// ============================================

/// Socket event received from the server
#[derive(Debug, Clone)]
pub struct SocketEvent {
    pub name: String,
    pub payload: Value,
}

/// Channel-based socket client that communicates with the backend's Socket.IO server.
/// Events are delivered via an mpsc channel so the UI thread can poll them.
#[derive(Clone)]
pub struct SocketClient {
    sender: Arc<RwLock<Option<mpsc::UnboundedSender<String>>>>,
    connected: Arc<RwLock<bool>>,
}

impl SocketClient {
    pub fn new() -> Self {
        Self {
            sender: Arc::new(RwLock::new(None)),
            connected: Arc::new(RwLock::new(false)),
        }
    }

    /// Connect to the Socket.IO server. Returns a receiver for incoming events.
    pub async fn connect(
        &self,
        server_url: &str,
        token: &str,
    ) -> mpsc::UnboundedReceiver<SocketEvent> {
        let (event_tx, event_rx) = mpsc::unbounded_channel::<SocketEvent>();

        // Build Engine.IO WebSocket URL
        let ws_url = server_url
            .replace("http://", "ws://")
            .replace("https://", "wss://");
        let url = format!(
            "{}/socket.io/?EIO=4&transport=websocket",
            ws_url.trim_end_matches('/')
        );

        let connect_result = tokio_tungstenite::connect_async(&url).await;
        let (ws_stream, _) = match connect_result {
            Ok(r) => r,
            Err(e) => {
                tracing::error!("WebSocket connect failed: {}", e);
                return event_rx;
            }
        };

        let (mut write, mut read) = ws_stream.split();
        let (tx, mut rx) = mpsc::unbounded_channel::<String>();

        *self.sender.write().await = Some(tx.clone());
        *self.connected.write().await = true;

        let connected = self.connected.clone();
        let token = token.to_string();

        // Spawn writer task
        let writer_connected = connected.clone();
        tokio::spawn(async move {
            while let Some(msg) = rx.recv().await {
                if write
                    .send(tungstenite::Message::Text(msg.into()))
                    .await
                    .is_err()
                {
                    break;
                }
            }
            *writer_connected.write().await = false;
        });

        // Spawn reader task
        let ws_sender = tx;
        tokio::spawn(async move {
            let mut engine_io_open = false;

            while let Some(msg_result) = read.next().await {
                let msg = match msg_result {
                    Ok(tungstenite::Message::Text(t)) => t.to_string(),
                    Ok(tungstenite::Message::Ping(_)) => continue,
                    Ok(tungstenite::Message::Close(_)) => break,
                    Err(_) => break,
                    _ => continue,
                };

                // Engine.IO protocol:
                // '0' = open, '2' = ping, '3' = pong, '4' = message (Socket.IO)
                if msg.starts_with('0') && !engine_io_open {
                    engine_io_open = true;
                    continue;
                }

                if msg == "2" {
                    // Engine.IO ping -> respond with pong
                    let _ = ws_sender.send("3".to_string());
                    continue;
                }

                if msg.starts_with("40") {
                    // Socket.IO CONNECT acknowledgment - authenticate
                    let auth_payload = serde_json::json!({"token": token});
                    let auth_msg = format!("42[\"authenticate\",{}]", auth_payload);
                    let _ = ws_sender.send(auth_msg);
                    continue;
                }

                if msg.starts_with("42") {
                    // Socket.IO EVENT packet
                    let json_part = &msg[2..];
                    if let Ok(arr) = serde_json::from_str::<Vec<Value>>(json_part) {
                        if arr.len() >= 2 {
                            if let Some(event_name) = arr[0].as_str() {
                                let _ = event_tx.send(SocketEvent {
                                    name: event_name.to_string(),
                                    payload: arr[1].clone(),
                                });
                            }
                        }
                    }
                }
            }

            *connected.write().await = false;
        });

        event_rx
    }

    pub async fn send_event(&self, event: &str, data: &Value) {
        if let Some(tx) = self.sender.read().await.as_ref() {
            let msg = format!("42[\"{}\",{}]", event, data);
            let _ = tx.send(msg);
        }
    }

    pub async fn is_connected(&self) -> bool {
        *self.connected.read().await
    }

    pub async fn disconnect(&self) {
        *self.sender.write().await = None;
        *self.connected.write().await = false;
    }
}

// ============================================
// API Client
// ============================================

#[derive(Clone)]
pub struct ApiClient {
    clearnet_client: Client,
    tor_client: Arc<RwLock<Option<Client>>>,
    use_tor: Arc<RwLock<bool>>,
    base_url: Arc<RwLock<String>>,
    token: Arc<RwLock<Option<String>>>,
}

impl ApiClient {
    pub fn new(base_url: String, token: Option<String>) -> Self {
        Self {
            clearnet_client: Client::new(),
            tor_client: Arc::new(RwLock::new(None)),
            use_tor: Arc::new(RwLock::new(false)),
            base_url: Arc::new(RwLock::new(base_url)),
            token: Arc::new(RwLock::new(token)),
        }
    }

    pub async fn set_base_url(&self, url: String) {
        *self.base_url.write().await = url;
    }

    pub async fn get_base_url(&self) -> String {
        self.base_url.read().await.clone()
    }

    pub async fn set_token(&self, token: Option<String>) {
        *self.token.write().await = token;
    }

    pub async fn get_token(&self) -> Option<String> {
        self.token.read().await.clone()
    }

    /// Configure a reqwest Client that routes through the local SOCKS5 proxy
    pub async fn configure_tor_proxy(&self, socks_port: u16) {
        let proxy = reqwest::Proxy::all(format!("socks5h://127.0.0.1:{}", socks_port))
            .expect("Invalid SOCKS5 proxy URL");
        let client = Client::builder()
            .proxy(proxy)
            .build()
            .expect("Failed to build Tor HTTP client");
        *self.tor_client.write().await = Some(client);
        *self.use_tor.write().await = true;
    }

    /// Disable Tor proxy, revert to clearnet
    pub async fn disable_tor_proxy(&self) {
        *self.use_tor.write().await = false;
        *self.tor_client.write().await = None;
    }

    async fn request(&self, method: reqwest::Method, path: &str) -> reqwest::RequestBuilder {
        let base = self.base_url.read().await.clone();
        let url = format!("{}{}", base, path);

        let client = if *self.use_tor.read().await {
            self.tor_client
                .read()
                .await
                .as_ref()
                .cloned()
                .unwrap_or_else(|| self.clearnet_client.clone())
        } else {
            self.clearnet_client.clone()
        };

        let mut req = client.request(method, &url);

        if let Some(token) = self.token.read().await.as_ref() {
            req = req.header("Authorization", format!("Bearer {}", token));
        }

        req
    }

    pub async fn health_check(&self) -> Result<(), String> {
        let response = self
            .request(reqwest::Method::GET, "/health")
            .await
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if response.status().is_success() {
            Ok(())
        } else {
            Err(format!("Server not responding: {}", response.status()))
        }
    }

    pub async fn register(
        &self,
        username: &str,
        email: &str,
        password: &str,
    ) -> Result<Value, String> {
        let body = serde_json::json!({
            "username": username,
            "email": email,
            "password": password
        });

        let response = self
            .request(reqwest::Method::POST, "/api/auth/register")
            .await
            .json(&body)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if response.status().is_success() {
            response.json().await.map_err(|e| e.to_string())
        } else {
            let status = response.status();
            let body: Value = response.json().await.unwrap_or_default();
            Err(body["details"]
                .as_str()
                .unwrap_or(&format!("Registration failed: {}", status))
                .to_string())
        }
    }

    pub async fn login(&self, username: &str, password: &str) -> Result<Value, String> {
        let body = serde_json::json!({
            "username": username,
            "password": password
        });

        let response = self
            .request(reqwest::Method::POST, "/api/auth/login")
            .await
            .json(&body)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if response.status().is_success() {
            response.json().await.map_err(|e| e.to_string())
        } else {
            let status = response.status();
            let body: Value = response.json().await.unwrap_or_default();
            Err(body["details"]
                .as_str()
                .unwrap_or(&format!("Login failed: {}", status))
                .to_string())
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
            Err("Failed to get user".to_string())
        }
    }

    pub async fn get_rooms(&self) -> Result<Vec<Room>, String> {
        let response = self
            .request(reqwest::Method::GET, "/api/rooms")
            .await
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if response.status().is_success() {
            let data: Value = response.json().await.map_err(|e| e.to_string())?;
            serde_json::from_value(data["rooms"].clone())
                .unwrap_or_else(|_| Vec::new())
                .pipe(Ok)
        } else {
            Ok(Vec::new())
        }
    }

    pub async fn create_room(
        &self,
        name: &str,
        description: Option<&str>,
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
            let status = response.status();
            let body: Value = response.json().await.unwrap_or_default();
            Err(body["details"]
                .as_str()
                .or_else(|| body["error"].as_str())
                .unwrap_or(&format!("Failed to create room: {}", status))
                .to_string())
        }
    }

    pub async fn get_room(&self, room_id: &str) -> Result<Room, String> {
        let response = self
            .request(reqwest::Method::GET, &format!("/api/rooms/{}", room_id))
            .await
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if response.status().is_success() {
            let data: Value = response.json().await.map_err(|e| e.to_string())?;
            serde_json::from_value(data["room"].clone()).map_err(|e| e.to_string())
        } else {
            Err("Failed to get room".to_string())
        }
    }

    pub async fn get_messages(&self, room_id: &str) -> Result<Vec<Message>, String> {
        let response = self
            .request(
                reqwest::Method::GET,
                &format!("/api/rooms/{}/messages?limit=50", room_id),
            )
            .await
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if response.status().is_success() {
            let data: Value = response.json().await.map_err(|e| e.to_string())?;
            serde_json::from_value(data["messages"].clone())
                .unwrap_or_else(|_| Vec::new())
                .pipe(Ok)
        } else {
            Ok(Vec::new())
        }
    }

    pub async fn send_message(&self, room_id: &str, content: &str) -> Result<Message, String> {
        let body = serde_json::json!({
            "content": content,
            "messageType": "text"
        });

        let response = self
            .request(
                reqwest::Method::POST,
                &format!("/api/rooms/{}/messages", room_id),
            )
            .await
            .json(&body)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if response.status().is_success() {
            let data: Value = response.json().await.map_err(|e| e.to_string())?;
            serde_json::from_value(data["message"].clone()).map_err(|e| e.to_string())
        } else {
            Err("Failed to send message".to_string())
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
            let body: Value = response.json().await.unwrap_or_default();
            Err(body["error"]
                .as_str()
                .unwrap_or("Failed to leave room")
                .to_string())
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
            Err("Failed to delete room".to_string())
        }
    }

    pub async fn get_members(&self, room_id: &str) -> Result<Vec<Value>, String> {
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
            Ok(Vec::new())
        }
    }

    pub async fn get_users(&self) -> Result<Vec<Value>, String> {
        let response = self
            .request(reqwest::Method::GET, "/api/auth/users")
            .await
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if response.status().is_success() {
            let data: Value = response.json().await.map_err(|e| e.to_string())?;
            serde_json::from_value(data["users"].clone()).map_err(|e| e.to_string())
        } else {
            Ok(Vec::new())
        }
    }

    pub async fn add_member(&self, room_id: &str, user_id: &str) -> Result<(), String> {
        let body = serde_json::json!({ "userId": user_id });
        let response = self
            .request(
                reqwest::Method::POST,
                &format!("/api/rooms/{}/members", room_id),
            )
            .await
            .json(&body)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if response.status().is_success() {
            Ok(())
        } else {
            let body: Value = response.json().await.unwrap_or_default();
            Err(body["error"]
                .as_str()
                .unwrap_or("Failed to add member")
                .to_string())
        }
    }

    pub async fn remove_member(&self, room_id: &str, user_id: &str) -> Result<(), String> {
        let response = self
            .request(
                reqwest::Method::DELETE,
                &format!("/api/rooms/{}/members/{}", room_id, user_id),
            )
            .await
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if response.status().is_success() {
            Ok(())
        } else {
            Err("Failed to remove member".to_string())
        }
    }
}

trait Pipe: Sized {
    fn pipe<R, F: FnOnce(Self) -> R>(self, f: F) -> R {
        f(self)
    }
}
impl<T> Pipe for T {}

// ============================================
// App State (using Signal-friendly pattern)
// ============================================

#[derive(Clone)]
pub struct AppState {
    pub api: ApiClient,
    pub socket: SocketClient,
    pub tor_manager: Arc<TorManager>,
    pub server_url: Arc<RwLock<String>>,
}

impl AppState {
    pub fn new(server_url: String, token: Option<String>) -> Self {
        Self {
            api: ApiClient::new(server_url.clone(), token),
            socket: SocketClient::new(),
            tor_manager: Arc::new(TorManager::new()),
            server_url: Arc::new(RwLock::new(server_url)),
        }
    }

    pub async fn clear_auth(&self) {
        self.api.set_token(None).await;
        self.socket.disconnect().await;
    }
}

// ============================================
// Router
// ============================================

#[derive(Debug, Clone, Routable, PartialEq)]
enum Route {
    #[route("/")]
    Settings {},
    #[route("/login")]
    Login {},
    #[route("/register")]
    Register {},
    #[route("/chat")]
    Chat {},
}

// ============================================
// Main App
// ============================================

fn main() {
    tracing_subscriber::fmt::init();

    dioxus::launch(App);
}

#[component]
fn App() -> Element {
    // Load config
    let config = load_config();
    let server_url = config
        .server_url
        .clone()
        .unwrap_or_else(|| "http://localhost:3000".to_string());
    let token = config.token.clone();

    // Create global state — AppState is cheap to clone (all Arc inside)
    let state = use_signal(|| AppState::new(server_url, token));

    // Provide state to all components
    use_context_provider(|| state);

    rsx! {
        Router::<Route> {}
    }
}

// ============================================
// CSS Styles (inline)
// ============================================

const STYLES: &str = r#"
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1a1a2e; color: #eee; }
.container { max-width: 400px; margin: 50px auto; padding: 20px; }
.card { background: #16213e; border-radius: 12px; padding: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
.title { font-size: 28px; text-align: center; margin-bottom: 10px; color: #9d4edd; }
.subtitle { text-align: center; color: #888; margin-bottom: 25px; font-size: 14px; }
.form-group { margin-bottom: 18px; }
.label { display: block; margin-bottom: 6px; color: #aaa; font-size: 13px; }
.input { width: 100%; padding: 12px 14px; border: 1px solid #333; border-radius: 8px; background: #0f0f23; color: #fff; font-size: 15px; outline: none; }
.input:focus { border-color: #9d4edd; }
.btn { width: 100%; padding: 14px; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.btn-primary { background: linear-gradient(135deg, #9d4edd, #7b2cbf); color: #fff; }
.btn-primary:hover { transform: translateY(-2px); box-shadow: 0 4px 15px rgba(157,78,221,0.4); }
.btn-secondary { background: #333; color: #fff; margin-top: 10px; }
.btn-secondary:hover { background: #444; }
.btn-small { width: auto; padding: 6px 12px; font-size: 12px; }
.btn-danger { background: #ff6b6b; color: #fff; }
.btn-danger:hover { background: #e05555; }
.btn-warning { background: #ffa726; color: #fff; }
.btn-warning:hover { background: #e09020; }
.error { background: #ff6b6b22; border: 1px solid #ff6b6b; color: #ff6b6b; padding: 12px; border-radius: 8px; margin-bottom: 15px; font-size: 14px; }
.success { background: #51cf6622; border: 1px solid #51cf66; color: #51cf66; padding: 12px; border-radius: 8px; margin-bottom: 15px; font-size: 14px; }
.link { color: #9d4edd; text-decoration: none; cursor: pointer; }
.link:hover { text-decoration: underline; }
.text-center { text-align: center; margin-top: 15px; font-size: 14px; color: #888; }
.chat-container { display: flex; height: 100vh; }
.sidebar { width: 280px; background: #16213e; border-right: 1px solid #333; display: flex; flex-direction: column; }
.sidebar-header { padding: 20px; border-bottom: 1px solid #333; }
.sidebar-title { font-size: 18px; font-weight: 600; color: #9d4edd; }
.room-list { flex: 1; overflow-y: auto; }
.room-item { padding: 15px 20px; border-bottom: 1px solid #222; cursor: pointer; transition: background 0.2s; }
.room-item:hover { background: #1a1a2e; }
.room-item.active { background: #9d4edd22; border-left: 3px solid #9d4edd; }
.room-name { font-weight: 500; margin-bottom: 4px; display: flex; align-items: center; gap: 8px; }
.room-desc { font-size: 12px; color: #666; }
.badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600; }
.badge-public { background: #51cf6633; color: #51cf66; }
.badge-private { background: #ffa72633; color: #ffa726; }
.main-content { flex: 1; display: flex; flex-direction: column; background: #1a1a2e; }
.chat-header { padding: 20px; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center; }
.chat-title { font-size: 18px; font-weight: 600; }
.chat-actions { display: flex; gap: 8px; }
.messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 12px; }
.message { max-width: 70%; padding: 12px 16px; border-radius: 12px; }
.message-own { align-self: flex-end; background: #9d4edd; color: #fff; border-bottom-right-radius: 4px; }
.message-other { align-self: flex-start; background: #333; border-bottom-left-radius: 4px; }
.message-user { font-size: 12px; font-weight: 600; margin-bottom: 4px; opacity: 0.8; }
.message-content { font-size: 14px; line-height: 1.4; word-wrap: break-word; }
.message-time { font-size: 10px; opacity: 0.6; margin-top: 4px; }
.message-input-area { padding: 20px; border-top: 1px solid #333; display: flex; gap: 12px; }
.message-input { flex: 1; padding: 14px; border: 1px solid #333; border-radius: 24px; background: #0f0f23; color: #fff; font-size: 14px; outline: none; }
.message-input:focus { border-color: #9d4edd; }
.send-btn { padding: 14px 24px; background: #9d4edd; color: #fff; border: none; border-radius: 24px; cursor: pointer; font-weight: 600; }
.send-btn:hover { background: #7b2cbf; }
.empty-state { flex: 1; display: flex; align-items: center; justify-content: center; color: #666; font-size: 16px; }
.new-room-btn { margin: 15px 20px; padding: 10px; background: #333; border: 1px dashed #555; border-radius: 8px; color: #aaa; cursor: pointer; text-align: center; font-size: 13px; }
.new-room-btn:hover { background: #3a3a5a; border-color: #9d4edd; color: #9d4edd; }
.user-info { padding: 15px 20px; border-top: 1px solid #333; display: flex; justify-content: space-between; align-items: center; }
.username { font-weight: 500; }
.logout-btn { padding: 6px 12px; background: #ff6b6b22; color: #ff6b6b; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; }
.logout-btn:hover { background: #ff6b6b33; }
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: #16213e; border-radius: 12px; padding: 30px; width: 90%; max-width: 400px; }
.modal-title { font-size: 20px; margin-bottom: 20px; text-align: center; color: #9d4edd; }
.btn-cancel { background: #333; }
.tor-indicator { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 8px; margin-bottom: 15px; font-size: 13px; }
.tor-indicator.onion { background: #9d4edd22; border: 1px solid #9d4edd; color: #c77dff; }
.tor-indicator.clearnet { background: #33333344; border: 1px solid #555; color: #888; }
.progress-bar { width: 100%; height: 6px; background: #333; border-radius: 3px; overflow: hidden; margin-top: 8px; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #9d4edd, #c77dff); border-radius: 3px; transition: width 0.3s ease; }
.tor-status { font-size: 13px; color: #c77dff; text-align: center; margin-bottom: 10px; }
.members-panel { width: 250px; background: #16213e; border-left: 1px solid #333; display: flex; flex-direction: column; }
.members-header { padding: 15px; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center; }
.member-item { padding: 10px 15px; border-bottom: 1px solid #222; display: flex; justify-content: space-between; align-items: center; }
.member-name { font-size: 14px; }
.member-role { font-size: 11px; color: #9d4edd; }
.member-remove { background: none; border: none; color: #ff6b6b; cursor: pointer; font-size: 11px; padding: 2px 6px; }
.member-remove:hover { color: #ff4444; }
.online-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 6px; }
.online-dot.on { background: #51cf66; }
.online-dot.off { background: #555; }
.checkbox-group { display: flex; align-items: center; gap: 8px; margin-bottom: 15px; }
.checkbox-group input { width: 16px; height: 16px; }
.checkbox-group label { color: #aaa; font-size: 13px; }
.user-list { max-height: 300px; overflow-y: auto; }
.user-item { padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #222; }
.add-btn { padding: 4px 10px; background: #9d4edd; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
.add-btn:hover { background: #7b2cbf; }
"#;

// ============================================
// Settings Page (URL Configuration)
// ============================================

#[component]
fn Settings() -> Element {
    let state = use_context::<Signal<AppState>>();
    let nav = use_navigator();

    let mut server_url = use_signal(|| {
        let config = load_config();
        config
            .server_url
            .unwrap_or_else(|| "http://localhost:3000".to_string())
    });
    let mut error = use_signal(|| None::<String>);
    let mut success = use_signal(|| None::<String>);
    let mut loading = use_signal(|| false);
    let mut tor_status_text = use_signal(|| None::<String>);
    let mut tor_progress = use_signal(|| 0u8);

    let is_onion = TorManager::is_onion_url(&server_url());

    let connect = move |_| {
        let raw_url = server_url().trim().to_string();

        spawn(async move {
            loading.set(true);
            error.set(None);
            success.set(None);
            tor_status_text.set(None);
            tor_progress.set(0);

            let is_onion = TorManager::is_onion_url(&raw_url);
            let url = if is_onion {
                TorManager::normalize_onion_url(&raw_url)
            } else {
                raw_url.clone()
            };

            // If .onion, bootstrap Tor first
            if is_onion {
                tor_status_text.set(Some("Starting Tor...".to_string()));

                let mut status_rx = state.read().tor_manager.status_receiver();
                let progress_done = std::rc::Rc::new(std::cell::Cell::new(false));
                let progress_done_clone = progress_done.clone();
                spawn(async move {
                    while status_rx.changed().await.is_ok() {
                        if progress_done_clone.get() {
                            break;
                        }
                        let status = status_rx.borrow().clone();
                        match &status {
                            TorStatus::Bootstrapping(pct) => {
                                tor_progress.set(*pct);
                                tor_status_text
                                    .set(Some(format!("Connecting to Tor network... {}%", pct)));
                            }
                            TorStatus::Connected { .. } => {
                                tor_progress.set(100);
                                tor_status_text.set(Some("Tor connected!".to_string()));
                                break;
                            }
                            TorStatus::Error(e) => {
                                tor_status_text.set(Some(format!("Tor error: {}", e)));
                                break;
                            }
                            _ => {}
                        }
                    }
                });

                match state.read().tor_manager.bootstrap().await {
                    Ok(socks_port) => {
                        state.read().api.configure_tor_proxy(socks_port).await;
                        tor_status_text.set(Some("Tor connected!".to_string()));
                        tor_progress.set(100);
                    }
                    Err(e) => {
                        error.set(Some(format!("Tor bootstrap failed: {}", e)));
                        loading.set(false);
                        progress_done.set(true);
                        return;
                    }
                }
                progress_done.set(true);
            } else {
                state.read().api.disable_tor_proxy().await;
            }

            // Update API base URL
            state.read().api.set_base_url(url.clone()).await;

            // Check server health
            match state.read().api.health_check().await {
                Ok(_) => {
                    success.set(Some("Connected to server!".to_string()));

                    let mut config = load_config();
                    config.server_url = Some(url.clone());
                    save_config(&config);

                    *state.read().server_url.write().await = url;

                    // Check if we have a token
                    if let Some(token) = config.token {
                        state.read().api.set_token(Some(token)).await;
                        if state.read().api.get_me().await.is_ok() {
                            nav.push(Route::Chat {});
                            return;
                        }
                    }

                    nav.push(Route::Login {});
                }
                Err(e) => {
                    error.set(Some(format!("Failed to connect: {}", e)));
                }
            }
            loading.set(false);
        });
    };

    rsx! {
        style { {STYLES} }
        div { class: "container",
            div { class: "card",
                h1 { class: "title", "TOR Chat" }
                p { class: "subtitle", "Secure Desktop Messenger" }

                if let Some(err) = error() {
                    div { class: "error", "{err}" }
                }
                if let Some(msg) = success() {
                    div { class: "success", "{msg}" }
                }

                div { class: "form-group",
                    label { class: "label", "Server URL" }
                    input {
                        class: "input",
                        r#type: "url",
                        placeholder: "http://your-server:9274 or .onion",
                        value: "{server_url}",
                        oninput: move |e| server_url.set(e.value()),
                    }
                }

                if is_onion {
                    div { class: "tor-indicator onion",
                        "Onion address detected — will connect via embedded Tor"
                    }
                } else if !server_url().trim().is_empty() {
                    div { class: "tor-indicator clearnet",
                        "Clearnet — direct connection"
                    }
                }

                if let Some(status) = tor_status_text() {
                    div { class: "tor-status", "{status}" }
                    div { class: "progress-bar",
                        div {
                            class: "progress-fill",
                            style: "width: {tor_progress()}%",
                        }
                    }
                }

                button {
                    class: "btn btn-primary",
                    disabled: loading(),
                    onclick: connect,
                    if loading() {
                        if is_onion { "Connecting via Tor..." } else { "Connecting..." }
                    } else {
                        "Connect"
                    }
                }

                p { class: "text-center",
                    "Enter your TOR Chat server URL to connect"
                }
            }
        }
    }
}

// ============================================
// Login Page
// ============================================

#[component]
fn Login() -> Element {
    let state = use_context::<Signal<AppState>>();
    let nav = use_navigator();

    let mut username = use_signal(String::new);
    let mut password = use_signal(String::new);
    let mut error = use_signal(|| None::<String>);
    let mut loading = use_signal(|| false);

    let login = move |_| {
        let user = username().trim().to_string();
        let pass = password().trim().to_string();

        if user.is_empty() || pass.is_empty() {
            error.set(Some("Please fill in all fields".to_string()));
            return;
        }

        spawn(async move {
            loading.set(true);
            error.set(None);

            match state.read().api.login(&user, &pass).await {
                Ok(response) => {
                    if let Some(token) = response["token"].as_str() {
                        state.read().api.set_token(Some(token.to_string())).await;

                        let mut config = load_config();
                        config.token = Some(token.to_string());
                        save_config(&config);

                        nav.push(Route::Chat {});
                    }
                }
                Err(e) => {
                    error.set(Some(e));
                }
            }
            loading.set(false);
        });
    };

    rsx! {
        style { {STYLES} }
        div { class: "container",
            div { class: "card",
                h1 { class: "title", "Login" }
                p { class: "subtitle", "Welcome back!" }

                if let Some(err) = error() {
                    div { class: "error", "{err}" }
                }

                div { class: "form-group",
                    label { class: "label", "Username" }
                    input {
                        class: "input",
                        r#type: "text",
                        placeholder: "Enter username",
                        value: "{username}",
                        oninput: move |e| username.set(e.value()),
                    }
                }

                div { class: "form-group",
                    label { class: "label", "Password" }
                    input {
                        class: "input",
                        r#type: "password",
                        placeholder: "Enter password",
                        value: "{password}",
                        oninput: move |e| password.set(e.value()),
                    }
                }

                button {
                    class: "btn btn-primary",
                    disabled: loading(),
                    onclick: login,
                    if loading() { "Logging in..." } else { "Login" }
                }

                p { class: "text-center",
                    "Don't have an account? "
                    span {
                        class: "link",
                        onclick: move |_| { nav.push(Route::Register {}); },
                        "Register"
                    }
                }

                button {
                    class: "btn btn-secondary",
                    onclick: move |_| { nav.push(Route::Settings {}); },
                    "← Change Server"
                }
            }
        }
    }
}

// ============================================
// Register Page
// ============================================

#[component]
fn Register() -> Element {
    let state = use_context::<Signal<AppState>>();
    let nav = use_navigator();

    let mut username = use_signal(String::new);
    let mut email = use_signal(String::new);
    let mut password = use_signal(String::new);
    let mut error = use_signal(|| None::<String>);
    let mut loading = use_signal(|| false);

    let register = move |_| {
        let user = username().trim().to_string();
        let mail = email().trim().to_string();
        let pass = password().trim().to_string();

        if user.is_empty() || mail.is_empty() || pass.is_empty() {
            error.set(Some("Please fill in all fields".to_string()));
            return;
        }

        if pass.len() < 6 {
            error.set(Some("Password must be at least 6 characters".to_string()));
            return;
        }

        spawn(async move {
            loading.set(true);
            error.set(None);

            match state.read().api.register(&user, &mail, &pass).await {
                Ok(response) => {
                    if let Some(token) = response["token"].as_str() {
                        state.read().api.set_token(Some(token.to_string())).await;

                        let mut config = load_config();
                        config.token = Some(token.to_string());
                        save_config(&config);

                        nav.push(Route::Chat {});
                    }
                }
                Err(e) => {
                    error.set(Some(e));
                }
            }
            loading.set(false);
        });
    };

    rsx! {
        style { {STYLES} }
        div { class: "container",
            div { class: "card",
                h1 { class: "title", "Register" }
                p { class: "subtitle", "Create your account" }

                if let Some(err) = error() {
                    div { class: "error", "{err}" }
                }

                div { class: "form-group",
                    label { class: "label", "Username" }
                    input {
                        class: "input",
                        r#type: "text",
                        placeholder: "Choose a username",
                        value: "{username}",
                        oninput: move |e| username.set(e.value()),
                    }
                }

                div { class: "form-group",
                    label { class: "label", "Email" }
                    input {
                        class: "input",
                        r#type: "email",
                        placeholder: "your@email.com",
                        value: "{email}",
                        oninput: move |e| email.set(e.value()),
                    }
                }

                div { class: "form-group",
                    label { class: "label", "Password" }
                    input {
                        class: "input",
                        r#type: "password",
                        placeholder: "At least 6 characters",
                        value: "{password}",
                        oninput: move |e| password.set(e.value()),
                    }
                }

                button {
                    class: "btn btn-primary",
                    disabled: loading(),
                    onclick: register,
                    if loading() { "Creating account..." } else { "Register" }
                }

                p { class: "text-center",
                    "Already have an account? "
                    span {
                        class: "link",
                        onclick: move |_| { nav.push(Route::Login {}); },
                        "Login"
                    }
                }
            }
        }
    }
}

// ============================================
// Chat Page
// ============================================

#[component]
fn Chat() -> Element {
    let state = use_context::<Signal<AppState>>();
    let nav = use_navigator();

    // Dioxus Signals for reactive state
    let mut rooms = use_signal(Vec::<Room>::new);
    let mut current_room = use_signal(|| None::<Room>);
    let mut messages = use_signal(Vec::<Message>::new);
    let mut current_user = use_signal(|| None::<User>);
    let mut message_input = use_signal(String::new);
    let mut show_new_room = use_signal(|| false);
    let mut new_room_name = use_signal(String::new);
    let mut new_room_desc = use_signal(String::new);
    let mut new_room_public = use_signal(|| true);
    let mut loading = use_signal(|| false);

    // Members panel
    let mut show_members = use_signal(|| false);
    let mut members: Signal<Vec<Value>> = use_signal(Vec::new);

    // Add member modal
    let mut show_add_member = use_signal(|| false);
    let mut all_users: Signal<Vec<Value>> = use_signal(Vec::new);
    let mut add_search = use_signal(String::new);

    // Socket.IO connection + initial data load
    use_effect(move || {
        spawn(async move {
            // Load current user
            let user = match state.read().api.get_me().await {
                Ok(u) => u,
                Err(_) => {
                    nav.push(Route::Login {});
                    return;
                }
            };
            let is_admin = user.is_admin;
            current_user.set(Some(user));
            new_room_public.set(is_admin);

            // Load rooms
            if let Ok(r) = state.read().api.get_rooms().await {
                rooms.set(r);
            }

            // Connect Socket.IO
            let token = match state.read().api.get_token().await {
                Some(t) => t,
                None => return,
            };
            let base_url = state.read().api.get_base_url().await;
            let socket = state.read().socket.clone();

            let mut event_rx = socket.connect(&base_url, &token).await;

            // Spawn a local task (runs on the main thread) to poll socket events
            // and update Dioxus signals safely.
            spawn(async move {
                while let Some(ev) = event_rx.recv().await {
                    match ev.name.as_str() {
                        "new_message" => {
                            if let Ok(msg) = serde_json::from_value::<Message>(ev.payload) {
                                let mut msgs = messages.write();
                                if !msgs.iter().any(|m| m.id == msg.id) {
                                    msgs.push(msg);
                                }
                            }
                        }
                        "room_created" => {
                            if let Ok(room) = serde_json::from_value::<Room>(ev.payload) {
                                let mut r = rooms.write();
                                if !r.iter().any(|existing| existing.id == room.id) {
                                    r.push(room);
                                }
                            }
                        }
                        "room_deleted" => {
                            if let Some(room_id_str) =
                                ev.payload.get("roomId").and_then(|v| v.as_str())
                            {
                                if let Ok(room_id) = Uuid::parse_str(room_id_str) {
                                    rooms.write().retain(|r| r.id != room_id);
                                }
                            }
                        }
                        "message_edited" => {
                            if let (Some(msg_id), Some(content)) = (
                                ev.payload.get("messageId").and_then(|v| v.as_str()),
                                ev.payload.get("content").and_then(|v| v.as_str()),
                            ) {
                                if let Ok(id) = Uuid::parse_str(msg_id) {
                                    let mut msgs = messages.write();
                                    if let Some(m) = msgs.iter_mut().find(|m| m.id == id) {
                                        m.content = content.to_string();
                                    }
                                }
                            }
                        }
                        "message_deleted" => {
                            if let Some(msg_id) =
                                ev.payload.get("messageId").and_then(|v| v.as_str())
                            {
                                if let Ok(id) = Uuid::parse_str(msg_id) {
                                    messages.write().retain(|m| m.id != id);
                                }
                            }
                        }
                        "authenticated" => {
                            tracing::info!("Socket authenticated");
                        }
                        _ => {
                            tracing::debug!("Socket event: {} {:?}", ev.name, ev.payload);
                        }
                    }
                }
            });
        });
    });

    let mut select_room = move |room: Room| {
        let room_id = room.id.to_string();
        current_room.set(Some(room));
        messages.set(Vec::new());
        show_members.set(false);

        spawn(async move {
            // Join room via socket
            state
                .read()
                .socket
                .send_event(
                    "join_room",
                    &serde_json::json!({"roomId": room_id}),
                )
                .await;

            // Load messages via API
            if let Ok(msgs) = state.read().api.get_messages(&room_id).await {
                messages.set(msgs);
            }
        });
    };

    let do_send_message = move || {
        let content = message_input().trim().to_string();
        if content.is_empty() {
            return;
        }

        let room = current_room().clone();
        if room.is_none() {
            return;
        }

        let room_id = room.unwrap().id.to_string();
        message_input.set(String::new());

        spawn(async move {
            if let Ok(msg) = state.read().api.send_message(&room_id, &content).await {
                let mut msgs = messages.write();
                if !msgs.iter().any(|m| m.id == msg.id) {
                    msgs.push(msg);
                }
            }
        });
    };

    let create_room = move |_| {
        let name = new_room_name().trim().to_string();
        if name.is_empty() {
            return;
        }

        let desc_str = new_room_desc().trim().to_string();
        let desc = if desc_str.is_empty() {
            None
        } else {
            Some(desc_str)
        };
        let is_public = new_room_public();

        spawn(async move {
            loading.set(true);
            match state
                .read()
                .api
                .create_room(&name, desc.as_deref(), is_public)
                .await
            {
                Ok(room) => {
                    rooms.write().push(room.clone());
                    current_room.set(Some(room));
                    messages.set(Vec::new());
                }
                Err(e) => {
                    tracing::error!("Failed to create room: {}", e);
                }
            }
            new_room_name.set(String::new());
            new_room_desc.set(String::new());
            show_new_room.set(false);
            loading.set(false);
        });
    };

    let logout = move |_| {
        spawn(async move {
            state.read().clear_auth().await;

            let mut config = load_config();
            config.token = None;
            save_config(&config);

            nav.push(Route::Login {});
        });
    };

    let user = current_user();
    let user_id = user.as_ref().map(|u| u.id).unwrap_or_default();
    let is_admin = user.as_ref().map(|u| u.is_admin).unwrap_or(false);

    let cur_room = current_room();
    let is_creator = cur_room
        .as_ref()
        .and_then(|r| r.creator_id)
        .map(|c| c == user_id)
        .unwrap_or(false);
    let can_delete = is_creator || is_admin;
    let can_manage_members = is_creator || is_admin;

    rsx! {
        style { {STYLES} }

        div { class: "chat-container",
            // Sidebar
            div { class: "sidebar",
                div { class: "sidebar-header",
                    h2 { class: "sidebar-title", "TOR Chat" }
                }

                div { class: "room-list",
                    for room in rooms() {
                        div {
                            class: if current_room().as_ref().map(|r| r.id) == Some(room.id) { "room-item active" } else { "room-item" },
                            onclick: {
                                let room = room.clone();
                                move |_| select_room(room.clone())
                            },
                            div { class: "room-name",
                                "{room.name}"
                                span {
                                    class: if room.is_public { "badge badge-public" } else { "badge badge-private" },
                                    if room.is_public { "Public" } else { "Private" }
                                }
                            }
                            div { class: "room-desc",
                                "{room.description.clone().unwrap_or_default()}"
                            }
                        }
                    }

                    div {
                        class: "new-room-btn",
                        onclick: move |_| show_new_room.set(true),
                        "+ New Room"
                    }
                }

                if let Some(user) = user.clone() {
                    div { class: "user-info",
                        span { class: "username", "{user.username}" }
                        button {
                            class: "logout-btn",
                            onclick: logout,
                            "Logout"
                        }
                    }
                }
            }

            // Main content
            div { class: "main-content",
                if let Some(room) = current_room() {
                    // Chat header
                    div { class: "chat-header",
                        div {
                            h2 { class: "chat-title", "{room.name}" }
                            span {
                                class: if room.is_public { "badge badge-public" } else { "badge badge-private" },
                                if room.is_public { "Public" } else { "Private" }
                            }
                        }
                        div { class: "chat-actions",
                            // Members button
                            {
                                let room_id = room.id.to_string();
                                rsx! {
                                    button {
                                        class: "btn btn-secondary btn-small",
                                        onclick: move |_| {
                                            let showing = show_members();
                                            show_members.set(!showing);
                                            if !showing {
                                                let rid = room_id.clone();
                                                spawn(async move {
                                                    if let Ok(m) = state.read().api.get_members(&rid).await {
                                                        members.set(m);
                                                    }
                                                });
                                            }
                                        },
                                        "Members"
                                    }
                                }
                            }
                            // Leave button (not for creator)
                            if !is_creator {
                                {
                                    let room_id = room.id.to_string();
                                    rsx! {
                                        button {
                                            class: "btn btn-warning btn-small",
                                            onclick: move |_| {
                                                let rid = room_id.clone();
                                                spawn(async move {
                                                    if state.read().api.leave_room(&rid).await.is_ok() {
                                                        current_room.set(None);
                                                        messages.set(Vec::new());
                                                        show_members.set(false);
                                                        if let Ok(r) = state.read().api.get_rooms().await {
                                                            rooms.set(r);
                                                        }
                                                    }
                                                });
                                            },
                                            "Leave"
                                        }
                                    }
                                }
                            }
                            // Delete button
                            if can_delete {
                                {
                                    let room_id = room.id.to_string();
                                    rsx! {
                                        button {
                                            class: "btn btn-danger btn-small",
                                            onclick: move |_| {
                                                let rid = room_id.clone();
                                                spawn(async move {
                                                    if state.read().api.delete_room(&rid).await.is_ok() {
                                                        current_room.set(None);
                                                        messages.set(Vec::new());
                                                        show_members.set(false);
                                                        if let Ok(r) = state.read().api.get_rooms().await {
                                                            rooms.set(r);
                                                        }
                                                    }
                                                });
                                            },
                                            "Delete"
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Chat body (messages + optional members panel)
                    div {
                        style: "display: flex; flex: 1; overflow: hidden;",

                        // Messages
                        div {
                            class: "messages",
                            style: "flex: 1;",
                            for msg in messages() {
                                div {
                                    class: if msg.user_id == user_id { "message message-own" } else { "message message-other" },
                                    if msg.user_id != user_id {
                                        div { class: "message-user",
                                            "{msg.user.as_ref().map(|u| u.username.as_str()).unwrap_or(\"Unknown\")}"
                                        }
                                    }
                                    div { class: "message-content", "{msg.content}" }
                                    if let Some(time) = msg.created_at {
                                        {
                                            let time_str = time.format("%H:%M").to_string();
                                            rsx! {
                                                div { class: "message-time", "{time_str}" }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // Members panel
                        if show_members() {
                            div { class: "members-panel",
                                div { class: "members-header",
                                    span { style: "font-weight: 600;", "Members" }
                                    if can_manage_members {
                                        button {
                                            class: "add-btn",
                                            onclick: move |_| {
                                                show_add_member.set(true);
                                                add_search.set(String::new());
                                                spawn(async move {
                                                    if let Ok(u) = state.read().api.get_users().await {
                                                        all_users.set(u);
                                                    }
                                                });
                                            },
                                            "+ Add"
                                        }
                                    }
                                }
                                div { style: "flex: 1; overflow-y: auto;",
                                    for member in members() {
                                        {
                                            let member_uid = member["userId"].as_str().unwrap_or("").to_string();
                                            let user_data = &member["user"];
                                            let uname = user_data["username"].as_str().unwrap_or("?").to_string();
                                            let is_online = user_data["isOnline"].as_bool().unwrap_or(false);
                                            let role = member["role"].as_str().unwrap_or("member").to_string();
                                            let is_member_creator = current_room()
                                                .as_ref()
                                                .and_then(|r| r.creator_id)
                                                .map(|c| c.to_string() == member_uid)
                                                .unwrap_or(false);
                                            let can_remove = can_manage_members
                                                && !is_member_creator
                                                && member_uid != user_id.to_string();
                                            let room_id = current_room().as_ref().map(|r| r.id.to_string()).unwrap_or_default();
                                            let uid_for_remove = member_uid.clone();
                                            let rid_for_refresh = room_id.clone();
                                            rsx! {
                                                div { class: "member-item",
                                                    div {
                                                        div {
                                                            class: "member-name",
                                                            span {
                                                                class: if is_online { "online-dot on" } else { "online-dot off" },
                                                            }
                                                            "{uname}"
                                                        }
                                                        if role == "admin" {
                                                            div { class: "member-role", "Admin" }
                                                        }
                                                    }
                                                    if can_remove {
                                                        button {
                                                            class: "member-remove",
                                                            onclick: move |_| {
                                                                let rid = room_id.clone();
                                                                let uid = uid_for_remove.clone();
                                                                let rid_r = rid_for_refresh.clone();
                                                                spawn(async move {
                                                                    if state.read().api.remove_member(&rid, &uid).await.is_ok() {
                                                                        if let Ok(m) = state.read().api.get_members(&rid_r).await {
                                                                            members.set(m);
                                                                        }
                                                                    }
                                                                });
                                                            },
                                                            "Remove"
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Message input
                    div { class: "message-input-area",
                        input {
                            class: "message-input",
                            r#type: "text",
                            placeholder: "Type a message...",
                            value: "{message_input}",
                            oninput: move |e| message_input.set(e.value()),
                            onkeypress: {
                                let mut do_send = do_send_message;
                                move |e| {
                                    if e.key() == Key::Enter {
                                        do_send();
                                    }
                                }
                            },
                        }
                        button {
                            class: "send-btn",
                            onclick: {
                                let mut do_send = do_send_message;
                                move |_| do_send()
                            },
                            "Send"
                        }
                    }
                } else {
                    div { class: "empty-state",
                        "Select a room to start chatting"
                    }
                }
            }
        }

        // New Room Modal
        if show_new_room() {
            div {
                class: "modal-overlay",
                onclick: move |_| show_new_room.set(false),
                div {
                    class: "modal",
                    onclick: move |e| e.stop_propagation(),
                    h2 { class: "modal-title", "Create New Room" }

                    div { class: "form-group",
                        label { class: "label", "Room Name" }
                        input {
                            class: "input",
                            r#type: "text",
                            placeholder: "Enter room name",
                            value: "{new_room_name}",
                            oninput: move |e| new_room_name.set(e.value()),
                        }
                    }

                    div { class: "form-group",
                        label { class: "label", "Description (optional)" }
                        input {
                            class: "input",
                            r#type: "text",
                            placeholder: "Enter description",
                            value: "{new_room_desc}",
                            oninput: move |e| new_room_desc.set(e.value()),
                        }
                    }

                    if is_admin {
                        div { class: "checkbox-group",
                            input {
                                r#type: "checkbox",
                                checked: new_room_public(),
                                onchange: move |e| new_room_public.set(e.checked()),
                            }
                            label { "Public room (visible to all users)" }
                        }
                    } else {
                        div {
                            style: "font-size: 12px; color: #888; margin-bottom: 15px;",
                            "Room will be private. Only admins can create public rooms."
                        }
                    }

                    button {
                        class: "btn btn-primary",
                        disabled: loading(),
                        onclick: create_room,
                        if loading() { "Creating..." } else { "Create Room" }
                    }

                    button {
                        class: "btn btn-cancel",
                        onclick: move |_| show_new_room.set(false),
                        "Cancel"
                    }
                }
            }
        }

        // Add Member Modal
        if show_add_member() {
            div {
                class: "modal-overlay",
                onclick: move |_| show_add_member.set(false),
                div {
                    class: "modal",
                    onclick: move |e| e.stop_propagation(),
                    h2 { class: "modal-title", "Add Member" }

                    div { class: "form-group",
                        input {
                            class: "input",
                            r#type: "text",
                            placeholder: "Search users...",
                            value: "{add_search}",
                            oninput: move |e| add_search.set(e.value()),
                        }
                    }

                    div { class: "user-list",
                        {
                            let search = add_search().to_lowercase();
                            let member_ids: Vec<String> = members().iter()
                                .filter_map(|m| m["userId"].as_str().map(|s| s.to_string()))
                                .collect();
                            let filtered: Vec<_> = all_users().iter()
                                .filter(|u| {
                                    let uid = u["id"].as_str().unwrap_or("");
                                    let uname = u["username"].as_str().unwrap_or("").to_lowercase();
                                    !member_ids.contains(&uid.to_string()) &&
                                    (search.is_empty() || uname.contains(&search))
                                })
                                .cloned()
                                .collect();
                            rsx! {
                                if filtered.is_empty() {
                                    div { style: "text-align: center; color: #666; padding: 20px;",
                                        "No users to add"
                                    }
                                } else {
                                    for user_val in filtered {
                                        {
                                            let uid = user_val["id"].as_str().unwrap_or("").to_string();
                                            let uname = user_val["username"].as_str().unwrap_or("?").to_string();
                                            let room_id = current_room().as_ref().map(|r| r.id.to_string()).unwrap_or_default();
                                            let rid_refresh = room_id.clone();
                                            rsx! {
                                                div { class: "user-item",
                                                    span { "{uname}" }
                                                    button {
                                                        class: "add-btn",
                                                        onclick: move |_| {
                                                            let rid = room_id.clone();
                                                            let uid = uid.clone();
                                                            let rid_r = rid_refresh.clone();
                                                            spawn(async move {
                                                                if state.read().api.add_member(&rid, &uid).await.is_ok() {
                                                                    if let Ok(m) = state.read().api.get_members(&rid_r).await {
                                                                        members.set(m);
                                                                    }
                                                                }
                                                            });
                                                        },
                                                        "Add"
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    button {
                        class: "btn btn-cancel",
                        style: "margin-top: 15px;",
                        onclick: move |_| show_add_member.set(false),
                        "Close"
                    }
                }
            }
        }
    }
}
