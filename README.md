# TOR Chat App - Secure & Encrypted Communication

[![Rust Backend](https://github.com/idan2025/tor-chat-app/actions/workflows/rust-backend.yml/badge.svg)](https://github.com/idan2025/tor-chat-app/actions/workflows/rust-backend.yml)
[![Flutter Android](https://github.com/idan2025/tor-chat-app/actions/workflows/flutter-android.yml/badge.svg)](https://github.com/idan2025/tor-chat-app/actions/workflows/flutter-android.yml)
[![Dioxus Web](https://github.com/idan2025/tor-chat-app/actions/workflows/dioxus-web.yml/badge.svg)](https://github.com/idan2025/tor-chat-app/actions/workflows/dioxus-web.yml)
[![Code Quality](https://github.com/idan2025/tor-chat-app/actions/workflows/code-quality.yml/badge.svg)](https://github.com/idan2025/tor-chat-app/actions/workflows/code-quality.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A production-ready, end-to-end encrypted chat application built with **Rust**, **Flutter**, and **Dioxus**, running over TOR for maximum privacy and security.

## ⚖️ Legal Disclaimer

**IMPORTANT: READ BEFORE USING THIS SOFTWARE**

This software is provided for **educational and legitimate privacy purposes only**. The developers and maintainers of TOR Chat App:

- **Are completely neutral** regarding how this software is used
- **Take no responsibility** for any illegal actions, crimes, or unlawful activities conducted using this application
- **Do not endorse, support, or condone** any illegal use of this software
- **Are not liable** for any damages, legal consequences, or harm resulting from the use or misuse of this application

This application utilizes the **TOR network**, which is designed to provide anonymity and privacy. While anonymity is a fundamental right and has many legitimate uses (protecting journalists, whistleblowers, activists, and users in oppressive regimes), it can also be misused.

**Users are solely responsible for:**
- Complying with all applicable local, national, and international laws
- Using this software in a lawful and ethical manner
- Understanding the legal implications of using anonymity tools in their jurisdiction
- Any consequences arising from their use of this application

**By using this software, you acknowledge that:**
- You will use it only for lawful purposes
- You understand the risks associated with anonymous communication
- The developers bear no responsibility for your actions

If you do not agree with this disclaimer, **DO NOT USE THIS SOFTWARE**.

---

## Features

### Core Features
- **End-to-End Encryption (E2EE)**: All messages encrypted with libsodium (ChaCha20-Poly1305)
- **TOR Integration**: Complete anonymity via TOR SOCKS5 proxy and hidden services
- **Real-time Communication**: Socket.IO-based instant messaging with typing indicators
- **Multi-Platform**: Web (WASM), Desktop (Windows/macOS/Linux), and Android
- **Production Ready**: Docker Compose deployment, PostgreSQL database, JWT authentication

### Security Features
- **E2EE Encryption**: X25519 key exchange + ChaCha20-Poly1305 AEAD
- **Password Security**: bcrypt hashing (configurable rounds)
- **TOR Anonymity**: All traffic routed through TOR network with .onion hidden service support
- **Admin Controls**: User management, bans, room moderation
- **File Upload Validation**: Blocks dangerous file types (executables)
- **Rate Limiting**: Configurable request rate limiting

### Chat Features
- **Chat Rooms**: Public and private encrypted rooms
- **Room Management**: Create, join, leave, delete rooms
- **Message Features**: Edit, delete, forward, reactions
- **Message Pinning**: Pin important messages in rooms
- **Quoted Replies**: Reply to specific messages with context
- **Unread Badges**: Track unread messages per room with read status
- **File Sharing**: Upload and share files (images, videos, documents, archives)
- **Typing Indicators**: Real-time typing status
- **User Presence**: Online/offline status tracking
- **Message Search**: Full-text search within rooms
- **Admin Dashboard**: Server statistics and user management

---

## Architecture

```
┌─────────────────┐
│   TOR Network   │
└────────┬────────┘
         │
    ┌────▼────────────────┐
    │   Rust Backend      │
    │ Axum + socketioxide │
    │  PostgreSQL + E2EE  │
    └────┬────────────────┘
         │
    ┌────┴────────────────────┬─────────────────┐
    ▼                         ▼                 ▼
┌──────────┐          ┌──────────────┐    ┌──────────┐
│ Dioxus   │          │   Dioxus     │    │ Flutter  │
│   Web    │          │   Desktop    │    │ Android  │
│ (WASM)   │          │ (Native App) │    │  (APK)   │
└──────────┘          └──────────────┘    └──────────┘
```

### Technology Stack

**Backend** (Rust):
- **Framework**: Axum 0.8 (async web framework)
- **Real-time**: socketioxide 0.18 (Socket.IO server)
- **Database**: PostgreSQL 15 with sqlx 0.8
- **Encryption**: sodiumoxide 0.2 (libsodium bindings)
- **Authentication**: JWT (jsonwebtoken 10.3) + bcrypt 0.18
- **TOR**: tokio-socks 0.5 (SOCKS5 proxy client)
- **HTTP Client**: reqwest 0.13 (with SOCKS proxy support)

**Android** (Flutter):
- **SDK**: Dart >=3.5.0
- **State**: Riverpod (reactive state management with code generation)
- **HTTP**: Dio 5.4
- **Encryption**: sodium_libs + cryptography
- **Real-time**: socket_io_client
- **TOR**: tor + socks5_proxy (embedded Arti-based TOR)
- **Storage**: sqflite + flutter_secure_storage

**Web** (Dioxus WASM):
- **Framework**: Dioxus 0.7 (React-like Rust framework)
- **Build**: WASM compilation with Trunk, served by nginx
- **HTTP**: reqwest 0.13 with async/await
- **WebSocket**: gloo-net 0.6
- **Storage**: gloo-storage (browser localStorage)

**Desktop** (Dioxus Native):
- **Framework**: Dioxus 0.7 (native desktop)
- **TOR**: arti-client 0.39 (embedded TOR client)
- **WebSocket**: tokio-tungstenite 0.27

---

## Quick Start with Docker

The fastest way to get TOR Chat running:

```bash
# Clone repository
git clone https://github.com/idan2025/tor-chat-app.git
cd tor-chat-app

# Set your JWT secret (required)
export JWT_SECRET=$(openssl rand -hex 32)

# Start with pre-built images (recommended)
docker compose -f docker-compose.prod.yml up -d

# Access the application
# Web UI: http://localhost:9274
```

The first registered user automatically becomes an admin.

**See [DOCKER.md](DOCKER.md) for complete Docker deployment guide.**

---

## Development Setup

### Prerequisites

**Backend**:
- Rust (install from [rustup.rs](https://rustup.rs))
- PostgreSQL 15+
- libsodium development libraries

**Android**:
- Flutter (Dart SDK >=3.5.0)
- Android SDK / Android Studio

**Web**:
- Rust + Trunk: `cargo install trunk`
- wasm32 target: `rustup target add wasm32-unknown-unknown`

### Backend Setup

```bash
cd rust-backend

# Install dependencies (Ubuntu/Debian)
sudo apt-get install -y libsodium-dev postgresql

# Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and JWT_SECRET

# Build and run (schema is created automatically on startup)
cargo run --release
```

### Flutter Android Setup

```bash
cd flutter-app

# Get dependencies
flutter pub get

# Run on connected device/emulator
flutter run

# Or build APK
flutter build apk --release
```

### Dioxus Web Setup

```bash
cd dioxus-web

# Build and serve
trunk serve --release
```

### Dioxus Desktop Setup

```bash
cd dioxus-desktop
cargo run --release
```

---

## Docker Deployment

The project includes two Docker Compose configurations:

- **`docker-compose.yml`** - Builds all services from source
- **`docker-compose.prod.yml`** - Uses pre-built images from Docker Hub

### Services

| Service | Description | Port |
|---------|-------------|------|
| **postgres** | PostgreSQL 15 Alpine | 5432 (dev only) |
| **tor** | TOR daemon with hidden service | Internal |
| **backend** | Rust API + Socket.IO server | 3000 (dev only) |
| **web** | Dioxus WASM app via nginx | 9274 (configurable via `WEB_PORT`) |

Nginx proxies `/api/` and `/socket.io/` requests to the backend, so only the web port needs to be exposed in production.

### Deploy with Pre-built Images

```bash
JWT_SECRET=<your-secret> docker compose -f docker-compose.prod.yml up -d
```

### Build from Source

```bash
docker compose up -d --build
```

---

## Project Structure

```
tor-chat-app/
├── rust-backend/              # Rust backend server
│   ├── src/
│   │   ├── main.rs           # Server entry point & route wiring
│   │   ├── config.rs         # Environment configuration
│   │   ├── database.rs       # PostgreSQL schema (auto-created)
│   │   ├── error.rs          # Error types
│   │   ├── state.rs          # App state (DB pool, config, SocketIo)
│   │   ├── models/           # Data models (user, room, message, room_member)
│   │   ├── services/         # Business logic (auth, crypto, tor)
│   │   ├── middleware/        # HTTP middleware (JWT auth, validation)
│   │   ├── routes/           # REST API (auth, rooms, admin, upload, tor)
│   │   └── socket/           # Socket.IO real-time handlers
│   ├── Cargo.toml
│   └── Dockerfile
├── dioxus-web/                # Dioxus web frontend (WASM)
│   ├── src/
│   │   ├── main.rs           # App entry & router
│   │   ├── api.rs            # REST client
│   │   ├── socket.rs         # Socket.IO client
│   │   ├── models.rs         # Data models
│   │   ├── state/            # Auth state management
│   │   ├── pages/            # Login, Register, Chat, Admin
│   │   ├── components/       # Message bubble, room list, input
│   │   └── utils/            # Storage helpers
│   ├── Cargo.toml
│   ├── index.html
│   └── Dockerfile            # Multi-stage: trunk build → nginx
├── dioxus-desktop/            # Dioxus desktop app (native)
│   ├── src/main.rs           # Desktop app with embedded TOR (Arti)
│   └── Cargo.toml
├── flutter-app/               # Flutter Android app
│   ├── lib/
│   │   ├── main.dart
│   │   ├── models/           # User, room, message models
│   │   ├── services/         # API, socket, crypto, TOR, storage, files, notifications, updates
│   │   ├── screens/          # Login, register, chat, rooms, admin, settings, server config
│   │   ├── components/       # Message bubble, message input
│   │   └── providers/        # Riverpod auth state
│   └── pubspec.yaml
├── tor/                       # TOR daemon container
│   ├── torrc                 # TOR configuration (hidden service)
│   └── Dockerfile
├── .github/workflows/         # CI/CD pipelines (7 workflows)
├── docker-compose.yml         # Development (build from source)
├── docker-compose.prod.yml    # Production (pre-built images)
└── README.md
```

---

## API Documentation

### REST API Endpoints

**Authentication** (public):
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

**Authentication** (protected):
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/users` - List all users

**Rooms** (protected):
- `GET /api/rooms` - List accessible rooms
- `POST /api/rooms` - Create room
- `GET /api/rooms/{id}` - Get room details
- `POST /api/rooms/{id}/join` - Join room
- `POST /api/rooms/{id}/leave` - Leave room
- `DELETE /api/rooms/{id}` - Delete room (admin/creator)
- `GET /api/rooms/{id}/messages` - Get messages (paginated)
- `POST /api/rooms/{id}/messages` - Send message
- `GET /api/rooms/{id}/members` - List room members
- `POST /api/rooms/{id}/members` - Add member
- `DELETE /api/rooms/{id}/members/{user_id}` - Remove member
- `GET /api/rooms/{id}/search` - Search messages in room

**Admin** (protected, admin only):
- `GET /api/admin/stats` - Server statistics
- `GET /api/admin/users` - List all users
- `POST /api/admin/users/{id}/promote` - Promote to admin
- `POST /api/admin/users/{id}/demote` - Demote from admin
- `POST /api/admin/users/{id}/ban` - Ban user
- `POST /api/admin/users/{id}/unban` - Unban user
- `DELETE /api/admin/users/{id}` - Delete user
- `GET /api/admin/rooms` - List all rooms
- `DELETE /api/admin/rooms/{id}` - Delete any room

**Other**:
- `POST /api/upload` - Upload file (protected)
- `GET /uploads/{path}` - Serve uploaded files (static)
- `GET /api/tor-status` - Check TOR connection (public)
- `GET /health` - Health check (public)

### Socket.IO Events

**Client → Server**:
- `authenticate` - Authenticate socket connection with JWT
- `join_room` - Join a chat room
- `leave_room` - Leave a chat room
- `send_message` - Send message (supports reply_to, message_type, metadata)
- `edit_message` - Edit a sent message
- `delete_message` - Delete a sent message
- `forward_message` - Forward message to another room
- `add_reaction` - Add emoji reaction to message
- `remove_reaction` - Remove emoji reaction
- `typing` - Emit typing status
- `mark_read` - Mark messages as read in a room
- `pin_message` - Pin a message in a room
- `unpin_message` - Unpin a message

**Server → Client**:
- `authenticated` - Authentication confirmed
- `message` - New message received
- `message_edited` - Message was edited
- `message_deleted` - Message was deleted
- `message_reaction_added` - Reaction added to message
- `message_reaction_removed` - Reaction removed
- `message_forwarded` - Message forwarded
- `message_pinned` - Message was pinned
- `message_unpinned` - Message was unpinned
- `message_read` - Messages marked as read
- `user_typing` - User is typing
- `user_online` - User came online
- `user_offline` - User went offline
- `error` - Error occurred

---

## Security

### End-to-End Encryption

**Algorithm**: ChaCha20-Poly1305 (AEAD)
**Key Exchange**: X25519 (Elliptic Curve Diffie-Hellman)
**Library**: sodiumoxide (libsodium bindings)

**How it works**:
1. Users generate X25519 keypairs on registration
2. Room creator generates symmetric room key
3. Room key encrypted for each member using their public key
4. Messages encrypted with room key + unique nonce
5. Server never sees plaintext messages or keys

### TOR Integration

All network traffic can be routed through TOR:
- Backend connects to TOR SOCKS5 proxy
- Docker deployment includes a TOR container with hidden service
- .onion address auto-generated and served by the TOR hidden service
- Desktop app uses embedded Arti TOR client
- Flutter app uses embedded TOR via `tor` + `socks5_proxy` packages

### Authentication

- **Password Hashing**: bcrypt (configurable cost, default 12 rounds)
- **Session Management**: JWT tokens with configurable expiration
- **Rate Limiting**: Configurable per-second rate limiting with burst support

---

## CI/CD Pipeline

This project uses **GitHub Actions** with 7 workflows:

| Workflow | File | Description |
|----------|------|-------------|
| **Rust Backend** | `rust-backend.yml` | Lint (fmt + clippy), build, Docker Hub push |
| **Dioxus Web** | `dioxus-web.yml` | Lint, WASM build with Trunk, Docker Hub push |
| **Dioxus Desktop** | `dioxus-desktop.yml` | Cross-platform native builds |
| **Flutter Android** | `flutter-android.yml` | Analyze, build APK/AAB |
| **TOR** | `tor.yml` | Build and push TOR container image |
| **Code Quality** | `code-quality.yml` | Security audits, formatting, linting |
| **Release** | `release.yml` | Tagged release builds |

### Docker Hub Images

- `idan2025/tor-chat-backend:latest`
- `idan2025/tor-chat-web:latest`
- `idan2025/tor-chat-tor:latest`

---

## Development

### Running Tests

```bash
# Backend
cd rust-backend && cargo test

# Flutter
cd flutter-app && flutter test

# Web
cd dioxus-web && cargo test
```

### Code Quality

```bash
# Rust formatting and linting
cargo fmt --check
cargo clippy -- -D warnings

# Flutter
dart format --set-exit-if-changed .
flutter analyze
```

### Database Schema

The database schema is defined inline in `rust-backend/src/database.rs` and auto-created on backend startup. No manual migration step is needed.

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes | — | JWT signing key |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `HOST` | No | `0.0.0.0` | Server bind address |
| `PORT` | No | `3000` | Server port |
| `RUST_LOG` | No | `info` | Log level |
| `JWT_EXPIRES_IN` | No | `86400` | Token expiration (seconds) |
| `BCRYPT_COST` | No | `12` | bcrypt hash rounds |
| `TOR_ENABLED` | No | `true` | Enable TOR integration |
| `TOR_SOCKS_HOST` | No | `127.0.0.1` | TOR SOCKS proxy host |
| `TOR_SOCKS_PORT` | No | `9050` | TOR SOCKS proxy port |
| `MAX_FILE_SIZE` | No | `1073741824` | Max upload size in bytes (1 GB) |
| `UPLOAD_DIR` | No | `./uploads` | File upload directory |
| `RATE_LIMIT_PER_SECOND` | No | `10` | Request rate limit |
| `RATE_LIMIT_BURST_SIZE` | No | `20` | Rate limit burst size |
| `WEB_PORT` | No | `9274` | Web UI port (Docker Compose) |

See **[DOCKER.md](DOCKER.md)** for complete production deployment guide.

---

## Troubleshooting

**libsodium not found** (backend build):
```bash
# Ubuntu/Debian
sudo apt-get install libsodium-dev

# macOS
brew install libsodium
```

**WASM build failed** (web frontend):
```bash
cargo install trunk
rustup target add wasm32-unknown-unknown
```

**Flutter build failures**:
```bash
flutter clean && flutter pub get
```

---

## Roadmap

- [ ] iOS app (Flutter)
- [ ] Voice/Video calls (WebRTC)
- [ ] Redis caching layer
- [ ] Kubernetes deployment manifests
- [ ] E2E testing suite
- [ ] Push notifications (FCM)

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow Rust style guide (rustfmt)
- Write tests for new features
- Update documentation
- Run `cargo clippy` before submitting
- Ensure CI/CD passes

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Security Disclosure

For security vulnerabilities, please use [GitHub Security Advisories](https://github.com/idan2025/tor-chat-app/security/advisories).

**Do NOT create public issues for security vulnerabilities.**

---

## Support

- **Issues**: [GitHub Issues](https://github.com/idan2025/tor-chat-app/issues)
- **Discussions**: [GitHub Discussions](https://github.com/idan2025/tor-chat-app/discussions)
- **Documentation**: [Wiki](https://github.com/idan2025/tor-chat-app/wiki)

---

## Acknowledgments

- [TOR Project](https://www.torproject.org/) - Anonymity network
- [libsodium](https://doc.libsodium.org/) - Cryptography library
- [Dioxus](https://dioxuslabs.com/) - Rust UI framework
- [Arti](https://gitlab.torproject.org/tpo/core/arti) - Embedded TOR client

---

## Statistics

| Component | Files | Lines |
|-----------|-------|-------|
| **Backend** (Rust) | 25 | ~3,940 |
| **Web Frontend** (Dioxus WASM) | 16 | ~3,230 |
| **Desktop** (Dioxus Native) | 2 | ~2,300 |
| **Android** (Flutter) | 25 | ~6,760 |
| **CI/CD Workflows** | 7 | ~1,420 |
| **Total** | | **~17,650** |

| Metric | Count |
|--------|-------|
| **REST API Endpoints** | 24 |
| **Socket.IO Events** | 13 client → server, 14 server → client |
| **Platforms** | Web, Desktop (Linux/Windows/macOS), Android |
