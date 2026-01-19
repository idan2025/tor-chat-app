use crate::error::AppError;
use axum::{extract::FromRequest, http::Request, Json};
use serde::de::DeserializeOwned;
use validator::Validate;

pub struct ValidatedJson<T>(pub T);

impl<T, S> FromRequest<S> for ValidatedJson<T>
where
    T: DeserializeOwned + Validate,
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request(
        req: Request<axum::body::Body>,
        state: &S,
    ) -> std::result::Result<Self, Self::Rejection> {
        let Json(data) = Json::<T>::from_request(req, state)
            .await
            .map_err(|e| AppError::Validation(format!("Invalid JSON: {}", e)))?;

        data.validate()
            .map_err(|e| AppError::Validation(format!("Validation failed: {}", e)))?;

        Ok(ValidatedJson(data))
    }
}
