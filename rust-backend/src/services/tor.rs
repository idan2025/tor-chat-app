use crate::config::Config;
use crate::error::{AppError, Result};
use std::path::Path;
use tokio::fs;
use tokio_socks::tcp::Socks5Stream;

pub struct TorService {
    config: Config,
}

impl TorService {
    pub fn new(config: Config) -> Self {
        Self { config }
    }

    /// Check TOR connection
    pub async fn check_connection(&self) -> Result<bool> {
        if !self.config.tor_enabled {
            return Ok(false);
        }

        match Socks5Stream::connect(
            format!("{}:{}", self.config.tor_socks_host, self.config.tor_socks_port),
            "check.torproject.org:80",
        )
        .await
        {
            Ok(_) => {
                tracing::info!("TOR connection verified");
                Ok(true)
            }
            Err(e) => {
                tracing::warn!("TOR connection check failed: {}", e);
                Ok(false)
            }
        }
    }

    /// Get hidden service .onion address
    pub async fn get_hidden_service_address(&self) -> Option<String> {
        if !self.config.tor_enabled {
            return None;
        }

        // Try multiple possible locations
        let possible_paths = vec![
            format!("{}/service1/hostname", self.config.tor_hidden_service_dir),
            format!("{}/hostname", self.config.tor_hidden_service_dir),
        ];

        for path in possible_paths {
            if let Ok(content) = fs::read_to_string(&path).await {
                let onion = content.trim().to_string();
                if !onion.is_empty() {
                    tracing::info!("Hidden service found: {}", onion);
                    return Some(onion);
                }
            }
        }

        None
    }

    /// Get connection info
    pub fn get_connection_info(&self) -> ConnectionInfo {
        ConnectionInfo {
            enabled: self.config.tor_enabled,
            socks_host: self.config.tor_socks_host.clone(),
            socks_port: self.config.tor_socks_port,
            hidden_service: None,
        }
    }

    /// Display TOR status on startup
    pub async fn display_status(&self) {
        if !self.config.tor_enabled {
            tracing::info!("TOR: Disabled");
            return;
        }

        let connected = self.check_connection().await.unwrap_or(false);
        let hidden_service = self.get_hidden_service_address().await;

        if connected {
            tracing::info!("╔════════════════════════════════════════════════════════════════════╗");
            tracing::info!("║                  TOR CONNECTION ACTIVE                             ║");
            tracing::info!("╠════════════════════════════════════════════════════════════════════╣");
            tracing::info!("║  SOCKS Proxy: {}:{:<48}║",
                self.config.tor_socks_host,
                self.config.tor_socks_port
            );

            if let Some(onion) = hidden_service {
                tracing::info!("║  Hidden Service: http://{:<43}║", onion);
            }

            tracing::info!("╠════════════════════════════════════════════════════════════════════╣");
            tracing::info!("║  All traffic routed through TOR for maximum privacy               ║");
            tracing::info!("╚════════════════════════════════════════════════════════════════════╝");
        } else {
            tracing::warn!("TOR: Enabled but not connected. Retrying...");
        }
    }
}

#[derive(Debug, serde::Serialize)]
pub struct ConnectionInfo {
    pub enabled: bool,
    pub socks_host: String,
    pub socks_port: u16,
    pub hidden_service: Option<String>,
}
