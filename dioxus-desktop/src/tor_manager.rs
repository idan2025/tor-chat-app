use arti_client::{BootstrapBehavior, TorClient, TorClientConfig};
use futures_util::StreamExt;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::io::{self, AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::{watch, RwLock};
use tor_rtcompat::PreferredRuntime;
use tracing::{error, info, warn};

#[derive(Debug, Clone, PartialEq)]
pub enum TorStatus {
    Stopped,
    Bootstrapping(u8),
    Connected { socks_port: u16 },
    Error(String),
}

pub struct TorManager {
    status: watch::Sender<TorStatus>,
    status_rx: watch::Receiver<TorStatus>,
    tor_client: Arc<RwLock<Option<TorClient<PreferredRuntime>>>>,
}

impl TorManager {
    pub fn new() -> Self {
        let (tx, rx) = watch::channel(TorStatus::Stopped);
        Self {
            status: tx,
            status_rx: rx,
            tor_client: Arc::new(RwLock::new(None)),
        }
    }

    pub fn status_receiver(&self) -> watch::Receiver<TorStatus> {
        self.status_rx.clone()
    }

    pub fn current_status(&self) -> TorStatus {
        self.status_rx.borrow().clone()
    }

    pub fn is_onion_url(url: &str) -> bool {
        let lower = url.to_lowercase();
        lower.contains(".onion") && !lower.contains(".onion.")
    }

    /// Normalize a .onion URL: ensure it has http:// prefix (not https, Tor provides encryption)
    pub fn normalize_onion_url(url: &str) -> String {
        let trimmed = url.trim();
        if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
            if Self::is_onion_url(trimmed) && trimmed.starts_with("https://") {
                format!("http://{}", &trimmed[8..])
            } else {
                trimmed.to_string()
            }
        } else {
            format!("http://{}", trimmed)
        }
    }

    fn get_tor_data_dir() -> PathBuf {
        directories::ProjectDirs::from("com", "torchat", "desktop")
            .map(|dirs| dirs.data_dir().join("tor"))
            .unwrap_or_else(|| PathBuf::from("./tor_data"))
    }

    /// Bootstrap the Tor client and start a local SOCKS5 proxy.
    /// Returns the SOCKS5 port on success.
    pub async fn bootstrap(&self) -> Result<u16, String> {
        if let TorStatus::Connected { socks_port } = self.current_status() {
            return Ok(socks_port);
        }

        let _ = self.status.send(TorStatus::Bootstrapping(0));

        let data_dir = Self::get_tor_data_dir();
        let cache_dir = data_dir.join("cache");

        let config = TorClientConfig::builder()
            .storage()
            .state_dir(data_dir.clone())
            .cache_dir(cache_dir)
            .build()
            .map_err(|e| format!("Storage config error: {e}"))?
            .build()
            .map_err(|e| format!("Tor config error: {e}"))?;

        let tor = TorClient::with_runtime(
            PreferredRuntime::current().map_err(|e| format!("Runtime error: {e}"))?,
        )
        .config(config)
        .bootstrap_behavior(BootstrapBehavior::Manual)
        .create_unbootstrapped()
        .map_err(|e| format!("Failed to create Tor client: {e}"))?;

        // Spawn progress monitor
        let status_tx = self.status.clone();
        let mut events = tor.bootstrap_events();
        tokio::spawn(async move {
            loop {
                match events.next().await {
                    Some(status) => {
                        let pct = (status.as_frac().clamp(0.0, 1.0) * 100.0) as u8;
                        let _ = status_tx.send(TorStatus::Bootstrapping(pct));
                    }
                    None => break,
                }
            }
        });

        info!("Bootstrapping Tor...");
        tor.bootstrap().await.map_err(|e| {
            let msg = format!("Tor bootstrap failed: {e}");
            error!("{}", msg);
            let _ = self.status.send(TorStatus::Error(msg.clone()));
            msg
        })?;

        info!("Tor bootstrap complete");
        *self.tor_client.write().await = Some(tor.clone());

        let socks_port = self.start_socks_bridge(tor).await?;

        let _ = self.status.send(TorStatus::Connected { socks_port });
        Ok(socks_port)
    }

    async fn start_socks_bridge(&self, tor: TorClient<PreferredRuntime>) -> Result<u16, String> {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .map_err(|e| format!("Failed to bind SOCKS5 listener: {e}"))?;

        let port = listener
            .local_addr()
            .map_err(|e| format!("Failed to get local addr: {e}"))?
            .port();

        info!("SOCKS5 bridge listening on 127.0.0.1:{}", port);

        tokio::spawn(async move {
            loop {
                match listener.accept().await {
                    Ok((stream, _addr)) => {
                        let tor = tor.clone();
                        tokio::spawn(async move {
                            if let Err(e) = handle_socks5_connection(stream, tor).await {
                                warn!("SOCKS5 connection error: {e}");
                            }
                        });
                    }
                    Err(e) => {
                        error!("SOCKS5 accept error: {e}");
                    }
                }
            }
        });

        Ok(port)
    }

    pub async fn stop(&self) {
        *self.tor_client.write().await = None;
        let _ = self.status.send(TorStatus::Stopped);
    }
}

