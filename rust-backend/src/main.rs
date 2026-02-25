mod config;
mod database;
mod error;
mod middleware;
mod models;
mod routes;
mod services;
mod socket;
mod state;

use crate::config::Config;
use crate::database::create_schema;
use crate::middleware::auth_middleware;
use crate::routes::*;
use crate::socket::handlers::*;
use crate::state::AppState;
use axum::{
    extract::DefaultBodyLimit,
    http::StatusCode,
    middleware as axum_middleware,
    routing::{delete, get, post},
    Router,
};
use socketioxide::extract::{Data, SocketRef};
use socketioxide::SocketIo;
use std::sync::Arc;
use std::time::Duration;
use tower::ServiceBuilder;
use tower_http::{
    cors::{Any, CorsLayer},
    services::ServeDir,
    timeout::TimeoutLayer,
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,tower_http=debug,axum=debug,socketioxide=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    let config = Config::from_env()?;
    tracing::info!("Starting TOR Chat Backend v0.2.0");
    tracing::info!("Server: {}:{}", config.host, config.port);
    tracing::info!("TOR enabled: {}", config.tor_enabled);

    // Connect to database
    let db_pool = sqlx::PgPool::connect(&config.database_url).await?;
    tracing::info!("Connected to PostgreSQL database");

    // Create database schema
    create_schema(&db_pool).await?;
    tracing::info!("Database schema initialized");

    // Create Socket.IO layer first
    let (socket_layer, io) = SocketIo::new_layer();

    // Create app state with SocketIo
    let state = Arc::new(AppState::new(db_pool, config.clone(), io.clone()));

    // Register Socket.IO event handlers
    // NOTE: We capture state via closures instead of using socketioxide's State
    // extractor, because SocketIo::new_layer() doesn't register any state and
    // AppState contains SocketIo (circular dependency prevents using the builder).
    let ns_state = state.clone();
    io.ns("/", move |socket: SocketRef| {
        let state = ns_state.clone();
        async move {
            tracing::info!("Socket connected: {}", socket.id);

            let s = state.clone();
            socket.on(
                "authenticate",
                move |socket: SocketRef, Data(data): Data<AuthData>| {
                    let state = s.clone();
                    async move { on_authenticate(socket, data, state).await }
                },
            );

            let s = state.clone();
            socket.on(
                "join_room",
                move |socket: SocketRef, Data(data): Data<JoinRoomData>| {
                    let state = s.clone();
                    async move { on_join_room(socket, data, state).await }
                },
            );

            socket.on("leave_room", on_leave_room);

            let s = state.clone();
            socket.on(
                "send_message",
                move |socket: SocketRef, Data(data): Data<SendMessageData>| {
                    let state = s.clone();
                    async move { on_send_message(socket, data, state).await }
                },
            );

            let s = state.clone();
            socket.on(
                "typing",
                move |socket: SocketRef, Data(data): Data<TypingData>| {
                    let state = s.clone();
                    async move { on_typing(socket, data, state).await }
                },
            );

            let s = state.clone();
            socket.on(
                "add_reaction",
                move |socket: SocketRef, Data(data): Data<ReactionData>| {
                    let state = s.clone();
                    async move { on_add_reaction(socket, data, state).await }
                },
            );

            let s = state.clone();
            socket.on(
                "remove_reaction",
                move |socket: SocketRef, Data(data): Data<ReactionData>| {
                    let state = s.clone();
                    async move { on_remove_reaction(socket, data, state).await }
                },
            );

            let s = state.clone();
            socket.on(
                "edit_message",
                move |socket: SocketRef, Data(data): Data<EditMessageData>| {
                    let state = s.clone();
                    async move { on_edit_message(socket, data, state).await }
                },
            );

            let s = state.clone();
            socket.on(
                "delete_message",
                move |socket: SocketRef, Data(data): Data<DeleteMessageData>| {
                    let state = s.clone();
                    async move { on_delete_message(socket, data, state).await }
                },
            );

            let s = state.clone();
            socket.on(
                "mark_read",
                move |socket: SocketRef, Data(data): Data<MarkReadData>| {
                    let state = s.clone();
                    async move { on_mark_read(socket, data, state).await }
                },
            );

            let s = state.clone();
            socket.on(
                "forward_message",
                move |socket: SocketRef, Data(data): Data<ForwardMessageData>| {
                    let state = s.clone();
                    async move { on_forward_message(socket, data, state).await }
                },
            );

            let s = state.clone();
            socket.on_disconnect(move |socket: SocketRef| {
                let state = s.clone();
                async move { on_disconnect(socket, state).await }
            });
        }
    });

    tracing::info!("Socket.IO handlers registered");

    // Configure CORS
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Public routes (no authentication required)
    let public_routes = Router::new()
        .route("/api/auth/register", post(register))
        .route("/api/auth/login", post(login))
        .route("/api/tor-status", get(tor::get_status));

    // Protected routes (authentication required)
    let protected_routes = Router::new()
        .route("/api/auth/logout", post(logout))
        .route("/api/auth/me", get(me))
        .route("/api/auth/users", get(list_users))
        // Rooms routes
        .route("/api/rooms", get(rooms::list_rooms))
        .route("/api/rooms", post(rooms::create_room))
        .route("/api/rooms/{id}", get(rooms::get_room))
        .route("/api/rooms/{id}/join", post(rooms::join_room))
        .route("/api/rooms/{id}/leave", post(rooms::leave_room))
        .route("/api/rooms/{id}", delete(rooms::delete_room))
        .route(
            "/api/rooms/{id}/messages",
            get(rooms::get_messages).post(rooms::send_message),
        )
        .route("/api/rooms/{id}/members", get(rooms::get_members))
        .route("/api/rooms/{id}/members", post(rooms::add_member))
        .route(
            "/api/rooms/{id}/members/{user_id}",
            delete(rooms::remove_member),
        )
        .route("/api/rooms/{id}/search", get(rooms::search_messages))
        // Upload route
        .route("/api/upload", post(upload_file))
        // Admin routes
        .route("/api/admin/users", get(admin::list_users))
        .route("/api/admin/users/{id}/promote", post(admin::promote_user))
        .route("/api/admin/users/{id}/demote", post(admin::demote_user))
        .route("/api/admin/users/{id}/ban", post(admin::ban_user))
        .route("/api/admin/users/{id}/unban", post(admin::unban_user))
        .route("/api/admin/users/{id}", delete(admin::delete_user))
        .route("/api/admin/rooms", get(admin::list_rooms))
        .route("/api/admin/rooms/{id}", delete(admin::delete_room))
        .route("/api/admin/stats", get(admin::get_stats))
        .route_layer(axum_middleware::from_fn_with_state(
            state.clone(),
            auth_middleware,
        ));

    // Health check route
    let health_route = Router::new().route("/health", get(|| async { "OK" }));

    // Serve static files (uploads)
    let static_routes = Router::new().nest_service("/uploads", ServeDir::new(&config.upload_dir));

    // Combine all routes
    let app = Router::new()
        .merge(health_route)
        .merge(public_routes)
        .merge(protected_routes)
        .merge(static_routes)
        .layer(socket_layer)
        .layer(DefaultBodyLimit::max(config.max_file_size))
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(cors)
                .layer(TimeoutLayer::with_status_code(
                    StatusCode::REQUEST_TIMEOUT,
                    Duration::from_secs(30),
                )),
        )
        .with_state(state.clone());

    // Start server
    let addr = format!("{}:{}", config.host, config.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;

    tracing::info!("🚀 Server listening on {}", addr);
    tracing::info!("📡 Socket.IO endpoint: ws://{}/socket.io/", addr);
    tracing::info!("📁 Upload directory: {}", config.upload_dir.display());
    tracing::info!("🔒 Max file size: {} bytes", config.max_file_size);

    if config.tor_enabled {
        tracing::info!(
            "🧅 TOR SOCKS proxy: {}:{}",
            config.tor_socks_host,
            config.tor_socks_port
        );

        // Check TOR connection on startup
        let tor_service = services::TorService::new(config.clone());
        match tor_service.check_connection().await {
            Ok(true) => {
                tracing::info!("✅ TOR connection verified");
                if let Some(onion_addr) = tor_service.get_hidden_service_address().await {
                    tracing::info!("🧅 Hidden service address: {}", onion_addr);
                }
            }
            Ok(false) => {
                tracing::warn!("⚠️ TOR is enabled but not connected");
            }
            Err(e) => {
                tracing::error!("❌ TOR connection check failed: {}", e);
            }
        }
    }

    axum::serve(listener, app).await?;

    Ok(())
}
