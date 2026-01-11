use gloo_net::websocket::{futures::WebSocket, Message as WsMessage};
use serde_json::Value;
use std::sync::Arc;
use tokio::sync::Mutex;
use wasm_bindgen_futures::spawn_local;

pub struct SocketClient {
    ws: Arc<Mutex<Option<WebSocket>>>,
    base_url: String,
}

impl SocketClient {
    pub fn new(base_url: String) -> Self {
        Self {
            ws: Arc::new(Mutex::new(None)),
            base_url,
        }
    }

    pub async fn connect(&self, token: &str) {
        let ws_url = self
            .base_url
            .replace("http://", "ws://")
            .replace("https://", "wss://");
        let socket_url = format!("{}/socket.io/?EIO=4&transport=websocket", ws_url);

        match WebSocket::open(&socket_url) {
            Ok(ws) => {
                *self.ws.lock().await = Some(ws);

                // Send authentication
                let auth_msg = serde_json::json!({
                    "type": "authenticate",
                    "token": token
                });
                self.emit("authenticate", auth_msg).await;
            }
            Err(e) => {
                tracing::error!("Failed to connect WebSocket: {:?}", e);
            }
        }
    }

    pub async fn emit(&self, event: &str, data: Value) {
        if let Some(ws) = self.ws.lock().await.as_mut() {
            let msg = serde_json::json!({
                "event": event,
                "data": data
            });

            if let Ok(json_str) = serde_json::to_string(&msg) {
                let _ = ws.send(WsMessage::Text(json_str)).await;
            }
        }
    }

    pub async fn join_room(&self, room_id: &str) {
        self.emit("join_room", serde_json::json!({ "roomId": room_id }))
            .await;
    }

    pub async fn leave_room(&self, room_id: &str) {
        self.emit("leave_room", serde_json::json!({ "roomId": room_id }))
            .await;
    }

    pub async fn send_message(&self, room_id: &str, content: &str) {
        self.emit(
            "send_message",
            serde_json::json!({
                "roomId": room_id,
                "content": content,
                "messageType": "text"
            }),
        )
        .await;
    }

    pub async fn typing(&self, room_id: &str, is_typing: bool) {
        self.emit(
            "typing",
            serde_json::json!({
                "roomId": room_id,
                "typing": is_typing
            }),
        )
        .await;
    }

    pub async fn disconnect(&self) {
        *self.ws.lock().await = None;
    }
}