/// Minimal SOCKS5 server handler that bridges connections through Tor.
/// Implements RFC 1928 (SOCKS5) — just enough for CONNECT commands.
async fn handle_socks5_connection(
    mut stream: tokio::net::TcpStream,
    tor: TorClient<PreferredRuntime>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // === Auth negotiation ===
    // Client sends: VER(1) NMETHODS(1) METHODS(1..255)
    let ver = stream.read_u8().await?;
    if ver != 0x05 {
        return Err(format!("Unsupported SOCKS version: {ver}").into());
    }
    let nmethods = stream.read_u8().await?;
    let mut methods = vec![0u8; nmethods as usize];
    stream.read_exact(&mut methods).await?;

    // We only support no-auth (0x00)
    if methods.contains(&0x00) {
        stream.write_all(&[0x05, 0x00]).await?; // VER=5, METHOD=no-auth
    } else {
        stream.write_all(&[0x05, 0xFF]).await?; // No acceptable methods
        return Err("Client doesn't support no-auth".into());
    }

    // === Command request ===
    // Client sends: VER(1) CMD(1) RSV(1) ATYP(1) DST.ADDR(variable) DST.PORT(2)
    let ver = stream.read_u8().await?;
    let cmd = stream.read_u8().await?;
    let _rsv = stream.read_u8().await?;
    let atyp = stream.read_u8().await?;

    if ver != 0x05 || cmd != 0x01 {
        // Only support CONNECT (0x01)
        // Reply: general failure
        stream
            .write_all(&[0x05, 0x07, 0x00, 0x01, 0, 0, 0, 0, 0, 0])
            .await?;
        return Err(format!("Unsupported SOCKS5 command: {cmd}").into());
    }

    let target_host = match atyp {
        0x01 => {
            // IPv4: 4 bytes
            let mut addr = [0u8; 4];
            stream.read_exact(&mut addr).await?;
            format!("{}.{}.{}.{}", addr[0], addr[1], addr[2], addr[3])
        }
        0x03 => {
            // Domain name: 1 byte length + domain
            let len = stream.read_u8().await? as usize;
            let mut domain = vec![0u8; len];
            stream.read_exact(&mut domain).await?;
            String::from_utf8(domain)?
        }
        0x04 => {
            // IPv6: 16 bytes
            let mut addr = [0u8; 16];
            stream.read_exact(&mut addr).await?;
            let ipv6 = std::net::Ipv6Addr::from(addr);
            format!("{}", ipv6)
        }
        _ => {
            stream
                .write_all(&[0x05, 0x08, 0x00, 0x01, 0, 0, 0, 0, 0, 0])
                .await?;
            return Err(format!("Unsupported address type: {atyp}").into());
        }
    };

    let target_port = stream.read_u16().await?;

    info!("SOCKS5 CONNECT to {}:{}", target_host, target_port);

    // === Connect through Tor ===
    let tor_stream = match tor
        .connect(format!("{}:{}", target_host, target_port).as_str())
        .await
    {
        Ok(s) => s,
        Err(e) => {
            warn!(
                "Tor connect to {}:{} failed: {}",
                target_host, target_port, e
            );
            // Reply: host unreachable
            stream
                .write_all(&[0x05, 0x04, 0x00, 0x01, 0, 0, 0, 0, 0, 0])
                .await?;
            return Err(format!("Tor connect failed: {e}").into());
        }
    };

    // === Reply success ===
    // VER=5, REP=0(success), RSV=0, ATYP=1(IPv4), BND.ADDR=0.0.0.0, BND.PORT=0
    stream
        .write_all(&[0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0])
        .await?;

    // === Bidirectional relay ===
    let (mut client_reader, mut client_writer) = io::split(stream);
    let (mut tor_reader, mut tor_writer) = io::split(tor_stream);

    tokio::select! {
        r = io::copy(&mut client_reader, &mut tor_writer) => {
            if let Err(e) = r { warn!("Client->Tor relay error: {e}"); }
        }
        r = io::copy(&mut tor_reader, &mut client_writer) => {
            if let Err(e) = r { warn!("Tor->Client relay error: {e}"); }
        }
    }

    Ok(())
}
