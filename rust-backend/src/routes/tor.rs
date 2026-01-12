use crate::services::TorService;
use crate::state::AppState;
use axum::{extract::State, Json};
use std::sync::Arc;

pub async fn get_status(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    let tor_service = TorService::new(state.config.clone());
    let connected = tor_service.check_connection().await.unwrap_or(false);
    let mut info = tor_service.get_connection_info();
    info.hidden_service = tor_service.get_hidden_service_address().await;

    Json(serde_json::json!({
        "enabled": info.enabled,
        "connected": connected,
        "socks_host": info.socks_host,
        "socks_port": info.socks_port,
        "hidden_service": info.hidden_service,
    }))
}
