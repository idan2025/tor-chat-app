use crate::config::Config;
use crate::error::{AppError, Result};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String, // user_id
    pub exp: i64,
    pub iat: i64,
}

pub struct AuthService {
    config: Config,
}

impl AuthService {
    pub fn new(config: Config) -> Self {
        Self { config }
    }

    /// Generate JWT token
    pub fn generate_token(&self, user_id: Uuid) -> Result<String> {
        let now = Utc::now();
        let expires_at = now + Duration::seconds(self.config.jwt_expires_in);

        let claims = Claims {
            sub: user_id.to_string(),
            exp: expires_at.timestamp(),
            iat: now.timestamp(),
        };

        encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.config.jwt_secret.as_bytes()),
        )
        .map_err(|e| AppError::Internal(format!("Failed to generate token: {}", e)))
    }

    /// Verify JWT token
    pub fn verify_token(&self, token: &str) -> Result<Uuid> {
        let token_data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.config.jwt_secret.as_bytes()),
            &Validation::default(),
        )
        .map_err(|e| AppError::Authentication(format!("Invalid token: {}", e)))?;

        Uuid::parse_str(&token_data.claims.sub)
            .map_err(|e| AppError::Authentication(format!("Invalid user ID in token: {}", e)))
    }

    /// Hash password
    pub fn hash_password(&self, password: &str) -> Result<String> {
        bcrypt::hash(password, self.config.bcrypt_cost)
            .map_err(|e| AppError::Internal(format!("Failed to hash password: {}", e)))
    }

    /// Verify password
    pub fn verify_password(&self, password: &str, hash: &str) -> Result<bool> {
        bcrypt::verify(password, hash)
            .map_err(|e| AppError::Internal(format!("Failed to verify password: {}", e)))
    }
}
