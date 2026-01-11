use gloo_storage::{LocalStorage, Storage};

const TOKEN_KEY: &str = "auth_token";
const SERVER_URL_KEY: &str = "server_url";

pub fn save_token(token: &str) {
    let _ = LocalStorage::set(TOKEN_KEY, token);
}

pub fn get_token() -> Option<String> {
    LocalStorage::get(TOKEN_KEY).ok()
}

pub fn remove_token() {
    LocalStorage::delete(TOKEN_KEY);
}

pub fn save_server_url(url: &str) {
    let _ = LocalStorage::set(SERVER_URL_KEY, url);
}

pub fn get_server_url() -> Option<String> {
    LocalStorage::get(SERVER_URL_KEY).ok()
}
