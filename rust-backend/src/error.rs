use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Authentication failed: {0}")]
    Authentication(String),

    #[error("Access denied: {0}")]
    Authorization(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Internal server error: {0}")]
    Internal(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("TOR error: {0}")]
    Tor(String),

    #[error("Encryption error: {0}")]
    Encryption(String),

    #[error("File upload error: {0}")]
    Upload(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_type, details) = match &self {
            AppError::Database(e) => {
                tracing::error!("Database error: {}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "database_error",
                    self.to_string(),
                )
            }
            AppError::Authentication(_) => (
                StatusCode::UNAUTHORIZED,
                "authentication_failed",
                self.to_string(),
            ),
            AppError::Authorization(_) => {
                (StatusCode::FORBIDDEN, "access_denied", self.to_string())
            }
            AppError::Validation(_) => (
                StatusCode::BAD_REQUEST,
                "validation_error",
                self.to_string(),
            ),
            AppError::NotFound(_) => (StatusCode::NOT_FOUND, "not_found", self.to_string()),
            AppError::Conflict(_) => (StatusCode::CONFLICT, "conflict", self.to_string()),
            AppError::Internal(e) => {
                tracing::error!("Internal error: {}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "internal_error",
                    self.to_string(),
                )
            }
            AppError::BadRequest(_) => (StatusCode::BAD_REQUEST, "bad_request", self.to_string()),
            AppError::Tor(_) => (
                StatusCode::SERVICE_UNAVAILABLE,
                "tor_unavailable",
                self.to_string(),
            ),
            AppError::Encryption(e) => {
                tracing::error!("Encryption error: {}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "encryption_error",
                    "Encryption failed".to_string(),
                )
            }
            AppError::Upload(_) => (StatusCode::BAD_REQUEST, "upload_error", self.to_string()),
        };

        let body = Json(json!({
            "error": error_type,
            "details": details,
        }));

        (status, body).into_response()
    }
}

pub type Result<T> = std::result::Result<T, AppError>;
