use crate::config::Config;
use crate::models::user::User;
use socketioxide::SocketIo;
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub config: Config,
    pub io: SocketIo,
    pub user_sockets: Arc<RwLock<HashMap<Uuid, Vec<String>>>>, // user_id -> socket_ids
    pub socket_users: Arc<RwLock<HashMap<String, (Uuid, User)>>>, // socket_id -> (user_id, user)
}

impl AppState {
    pub fn new(db: PgPool, config: Config, io: SocketIo) -> Self {
        Self {
            db,
            config,
            io,
            user_sockets: Arc::new(RwLock::new(HashMap::new())),
            socket_users: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn add_user_socket(&self, user_id: Uuid, socket_id: String) {
        let mut sockets = self.user_sockets.write().await;
        sockets
            .entry(user_id)
            .or_insert_with(Vec::new)
            .push(socket_id);
    }

    pub async fn remove_user_socket(&self, user_id: Uuid, socket_id: &str) -> bool {
        let mut sockets = self.user_sockets.write().await;
        if let Some(user_sockets) = sockets.get_mut(&user_id) {
            user_sockets.retain(|id| id != socket_id);
            if user_sockets.is_empty() {
                sockets.remove(&user_id);
                return true; // User is now offline
            }
        }
        false
    }

    pub async fn is_user_online(&self, user_id: Uuid) -> bool {
        let sockets = self.user_sockets.read().await;
        sockets.contains_key(&user_id)
    }

    pub async fn associate_socket_user(&self, socket_id: String, user_id: Uuid, user: User) {
        let mut socket_users = self.socket_users.write().await;
        socket_users.insert(socket_id, (user_id, user));
    }

    pub async fn get_socket_user(&self, socket_id: &str) -> Option<(Uuid, User)> {
        let socket_users = self.socket_users.read().await;
        socket_users.get(socket_id).cloned()
    }

    pub async fn remove_socket_user(&self, socket_id: &str) {
        let mut socket_users = self.socket_users.write().await;
        socket_users.remove(socket_id);
    }
}
