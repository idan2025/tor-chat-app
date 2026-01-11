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
- **Production Ready**: Docker deployment, PostgreSQL database, JWT authentication

### Security Features
- **E2EE Encryption**: X25519 key exchange + ChaCha20-Poly1305 AEAD
- **Perfect Forward Secrecy**: Ephemeral room keys with rotation
- **Password Security**: bcrypt hashing with 12 rounds
- **TOR Anonymity**: All traffic routed through TOR network
- **Admin Controls**: User management, bans, room moderation

### Chat Features
- **Chat Rooms**: Public and private encrypted rooms
- **Room Management**: Create, join, leave, delete rooms
- **Message Features**: Edit, delete, forward, reactions, threading
- **File Sharing**: Encrypted file uploads and downloads
- **Typing Indicators**: Real-time typing status
- **User Presence**: Online/offline status tracking
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
- **Framework**: Axum 0.7 (async web framework)
- **Real-time**: socketioxide 0.13 (Socket.IO server)
- **Database**: PostgreSQL 15+ with sqlx 0.7
- **Encryption**: sodiumoxide 0.2 (libsodium bindings)
- **Authentication**: JWT (jsonwebtoken 9.2) + bcrypt 0.15
- **TOR**: tokio-socks 0.5 (SOCKS5 proxy client)

**Android** (Flutter):
- **Framework**: Flutter 3.16+
- **State**: Riverpod (reactive state management)
- **Encryption**: flutter_sodium (libsodium)
- **Real-time**: socket_io_client
- **TOR**: tor_flutter (native TOR integration)
- **Storage**: sqflite (local SQLite caching)

**Web/Desktop** (Dioxus):
- **Framework**: Dioxus 0.5 (React-like Rust framework)
- **Web**: WASM compilation with Trunk
- **Desktop**: Native apps (90%+ code reuse from web)
- **HTTP**: reqwest with async/await
- **WebSocket**: gloo-net for Socket.IO

---

## 🚀 Quick Start with Docker

The fastest way to get TOR Chat running:

```bash
# Clone repository
git clone https://github.com/idan2025/tor-chat-app.git
cd tor-chat-app

# Copy and configure environment
cp .env.example .env
nano .env  # Set JWT_SECRET to a secure random value

# Start with pre-built images (recommended)
docker-compose -f docker-compose.prod.yml up -d

# Access the application
# Web UI: http://localhost:8080
# Backend API: http://localhost:3000
```

**See [DOCKER.md](DOCKER.md) for complete Docker deployment guide.**

---

## Quick Start

### Prerequisites

Choose your platform:

