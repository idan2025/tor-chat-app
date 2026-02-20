#![allow(non_snake_case)]

mod tor_manager;

use chrono::{DateTime, Utc};
use dioxus::prelude::*;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
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
    #[serde(rename = "encryptionKey", alias = "encryption_key", alias = "roomKey", alias = "room_key")]
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
    #[serde(rename = "userId", alias = "user_id", alias = "senderId", alias = "sender_id")]
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
    let _ = fs::write(&path, serde_json::to_string_pretty(config).unwrap_or_default());
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

    pub async fn register(&self, username: &str, email: &str, password: &str) -> Result<Value, String> {
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
            Err(body["details"].as_str().unwrap_or(&format!("Registration failed: {}", status)).to_string())
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
            Err(body["details"].as_str().unwrap_or(&format!("Login failed: {}", status)).to_string())
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
            serde_json::from_value(data["rooms"].clone()).unwrap_or_else(|_| Vec::new()).pipe(Ok)
        } else {
            Ok(Vec::new())
        }
    }

    pub async fn create_room(&self, name: &str, description: Option<&str>) -> Result<Room, String> {
        let body = serde_json::json!({
            "name": name,
            "description": description,
            "type": "private"
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
            Err("Failed to create room".to_string())
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
            .request(reqwest::Method::GET, &format!("/api/rooms/{}/messages?limit=50", room_id))
            .await
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if response.status().is_success() {
            let data: Value = response.json().await.map_err(|e| e.to_string())?;
            serde_json::from_value(data["messages"].clone()).unwrap_or_else(|_| Vec::new()).pipe(Ok)
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
            .request(reqwest::Method::POST, &format!("/api/rooms/{}/messages", room_id))
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
}

trait Pipe: Sized {
    fn pipe<R, F: FnOnce(Self) -> R>(self, f: F) -> R { f(self) }
}
impl<T> Pipe for T {}

// ============================================
// App State
// ============================================

#[derive(Clone)]
pub struct AppState {
    pub api: ApiClient,
    pub tor_manager: Arc<TorManager>,
    pub current_user: Arc<RwLock<Option<User>>>,
    pub rooms: Arc<RwLock<Vec<Room>>>,
    pub current_room: Arc<RwLock<Option<Room>>>,
    pub messages: Arc<RwLock<Vec<Message>>>,
    pub server_url: Arc<RwLock<String>>,
}

impl AppState {
    pub fn new(server_url: String, token: Option<String>) -> Self {
        Self {
            api: ApiClient::new(server_url.clone(), token),
            tor_manager: Arc::new(TorManager::new()),
            current_user: Arc::new(RwLock::new(None)),
            rooms: Arc::new(RwLock::new(Vec::new())),
            current_room: Arc::new(RwLock::new(None)),
            messages: Arc::new(RwLock::new(Vec::new())),
            server_url: Arc::new(RwLock::new(server_url)),
        }
    }

    pub async fn load_rooms(&self) {
        if let Ok(rooms) = self.api.get_rooms().await {
            *self.rooms.write().await = rooms;
        }
    }

    pub async fn load_messages(&self, room_id: &str) {
        if let Ok(messages) = self.api.get_messages(room_id).await {
            *self.messages.write().await = messages;
        }
    }

    pub async fn set_current_room(&self, room: Option<Room>) {
        *self.current_room.write().await = room;
    }

    pub async fn clear_auth(&self) {
        self.api.set_token(None).await;
        *self.current_user.write().await = None;
        *self.rooms.write().await = Vec::new();
        *self.current_room.write().await = None;
        *self.messages.write().await = Vec::new();
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
    let server_url = config.server_url.clone().unwrap_or_else(|| "http://localhost:3000".to_string());
    let token = config.token.clone();

    // Create global state
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
.room-name { font-weight: 500; margin-bottom: 4px; }
.room-desc { font-size: 12px; color: #666; }
.main-content { flex: 1; display: flex; flex-direction: column; background: #1a1a2e; }
.chat-header { padding: 20px; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center; }
.chat-title { font-size: 18px; font-weight: 600; }
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
        config.server_url.unwrap_or_else(|| "http://localhost:3000".to_string())
    });
    let mut error = use_signal(|| None::<String>);
    let mut success = use_signal(|| None::<String>);
    let mut loading = use_signal(|| false);
    let mut tor_status_text = use_signal(|| None::<String>);
    let mut tor_progress = use_signal(|| 0u8);

    let is_onion = TorManager::is_onion_url(&server_url());

    let connect = move |_| {
        let raw_url = server_url().trim().to_string();
        let state = state.clone();
        let nav = nav.clone();

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

                // Spawn progress watcher
                let mut status_rx = state.read().tor_manager.status_receiver();
                let tor_status_text_clone = tor_status_text.clone();
                let tor_progress_clone = tor_progress.clone();
                let progress_task = tokio::spawn(async move {
                    while status_rx.changed().await.is_ok() {
                        let status = status_rx.borrow().clone();
                        match &status {
                            TorStatus::Bootstrapping(pct) => {
                                tor_progress_clone.clone().set(*pct);
                                tor_status_text_clone.clone().set(Some(
                                    format!("Connecting to Tor network... {}%", pct),
                                ));
                            }
                            TorStatus::Connected { .. } => {
                                tor_progress_clone.clone().set(100);
                                tor_status_text_clone.clone().set(Some("Tor connected!".to_string()));
                                break;
                            }
                            TorStatus::Error(e) => {
                                tor_status_text_clone.clone().set(Some(format!("Tor error: {}", e)));
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
                        progress_task.abort();
                        return;
                    }
                }
                progress_task.abort();
            } else {
                // Clearnet - disable any previous Tor proxy
                state.read().api.disable_tor_proxy().await;
            }

            // Update API base URL
            state.read().api.set_base_url(url.clone()).await;

            // Check server health
            match state.read().api.health_check().await {
                Ok(_) => {
                    success.set(Some("Connected to server!".to_string()));

                    // Save config
                    let mut config = load_config();
                    config.server_url = Some(url.clone());
                    save_config(&config);

                    // Update state
                    *state.read().server_url.write().await = url;

                    // Check if we have a token
                    if let Some(token) = config.token {
                        state.read().api.set_token(Some(token)).await;
                        // Try to get current user
                        if let Ok(user) = state.read().api.get_me().await {
                            *state.read().current_user.write().await = Some(user);
                            nav.push(Route::Chat {});
                            return;
                        }
                    }

                    // Go to login
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

                // .onion detection indicator
                if is_onion {
                    div { class: "tor-indicator onion",
                        "Onion address detected — will connect via embedded Tor"
                    }
                } else if !server_url().trim().is_empty() {
                    div { class: "tor-indicator clearnet",
                        "Clearnet — direct connection"
                    }
                }

                // Tor bootstrap progress
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
        let state = state.clone();
        let nav = nav.clone();

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
                        // Save token
                        state.read().api.set_token(Some(token.to_string())).await;

                        let mut config = load_config();
                        config.token = Some(token.to_string());
                        save_config(&config);

                        // Parse user
                        if let Ok(user) = serde_json::from_value::<User>(response["user"].clone()) {
                            *state.read().current_user.write().await = Some(user);
                        }

                        // Load rooms
                        state.read().load_rooms().await;

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
        let state = state.clone();
        let nav = nav.clone();

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
                        // Save token
                        state.read().api.set_token(Some(token.to_string())).await;

                        let mut config = load_config();
                        config.token = Some(token.to_string());
                        save_config(&config);

                        // Parse user
                        if let Ok(user) = serde_json::from_value::<User>(response["user"].clone()) {
                            *state.read().current_user.write().await = Some(user);
                        }

                        // Load rooms
                        state.read().load_rooms().await;

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

    let mut rooms = use_signal(Vec::<Room>::new);
    let mut current_room = use_signal(|| None::<Room>);
    let mut messages = use_signal(Vec::<Message>::new);
    let mut current_user = use_signal(|| None::<User>);
    let mut message_input = use_signal(String::new);
    let mut show_new_room = use_signal(|| false);
    let mut new_room_name = use_signal(String::new);
    let mut loading = use_signal(|| false);

    // Load initial data
    use_effect(move || {
        let state = state.clone();
        spawn(async move {
            // Load current user
            if let Ok(user) = state.read().api.get_me().await {
                current_user.set(Some(user));
            } else {
                // Not authenticated, go to login
                nav.push(Route::Login {});
                return;
            }

            // Load rooms
            if let Ok(r) = state.read().api.get_rooms().await {
                rooms.set(r);
            }
        });
    });

    let mut select_room = move |room: Room| {
        let room_id = room.id.to_string();
        let state = state.clone();

        current_room.set(Some(room));
        messages.set(Vec::new());

        spawn(async move {
            if let Ok(msgs) = state.read().api.get_messages(&room_id).await {
                messages.set(msgs);
            }
        });
    };

    let do_send_message = {
        let state = state.clone();
        move || {
            let content = message_input().trim().to_string();
            if content.is_empty() {
                return;
            }

            let room = current_room().clone();
            if room.is_none() {
                return;
            }

            let room_id = room.unwrap().id.to_string();
            let state = state.clone();

            message_input.set(String::new());

            spawn(async move {
                if let Ok(msg) = state.read().api.send_message(&room_id, &content).await {
                    messages.write().push(msg);
                }
            });
        }
    };

    let create_room = move |_| {
        let name = new_room_name().trim().to_string();
        if name.is_empty() {
            return;
        }

        let state = state.clone();

        spawn(async move {
            loading.set(true);
            if let Ok(room) = state.read().api.create_room(&name, None).await {
                rooms.write().push(room.clone());
                current_room.set(Some(room));
                messages.set(Vec::new());
            }
            new_room_name.set(String::new());
            show_new_room.set(false);
            loading.set(false);
        });
    };

    let logout = move |_| {
        let state = state.clone();
        let nav = nav.clone();

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

    rsx! {
        style { {STYLES} }

        div { class: "chat-container",
            // Sidebar
            div { class: "sidebar",
                div { class: "sidebar-header",
                    h2 { class: "sidebar-title", "🧅 TOR Chat" }
                }

                div { class: "room-list",
                    for room in rooms() {
                        div {
                            class: if current_room().as_ref().map(|r| r.id) == Some(room.id) { "room-item active" } else { "room-item" },
                            onclick: {
                                let room = room.clone();
                                move |_| select_room(room.clone())
                            },
                            div { class: "room-name", "{room.name}" }
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
                        h2 { class: "chat-title", "{room.name}" }
                    }

                    // Messages
                    div { class: "messages",
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

                    // Message input
                    div { class: "message-input-area",
                        input {
                            class: "message-input",
                            r#type: "text",
                            placeholder: "Type a message...",
                            value: "{message_input}",
                            oninput: move |e| message_input.set(e.value()),
                            onkeypress: {
                                let mut do_send = do_send_message.clone();
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
                                let mut do_send = do_send_message.clone();
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
    }
}
