use crate::api::ApiClient;
use crate::utils::storage;

pub async fn verify_token(token: &str) -> Result<(), String> {
    storage::save_token(token);
    let api = ApiClient::new();
    api.get_me().await?;
    Ok(())
}

pub async fn logout() {
    storage::remove_token();
    let api = ApiClient::new();
    let _ = api.logout().await;
}
