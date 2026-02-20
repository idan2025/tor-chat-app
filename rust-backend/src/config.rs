use anyhow::Result;
use std::env;
use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub database_url: String,
    pub jwt_secret: String,
    pub jwt_expires_in: i64,
    pub bcrypt_cost: u32,
    pub tor_enabled: bool,
    pub tor_socks_host: String,
    pub tor_socks_port: u16,
    pub tor_control_port: u16,
    pub tor_hidden_service_dir: String,
    pub allowed_origins: Vec<String>,
    pub rate_limit_per_second: u64,
    pub rate_limit_burst_size: u32,
    pub max_file_size: usize,
    pub upload_dir: PathBuf,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        dotenvy::dotenv().ok();

        Ok(Config {
            host: env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            port: env::var("PORT")
                .unwrap_or_else(|_| "3000".to_string())
                .parse()?,
            database_url: env::var("DATABASE_URL").expect("DATABASE_URL must be set"),
            jwt_secret: env::var("JWT_SECRET").expect("JWT_SECRET must be set"),
            jwt_expires_in: env::var("JWT_EXPIRES_IN")
                .unwrap_or_else(|_| "86400".to_string())
                .parse()?,
            bcrypt_cost: env::var("BCRYPT_COST")
                .unwrap_or_else(|_| "12".to_string())
                .parse()?,
            tor_enabled: env::var("TOR_ENABLED")
                .unwrap_or_else(|_| "true".to_string())
                .parse()?,
            tor_socks_host: env::var("TOR_SOCKS_HOST").unwrap_or_else(|_| "127.0.0.1".to_string()),
            tor_socks_port: env::var("TOR_SOCKS_PORT")
                .unwrap_or_else(|_| "9050".to_string())
                .parse()?,
            tor_control_port: env::var("TOR_CONTROL_PORT")
                .unwrap_or_else(|_| "9051".to_string())
                .parse()?,
            tor_hidden_service_dir: env::var("TOR_HIDDEN_SERVICE_DIR")
                .unwrap_or_else(|_| "/var/lib/tor/hidden_service".to_string()),
            allowed_origins: env::var("ALLOWED_ORIGINS")
                .unwrap_or_else(|_| "http://localhost:5173".to_string())
                .split(',')
                .map(|s| s.trim().to_string())
                .collect(),
            rate_limit_per_second: env::var("RATE_LIMIT_PER_SECOND")
                .unwrap_or_else(|_| "10".to_string())
                .parse()?,
            rate_limit_burst_size: env::var("RATE_LIMIT_BURST_SIZE")
                .unwrap_or_else(|_| "20".to_string())
                .parse()?,
            max_file_size: env::var("MAX_FILE_SIZE")
                .unwrap_or_else(|_| "1073741824".to_string())
                .parse()?,
            upload_dir: Self::validated_upload_dir()?,
        })
    }

    fn validated_upload_dir() -> Result<PathBuf> {
        let raw = env::var("UPLOAD_DIR").unwrap_or_else(|_| "./uploads".to_string());

        // Reject path traversal sequences
        if raw.contains("..") {
            anyhow::bail!("UPLOAD_DIR must not contain '..'");
        }

        // Ensure the directory exists and resolve to an absolute canonical path
        std::fs::create_dir_all(&raw)?;
        let canonical = std::path::Path::new(&raw).canonicalize()?;
        Ok(canonical)
    }

    pub fn server_addr(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }
}
