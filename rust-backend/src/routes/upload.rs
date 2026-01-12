use crate::error::{AppError, Result};
use crate::middleware::AuthUser;
use crate::state::AppState;
use axum::{
    extract::{Multipart, State},
    Extension, Json,
};
use std::sync::Arc;
use tokio::fs;
use tokio::io::AsyncWriteExt;

pub async fn upload_file(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthUser>,
    mut multipart: Multipart,
) -> Result<Json<serde_json::Value>> {
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::Upload(format!("Failed to read multipart field: {}", e)))?
    {
        if field.name() == Some("file") {
            let filename = field
                .file_name()
                .ok_or_else(|| AppError::Upload("No filename provided".to_string()))?
                .to_string();

            let content_type = field
                .content_type()
                .ok_or_else(|| AppError::Upload("No content type provided".to_string()))?
                .to_string();

            // Validate file type
            let allowed_types = [
                "image/jpeg",
                "image/png",
                "image/gif",
                "image/webp",
                "video/mp4",
                "video/webm",
                "video/ogg",
                "application/pdf",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/vnd.ms-excel",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "text/plain",
            ];

            if !allowed_types.contains(&content_type.as_str()) {
                return Err(AppError::Upload(
                    "Invalid file type. Allowed: images, videos, PDFs, documents.".to_string(),
                ));
            }

            let data = field
                .bytes()
                .await
                .map_err(|e| AppError::Upload(format!("Failed to read file data: {}", e)))?;

            // Check file size
            if data.len() > state.config.max_file_size {
                return Err(AppError::Upload(
                    "File too large. Maximum size is 1GB.".to_string(),
                ));
            }

            // Generate unique filename
            let ext = std::path::Path::new(&filename)
                .extension()
                .and_then(|s| s.to_str())
                .unwrap_or("bin");
            let unique_filename = format!(
                "{}-{}.{}",
                chrono::Utc::now().timestamp_millis(),
                uuid::Uuid::new_v4(),
                ext
            );

            // Create upload directory if it doesn't exist
            fs::create_dir_all(&state.config.upload_dir)
                .await
                .map_err(|e| {
                    AppError::Internal(format!("Failed to create upload directory: {}", e))
                })?;

            // Write file
            let file_path = format!("{}/{}", state.config.upload_dir, unique_filename);
            let mut file = fs::File::create(&file_path)
                .await
                .map_err(|e| AppError::Internal(format!("Failed to create file: {}", e)))?;

            file.write_all(&data)
                .await
                .map_err(|e| AppError::Internal(format!("Failed to write file: {}", e)))?;

            let file_url = format!("/uploads/{}", unique_filename);

            tracing::info!(
                "File uploaded by user {}: {}",
                auth.user_id,
                unique_filename
            );

            return Ok(Json(serde_json::json!({
                "message": "File uploaded successfully",
                "file": {
                    "url": file_url,
                    "filename": unique_filename,
                    "originalName": filename,
                    "mimetype": content_type,
                    "size": data.len(),
                }
            })));
        }
    }

    Err(AppError::Upload("No file uploaded".to_string()))
}
