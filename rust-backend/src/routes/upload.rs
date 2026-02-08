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

            // Generate unique filename with sanitized extension
            let ext = std::path::Path::new(&filename)
                .extension()
                .and_then(|s| s.to_str())
                .unwrap_or("bin");

            // Sanitize extension: only allow alphanumeric characters
            let safe_ext: String = ext
                .chars()
                .filter(|c| c.is_ascii_alphanumeric())
                .take(10)
                .collect();
            let safe_ext = if safe_ext.is_empty() { "bin".to_string() } else { safe_ext };

            let unique_filename = format!(
                "{}-{}.{}",
                chrono::Utc::now().timestamp_millis(),
                uuid::Uuid::new_v4(),
                safe_ext
            );

            // Create upload directory if it doesn't exist
            let upload_dir = std::path::Path::new(&state.config.upload_dir)
                .canonicalize()
                .or_else(|_| {
                    // Directory may not exist yet; canonicalize the parent
                    std::fs::create_dir_all(&state.config.upload_dir)
                        .and_then(|_| std::path::Path::new(&state.config.upload_dir).canonicalize())
                })
                .map_err(|e| {
                    AppError::Internal(format!("Failed to resolve upload directory: {}", e))
                })?;

            // Construct file path and verify it stays within the upload directory
            let file_path = upload_dir.join(&unique_filename);
            let file_path = file_path
                .canonicalize()
                .unwrap_or_else(|_| upload_dir.join(&unique_filename));

            if !file_path.starts_with(&upload_dir) {
                return Err(AppError::Upload("Invalid file path".to_string()));
            }

            // Write file
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
