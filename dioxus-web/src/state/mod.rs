pub mod auth;

use crate::api::ApiClient;
use crate::models::{Message, Room, User};
use crate::socket::SocketClient;
use std::rc::Rc;
use std::sync::{Arc, RwLock};

#[derive(Clone)]
pub struct AppState {
    pub api: Arc<ApiClient>,
    pub socket: Rc<SocketClient>,
    pub current_user: Arc<RwLock<Option<User>>>,
    pub rooms: Arc<RwLock<Vec<Room>>>,
    pub messages: Arc<RwLock<Vec<Message>>>,
    pub current_room: Arc<RwLock<Option<Room>>>,
}

impl AppState {
    pub fn new() -> Self {
        let api = Arc::new(ApiClient::new());
        // Use current origin for socket connection (works with nginx proxy)
        let socket_url = web_sys::window()
            .and_then(|w| w.location().origin().ok())
            .unwrap_or_else(|| String::from("http://localhost:3000"));
        let socket = Rc::new(SocketClient::new(socket_url));

        Self {
            api,
            socket,
            current_user: Arc::new(RwLock::new(None)),
            rooms: Arc::new(RwLock::new(Vec::new())),
            messages: Arc::new(RwLock::new(Vec::new())),
            current_room: Arc::new(RwLock::new(None)),
        }
    }

    pub async fn load_rooms(&self) -> Result<(), String> {
        let rooms = self.api.get_rooms().await?;
        *self.rooms.write().unwrap() = rooms;
        Ok(())
    }

    pub async fn load_messages(&self, room_id: &str) -> Result<(), String> {
        let messages = self.api.get_room_messages(room_id, 50, 0).await?;
        *self.messages.write().unwrap() = messages;
        Ok(())
    }

    pub async fn set_current_user(&self, user: User) {
        *self.current_user.write().unwrap() = Some(user);
    }

    pub async fn clear_auth(&self) {
        *self.current_user.write().unwrap() = None;
        self.socket.disconnect().await;
        crate::utils::storage::remove_token();
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