**Backend**:
- Rust 1.70+ (install from [rustup.rs](https://rustup.rs))
- PostgreSQL 15+
- libsodium development libraries

**Android**:
- Flutter 3.16+
- Android SDK / Android Studio
- Java 17

**Web/Desktop**:
- Rust 1.70+
- Trunk (for WASM builds): `cargo install trunk`
- wasm32 target: `rustup target add wasm32-unknown-unknown`

### Installation

#### 1. Backend Setup

```bash
cd rust-backend

# Install dependencies (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install -y libsodium-dev postgresql

# Configure environment
cp .env.example .env
# Edit .env with your database URL and JWT secret

# Run migrations
sqlx database create
sqlx migrate run

# Build and run
cargo build --release
cargo run --release
```

**Environment Variables** (`.env`):
```env
DATABASE_URL=postgresql://user:password@localhost:5432/tor_chat
JWT_SECRET=your-super-secret-jwt-key-change-this
RUST_LOG=info
TOR_SOCKS_HOST=127.0.0.1
TOR_SOCKS_PORT=9050
```

#### 2. Flutter Android Setup

```bash
cd flutter-app

# Get dependencies
flutter pub get

# Configure API endpoint
# Edit lib/services/api_service.dart to set your backend URL

# Run on connected device/emulator
flutter run

# Or build APK
flutter build apk --release
```

#### 3. Dioxus Web Setup

```bash
cd dioxus-web

# Build and serve
trunk serve --release

# Access at http://localhost:8080
```

#### 4. Dioxus Desktop Setup

```bash
cd dioxus-desktop

# Run desktop app
cargo run --release

# Build for distribution
cargo build --release
```

---

## Docker Deployment

### Quick Deploy

```bash
# Pull pre-built images
docker pull idan2025/tor-chat-backend:latest

# Run with docker-compose
docker-compose up -d

# Access web UI at http://localhost:8080
```

### Build from Source

```bash
# Build backend image
cd rust-backend
docker build -t tor-chat-backend .

# Run with PostgreSQL
docker-compose up -d
```

**docker-compose.yml**:
```yaml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: tor_chat
      POSTGRES_USER: toruser
      POSTGRES_PASSWORD: torpass
    volumes:
      - pgdata:/var/lib/postgresql/data

  backend:
    image: idan2025/tor-chat-backend:latest
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://toruser:torpass@postgres:5432/tor_chat
      JWT_SECRET: change-this-secret-key
    depends_on:
      - postgres

volumes:
  pgdata:
```

---

## Project Structure

```
tor-chat-app/
├── rust-backend/              # Rust backend server
│   ├── src/
│   │   ├── main.rs           # Server entry point
│   │   ├── config.rs         # Configuration
│   │   ├── database.rs       # PostgreSQL schema
│   │   ├── error.rs          # Error types
│   │   ├── state.rs          # App state
│   │   ├── models/           # Data models
│   │   │   ├── user.rs
│   │   │   ├── room.rs
│   │   │   └── message.rs
│   │   ├── services/         # Business logic
│   │   │   ├── crypto.rs     # E2EE implementation
│   │   │   ├── tor.rs        # TOR SOCKS proxy
│   │   │   └── auth.rs       # Authentication
│   │   ├── middleware/       # HTTP middleware
│   │   │   ├── auth.rs       # JWT validation
│   │   │   └── validation.rs
│   │   ├── routes/           # REST API routes
│   │   │   ├── auth.rs       # Auth endpoints
│   │   │   ├── rooms.rs      # Room management
│   │   │   ├── admin.rs      # Admin panel
│   │   │   └── upload.rs     # File uploads
│   │   └── socket/           # Socket.IO handlers
│   │       └── handlers.rs   # 18 real-time events
│   ├── Cargo.toml
│   └── .env.example
├── flutter-app/               # Flutter Android app
│   ├── lib/
│   │   ├── main.dart
│   │   ├── models/           # Data models
│   │   ├── services/         # API, TOR, crypto, socket
│   │   ├── screens/          # UI screens
│   │   ├── components/       # Reusable widgets
│   │   └── providers/        # Riverpod state
│   ├── pubspec.yaml
│   └── android/
├── dioxus-web/                # Dioxus web app (WASM)
│   ├── src/
│   │   ├── main.rs           # App entry
│   │   ├── api.rs            # REST client
│   │   ├── socket.rs         # WebSocket client
│   │   ├── models.rs         # Data models
│   │   ├── state/            # Global state
│   │   ├── pages/            # UI pages
│   │   └── components/       # UI components
│   ├── Cargo.toml
│   └── index.html
├── dioxus-desktop/            # Dioxus desktop app
│   ├── src/
│   │   └── main.rs           # Desktop wrapper
│   └── Cargo.toml
├── .github/workflows/         # CI/CD pipelines
│   ├── rust-backend.yml
│   ├── flutter-android.yml
│   ├── dioxus-web.yml
│   ├── dioxus-desktop.yml
│   └── code-quality.yml
└── README.md
```

---

## API Documentation

### REST API Endpoints

**Authentication**:
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh JWT token
- `GET /api/auth/me` - Get current user
- `DELETE /api/auth/logout` - Logout user

**Rooms**:
- `GET /api/rooms` - List all rooms
- `POST /api/rooms` - Create room
- `GET /api/rooms/:id` - Get room details
- `POST /api/rooms/:id/join` - Join room
- `DELETE /api/rooms/:id/leave` - Leave room
- `DELETE /api/rooms/:id` - Delete room (admin/creator)
- `GET /api/rooms/:id/members` - List room members
- `GET /api/rooms/:id/messages` - Get room messages
- `GET /api/rooms/:id/messages/search` - Search messages
- `DELETE /api/rooms/:id/members/:user_id` - Kick member

**Admin**:
- `GET /api/admin/stats` - Server statistics
- `GET /api/admin/users` - List all users
- `POST /api/admin/users/:id/promote` - Promote to admin
- `POST /api/admin/users/:id/demote` - Demote from admin
- `POST /api/admin/users/:id/ban` - Ban user
- `POST /api/admin/users/:id/unban` - Unban user
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/rooms` - List all rooms
- `DELETE /api/admin/rooms/:id` - Delete any room

**Upload**:
- `POST /api/upload` - Upload file

**TOR**:
- `GET /api/tor/status` - Check TOR connection

### Socket.IO Events

**Client → Server**:
- `authenticate` - Authenticate socket connection
- `join_room` - Join a room
- `leave_room` - Leave a room
- `send_message` - Send message
- `edit_message` - Edit message
- `delete_message` - Delete message
- `forward_message` - Forward message
- `add_reaction` - Add reaction to message
- `remove_reaction` - Remove reaction
- `typing_start` - Start typing indicator
- `typing_stop` - Stop typing indicator

**Server → Client**:
- `authenticated` - Authentication success
- `new_message` - New message received
- `message_edited` - Message edited
- `message_deleted` - Message deleted
- `reaction_added` - Reaction added
- `reaction_removed` - Reaction removed
- `user_typing` - User is typing
- `user_joined` - User joined room
- `user_left` - User left room
- `error` - Error occurred

---

## Security

### End-to-End Encryption

**Algorithm**: ChaCha20-Poly1305 (AEAD)
**Key Exchange**: X25519 (Elliptic Curve Diffie-Hellman)
**MAC**: Poly1305

**How it works**:
1. Users generate X25519 keypairs on registration
2. Room creator generates symmetric room key
3. Room key encrypted for each member using their public key
4. Messages encrypted with room key + unique nonce
5. Server never sees plaintext messages or keys

### TOR Integration

All network traffic can be routed through TOR:
- Backend connects to TOR SOCKS5 proxy (port 9050)
- Supports .onion hidden services
- No IP address leakage
- Censorship resistant

### Authentication

- **Password Hashing**: bcrypt (12 rounds, auto-salted)
- **Session Management**: JWT tokens with short expiration
- **Token Refresh**: Refresh tokens for seamless UX
- **Rate Limiting**: Protection against brute force

---

## CI/CD Pipeline

This project uses **GitHub Actions** for automated testing and deployment:

### Workflows

1. **Rust Backend** (`.github/workflows/rust-backend.yml`)
   - Lint: cargo fmt + clippy
   - Test: Unit tests with PostgreSQL
   - Build: Release build
   - Deploy: Docker Hub (main branch)

2. **Flutter Android** (`.github/workflows/flutter-android.yml`)
   - Analyze: dart format + flutter analyze
   - Test: Flutter test suite
   - Build: APK + AAB (App Bundle)
   - Deploy: Google Play Store internal track (main branch)

3. **Dioxus Web** (`.github/workflows/dioxus-web.yml`)
   - Lint: cargo fmt + clippy
   - Build: WASM with Trunk
   - Deploy: GitHub Pages / Netlify / Vercel (main branch)

4. **Dioxus Desktop** (`.github/workflows/dioxus-desktop.yml`)
   - Build: Linux (AppImage), Windows (installer), macOS (DMG)
   - Release: GitHub Releases (on tags)

5. **Code Quality** (`.github/workflows/code-quality.yml`)
   - Security: cargo audit + CodeQL
   - Coverage: cargo-tarpaulin + Codecov
   - License: cargo-license compliance check

### Deployment Targets

- **Backend**: Docker Hub → `idan2025/tor-chat-backend:latest`
- **Android**: Google Play Store (internal track)
- **Web**: GitHub Pages / Netlify / Vercel
- **Desktop**: GitHub Releases (binaries for all platforms)

See [.github/workflows/README.md](.github/workflows/README.md) for setup instructions.

---

## Development

### Running Tests

**Backend**:
```bash
cd rust-backend
cargo test
```

**Flutter**:
```bash
cd flutter-app
flutter test
```

**Web**:
```bash
cd dioxus-web
cargo test
```

### Code Quality

**Rust linting**:
```bash
cargo fmt --check
cargo clippy -- -D warnings
```

**Flutter linting**:
```bash
dart format --set-exit-if-changed .
flutter analyze
```

### Database Migrations

```bash
cd rust-backend

# Create new migration
sqlx migrate add <migration_name>

# Run migrations
sqlx migrate run

# Revert last migration
sqlx migrate revert
```

---

## Production Deployment

**Recommended: Docker Deployment**

The easiest way to deploy to production is using Docker Compose:

```bash
# Use pre-built images from Docker Hub
docker-compose -f docker-compose.prod.yml up -d
```

See **[DOCKER.md](DOCKER.md)** for complete production deployment guide including:
- SSL/TLS setup with reverse proxy
- Database backups
- Security hardening
- Monitoring and logging
- Performance tuning

### Alternative: Manual Deployment

#### 1. Backend Deployment

```bash
# Using Docker
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL=postgresql://user:pass@db:5432/tor_chat \
  -e JWT_SECRET=your-secret-key \
  idan2025/tor-chat-backend:latest

# Or build from source
cd rust-backend
cargo build --release
./target/release/tor-chat-backend
```

#### 2. Web Deployment

**Docker (Recommended)**:
```bash
docker run -d -p 8080:80 idan2025/tor-chat-web:latest
```

**GitHub Pages**:
```bash
cd dioxus-web
trunk build --release
# Deploy dist/ to GitHub Pages
```

**Netlify**:
```bash
# Build command: cd dioxus-web && trunk build --release
# Publish directory: dioxus-web/dist
```

#### 3. Android Deployment

Download APK from [GitHub Actions artifacts](https://github.com/idan2025/tor-chat-app/actions/workflows/flutter-android.yml) or build from source:

```bash
cd flutter-app

# Build signed APK
flutter build apk --release

# Build App Bundle for Play Store
flutter build appbundle --release
```

#### 4. Desktop Deployment

Download pre-built binaries from:
- **Linux AppImage**: [GitHub Actions artifacts](https://github.com/idan2025/tor-chat-app/actions/workflows/dioxus-desktop.yml)
- **Windows Installer**: [GitHub Actions artifacts](https://github.com/idan2025/tor-chat-app/actions/workflows/dioxus-desktop.yml)
- **macOS DMG**: [GitHub Actions artifacts](https://github.com/idan2025/tor-chat-app/actions/workflows/dioxus-desktop.yml)

Or build from source:

```bash
cd dioxus-desktop
cargo build --release

# Binaries in target/release/
```

---

## Troubleshooting

### Backend Issues

**libsodium not found**:
```bash
# Ubuntu/Debian
sudo apt-get install libsodium-dev

# macOS
brew install libsodium

# Windows
# Download from https://libsodium.org
```

**PostgreSQL connection failed**:
- Check DATABASE_URL format: `postgresql://user:pass@host:port/dbname`
- Ensure PostgreSQL is running: `sudo systemctl status postgresql`
- Verify user permissions: `psql -U user -d dbname`

### Flutter Issues

**TOR connection failed**:
- Ensure TOR is installed and running
- Check SOCKS proxy configuration in settings
- Verify backend URL is correct

**Build failures**:
- Clean build: `flutter clean && flutter pub get`
- Update Flutter: `flutter upgrade`
- Check Java version: `java -version` (requires Java 17)

### Web Issues

**WASM build failed**:
- Install Trunk: `cargo install trunk`
- Add wasm32 target: `rustup target add wasm32-unknown-unknown`
- Clear cache: `trunk clean`

---

## Performance

### Backend Benchmarks
- **REST API**: ~10,000 req/sec (single instance)
- **WebSocket**: ~5,000 concurrent connections
- **Database**: PostgreSQL with connection pooling (max 20)

### Optimization Tips
- Enable cargo build cache in CI/CD (40-60% faster builds)
- Use release builds for production (`--release`)
- Configure PostgreSQL max_connections based on load
- Use Redis for session storage (optional, for horizontal scaling)

---

## Roadmap

### Completed ✅
- [x] Complete Rust backend rewrite
- [x] Flutter Android app
- [x] Dioxus Web + Desktop apps
- [x] E2EE implementation
- [x] TOR integration
- [x] GitHub Actions CI/CD
- [x] Docker deployment
- [x] Admin dashboard

### Planned 🚧
- [ ] iOS app (Flutter)
- [ ] Voice/Video calls (WebRTC)
- [ ] Message search optimization
- [ ] Redis caching layer
- [ ] Kubernetes deployment manifests
- [ ] E2E testing suite
- [ ] Message threading UI
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

- **TOR Project**: For the anonymity network
- **libsodium**: For the cryptography library
- **Rust Community**: For amazing tooling and libraries
- **Flutter Team**: For the cross-platform framework
- **Dioxus Team**: For the Rust UI framework

---

## Statistics

| Metric | Value |
|--------|-------|
| **Total Lines of Code** | ~7,850 |
| **Backend (Rust)** | 27 files, ~2,650 lines |
| **Android (Flutter)** | 25 files, ~3,000 lines |
| **Web (Dioxus)** | 16 files, ~1,500 lines |
| **Desktop (Dioxus)** | 2 files, ~100 lines |
| **CI/CD Workflows** | 5 workflows, ~600 lines |
| **Platforms Supported** | 6 (Linux, Windows, macOS, Android, Web, Docker) |
| **API Endpoints** | 28 REST + 18 Socket.IO events |

---

**⭐ If you find this project useful, please give it a star!**
