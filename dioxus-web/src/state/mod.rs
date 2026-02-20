pub mod auth;

use crate::api::ApiClient;
use crate::models::{Message, Room, User};
use crate::socket::SocketClient;
use dioxus::prelude::*;
use std::rc::Rc;
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub api: Arc<ApiClient>,
    pub socket: Rc<SocketClient>,
    pub current_user: Signal<Option<User>>,
    pub rooms: Signal<Vec<Room>>,
    pub messages: Signal<Vec<Message>>,
    pub current_room: Signal<Option<Room>>,
    pub authenticated: Signal<bool>,
}

impl AppState {
    pub fn new() -> Self {
        let api = Arc::new(ApiClient::new());
        let socket_url = web_sys::window()
            .and_then(|w| w.location().origin().ok())
            .unwrap_or_else(|| "http://localhost:3000".to_string());
        let socket = Rc::new(SocketClient::new(socket_url));

        Self {
            api,
            socket,
            current_user: Signal::new(None),
            rooms: Signal::new(Vec::new()),
            messages: Signal::new(Vec::new()),
            current_room: Signal::new(None),
            authenticated: Signal::new(false),
        }
    }

    pub async fn load_rooms(&self) -> Result<(), String> {
        let rooms = self.api.get_rooms().await?;
        let mut rooms_sig = self.rooms;
        rooms_sig.set(rooms);
        Ok(())
    }

    pub async fn load_messages(&self, room_id: &str) -> Result<(), String> {
        let messages = self.api.get_room_messages(room_id, 50, 0).await?;
        let mut messages_sig = self.messages;
        messages_sig.set(messages);
        Ok(())
    }

    pub fn set_current_user(&self, user: User) {
        let mut user_sig = self.current_user;
        let mut auth_sig = self.authenticated;
        user_sig.set(Some(user));
        auth_sig.set(true);
    }

    pub async fn clear_auth(&self) {
        let mut user_sig = self.current_user;
        let mut auth_sig = self.authenticated;
        let mut rooms_sig = self.rooms;
        let mut messages_sig = self.messages;
        let mut room_sig = self.current_room;
        user_sig.set(None);
        auth_sig.set(false);
        rooms_sig.set(Vec::new());
        messages_sig.set(Vec::new());
        room_sig.set(None);
        self.socket.disconnect().await;
        crate::utils::storage::remove_token();
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
