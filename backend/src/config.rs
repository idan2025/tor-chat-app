use anyhow::Result;
use once_cell::sync::Lazy;
use serde::Deserialize;
use std::env;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub jwt: JwtConfig,
    pub bcrypt: BcryptConfig,
    pub tor: TorConfig,
    pub cors: CorsConfig,
    pub rate_limit: RateLimitConfig,
    pub upload: UploadConfig,
    pub features: FeaturesConfig,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DatabaseConfig {
    pub url: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct JwtConfig {
    pub secret: String,
    pub expires_in: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct BcryptConfig {
    pub cost: u32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TorConfig {
    pub enabled: bool,
    pub socks_host: String,
    pub socks_port: u16,
    pub control_port: u16,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CorsConfig {
    pub allowed_origins: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RateLimitConfig {
    pub per_second: u64,
    pub burst_size: u32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UploadConfig {
    pub max_file_size: usize,
    pub upload_dir: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct FeaturesConfig {
    pub enable_link_preview: bool,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        dotenvy::dotenv().ok();

        let config = Config {
            server: ServerConfig {
                host: env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
                port: env::var("PORT")
                    .unwrap_or_else(|_| "3000".to_string())
                    .parse()?,
            },
            database: DatabaseConfig {
                url: env::var("DATABASE_URL")
                    .expect("DATABASE_URL must be set"),
            },
            jwt: JwtConfig {
                secret: env::var("JWT_SECRET")
                    .expect("JWT_SECRET must be set"),
                expires_in: env::var("JWT_EXPIRES_IN")
                    .unwrap_or_else(|_| "86400".to_string())
                    .parse()?,
            },
            bcrypt: BcryptConfig {
                cost: env::var("BCRYPT_COST")
                    .unwrap_or_else(|_| "12".to_string())
                    .parse()?,
            },
            tor: TorConfig {
                enabled: env::var("TOR_ENABLED")
                    .unwrap_or_else(|_| "false".to_string())
                    .parse()?,
                socks_host: env::var("TOR_SOCKS_HOST")
                    .unwrap_or_else(|_| "127.0.0.1".to_string()),
                socks_port: env::var("TOR_SOCKS_PORT")
                    .unwrap_or_else(|_| "9050".to_string())
                    .parse()?,
                control_port: env::var("TOR_CONTROL_PORT")
                    .unwrap_or_else(|_| "9051".to_string())
                    .parse()?,
            },
            cors: CorsConfig {
                allowed_origins: env::var("ALLOWED_ORIGINS")
                    .unwrap_or_else(|_| "http://localhost:5173".to_string())
                    .split(',')
                    .map(|s| s.trim().to_string())
                    .collect(),
            },
            rate_limit: RateLimitConfig {
                per_second: env::var("RATE_LIMIT_PER_SECOND")
                    .unwrap_or_else(|_| "10".to_string())
                    .parse()?,
                burst_size: env::var("RATE_LIMIT_BURST_SIZE")
                    .unwrap_or_else(|_| "20".to_string())
                    .parse()?,
            },
            upload: UploadConfig {
                max_file_size: env::var("MAX_FILE_SIZE")
                    .unwrap_or_else(|_| "1073741824".to_string())
                    .parse()?,
                upload_dir: env::var("UPLOAD_DIR")
                    .unwrap_or_else(|_| "./uploads".to_string()),
            },
            features: FeaturesConfig {
                enable_link_preview: env::var("ENABLE_LINK_PREVIEW")
                    .unwrap_or_else(|_| "true".to_string())
                    .parse()?,
            },
        };

        Ok(config)
    }

    pub fn server_addr(&self) -> String {
        format!("{}:{}", self.server.host, self.server.port)
    }
}

pub static CONFIG: Lazy<Config> = Lazy::new(|| {
    Config::from_env().expect("Failed to load configuration")
});
