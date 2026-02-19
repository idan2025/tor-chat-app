use futures::{SinkExt, StreamExt};
use gloo_net::websocket::{futures::WebSocket, Message as WsMessage};
use serde_json::Value;
use std::cell::RefCell;
use std::rc::Rc;

pub struct SocketClient {
    ws: Rc<RefCell<Option<WebSocket>>>,
    base_url: String,
    connected: Rc<RefCell<bool>>,
    token: Rc<RefCell<Option<String>>>,
}

impl SocketClient {
    pub fn new(base_url: String) -> Self {
        Self {
            ws: Rc::new(RefCell::new(None)),
            base_url,
            connected: Rc::new(RefCell::new(false)),
            token: Rc::new(RefCell::new(None)),
        }
    }

    pub async fn connect(&self, token: &str) {
        // Store token for authentication
        *self.token.borrow_mut() = Some(token.to_string());

        let ws_url = self
            .base_url
            .replace("http://", "ws://")
            .replace("https://", "wss://");

        // Socket.IO uses this URL format for WebSocket transport
        let socket_url = format!("{}/socket.io/?EIO=4&transport=websocket", ws_url);

        tracing::info!("Connecting to Socket.IO: {}", socket_url);

        match WebSocket::open(&socket_url) {
            Ok(ws) => {
                tracing::info!("WebSocket opened, waiting for Engine.IO handshake...");

                let (mut write, mut read) = ws.split();

                // Wait for Engine.IO open packet (0{...})
                if let Some(msg) = read.next().await {
                    match msg {
                        Ok(WsMessage::Text(text)) => {
                            tracing::info!("Received Engine.IO message: {}", text);

                            // Engine.IO open packet starts with "0"
                            if text.starts_with("0") {
                                // Send Socket.IO connect packet for default namespace
                                // Socket.IO connect is "40" (4 = MESSAGE, 0 = CONNECT)
                                let connect_msg = "40";
                                if let Err(e) =
                                    write.send(WsMessage::Text(connect_msg.to_string())).await
                                {
                                    tracing::error!("Failed to send connect packet: {:?}", e);
                                    return;
                                }
                                tracing::info!("Sent Socket.IO connect packet");

                                // Wait for connect acknowledgment
                                if let Some(ack) = read.next().await {
                                    match ack {
                                        Ok(WsMessage::Text(ack_text)) => {
                                            tracing::info!("Received ack: {}", ack_text);

                                            // Should receive "40" or "40{...}" for successful connect
                                            if ack_text.starts_with("40") {
                                                *self.connected.borrow_mut() = true;
                                                tracing::info!("Socket.IO connected!");

                                                // Reassemble the WebSocket
                                                let ws =
                                                    write.reunite(read).expect("reunite failed");
                                                *self.ws.borrow_mut() = Some(ws);

                                                // Send authentication event
                                                // Socket.IO event format: 42["event", data]
                                                let auth_data = serde_json::json!({"token": token});
                                                self.emit_internal("authenticate", auth_data).await;
                                            }
                                        }
                                        Ok(_) => {
                                            tracing::warn!(
                                                "Unexpected message type during handshake"
                                            );
                                        }
                                        Err(e) => {
                                            tracing::error!("Error receiving ack: {:?}", e);
                                        }
                                    }
                                }
                            } else if text.starts_with("2") {
                                // Ping packet, respond with pong
                                let _ = write.send(WsMessage::Text("3".to_string())).await;
                            }
                        }
                        Ok(_) => {
                            tracing::warn!("Expected text message during handshake");
                        }
                        Err(e) => {
                            tracing::error!("WebSocket error during handshake: {:?}", e);
                        }
                    }
                }
            }
            Err(e) => {
                tracing::error!("Failed to open WebSocket: {:?}", e);
            }
        }
    }

    async fn emit_internal(&self, event: &str, data: Value) {
        let ws_opt = self.ws.borrow_mut().take();
        if let Some(mut ws) = ws_opt {
            // Socket.IO event format: 42["event", data]
            let msg = format!("42{}", serde_json::json!([event, data]));
            tracing::info!("Emitting: {}", msg);

            if let Err(e) = ws.send(WsMessage::Text(msg)).await {
                tracing::error!("Failed to send message: {:?}", e);
            }
            *self.ws.borrow_mut() = Some(ws);
        } else {
            tracing::warn!("Cannot emit '{}': WebSocket not connected", event);
        }
    }

    pub async fn emit(&self, event: &str, data: Value) {
        if !*self.connected.borrow() {
            tracing::warn!("Socket not connected, cannot emit '{}'", event);
            return;
        }
        self.emit_internal(event, data).await;
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

    pub fn is_connected(&self) -> bool {
        *self.connected.borrow()
    }

    pub async fn disconnect(&self) {
        *self.connected.borrow_mut() = false;
        *self.ws.borrow_mut() = None;
        *self.token.borrow_mut() = None;
    }
}
