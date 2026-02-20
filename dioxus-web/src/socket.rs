use futures::{SinkExt, StreamExt};
use gloo_net::websocket::{futures::WebSocket, Message as WsMessage};
use serde_json::Value;
use std::cell::RefCell;
use std::rc::Rc;
use wasm_bindgen_futures::spawn_local;

type WsSink = futures::stream::SplitSink<WebSocket, WsMessage>;

pub struct SocketClient {
    sink: Rc<RefCell<Option<WsSink>>>,
    base_url: String,
    connected: Rc<RefCell<bool>>,
    token: Rc<RefCell<Option<String>>>,
}

impl SocketClient {
    pub fn new(base_url: String) -> Self {
        Self {
            sink: Rc::new(RefCell::new(None)),
            base_url,
            connected: Rc::new(RefCell::new(false)),
            token: Rc::new(RefCell::new(None)),
        }
    }

    pub async fn connect(&self, token: &str) {
        // Don't reconnect if already connected
        if *self.connected.borrow() {
            tracing::info!("Socket already connected, skipping");
            return;
        }

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

                            if text.starts_with('0') {
                                // Send Socket.IO connect packet (40)
                                if let Err(e) = write.send(WsMessage::Text("40".to_string())).await
                                {
                                    tracing::error!("Failed to send connect packet: {:?}", e);
                                    return;
                                }

                                // Wait for connect acknowledgment
                                if let Some(ack) = read.next().await {
                                    match ack {
                                        Ok(WsMessage::Text(ack_text)) => {
                                            if ack_text.starts_with("40") {
                                                *self.connected.borrow_mut() = true;
                                                tracing::info!("Socket.IO connected!");

                                                // Store the write half for sending
                                                *self.sink.borrow_mut() = Some(write);

                                                // Send authentication event
                                                let auth_data = serde_json::json!({"token": token});
                                                self.emit_internal("authenticate", auth_data).await;

                                                // Spawn background task to handle pings
                                                let connected = self.connected.clone();
                                                let sink = self.sink.clone();
                                                spawn_local(async move {
                                                    Self::read_loop(read, connected, sink).await;
                                                });
                                            }
                                        }
                                        Ok(_) => {
                                            tracing::warn!("Unexpected message during handshake");
                                        }
                                        Err(e) => {
                                            tracing::error!("Error receiving ack: {:?}", e);
                                        }
                                    }
                                }
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

    async fn read_loop(
        mut read: futures::stream::SplitStream<WebSocket>,
        connected: Rc<RefCell<bool>>,
        sink: Rc<RefCell<Option<WsSink>>>,
    ) {
        while let Some(msg) = read.next().await {
            match msg {
                Ok(WsMessage::Text(text)) => {
                    if text == "2" {
                        // Engine.IO ping -> respond with pong
                        let writer = sink.borrow_mut().take();
                        if let Some(mut w) = writer {
                            let _ = w.send(WsMessage::Text("3".to_string())).await;
                            *sink.borrow_mut() = Some(w);
                        }
                    } else if text.starts_with("42") {
                        // Socket.IO event - log for now
                        tracing::debug!("Received event: {}", text);
                    }
                }
                Ok(WsMessage::Bytes(_)) => {}
                Err(e) => {
                    tracing::error!("WebSocket read error: {:?}", e);
                    break;
                }
            }
        }
        tracing::warn!("WebSocket read loop ended, marking disconnected");
        *connected.borrow_mut() = false;
    }

    async fn emit_internal(&self, event: &str, data: Value) {
        let writer = self.sink.borrow_mut().take();
        if let Some(mut w) = writer {
            let msg = format!("42{}", serde_json::json!([event, data]));
            tracing::info!("Emitting: {}", msg);

            if let Err(e) = w.send(WsMessage::Text(msg)).await {
                tracing::error!("Failed to send message: {:?}", e);
            }
            *self.sink.borrow_mut() = Some(w);
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
        *self.sink.borrow_mut() = None;
        *self.token.borrow_mut() = None;
    }
}
