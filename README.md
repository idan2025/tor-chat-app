# TOR Chat App - Secure & Encrypted Communication

[![Backend CI](https://github.com/idan2025/tor-chat-app/workflows/Backend%20CI/badge.svg)](https://github.com/idan2025/tor-chat-app/actions)
[![Docker Build](https://github.com/idan2025/tor-chat-app/workflows/Docker%20Build%20and%20Push/badge.svg)](https://github.com/idan2025/tor-chat-app/actions)
[![Web CI](https://github.com/idan2025/tor-chat-app/workflows/Web%20CI/badge.svg)](https://github.com/idan2025/tor-chat-app/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker Pulls](https://img.shields.io/docker/pulls/idan2025/tor-chat-backend.svg)](https://hub.docker.com/r/idan2025/tor-chat-backend)

A production-ready, end-to-end encrypted chat application running over TOR for maximum privacy and security.

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

## Features

- **End-to-End Encryption (E2EE)**: All messages encrypted with libsodium
- **TOR Integration**: Complete anonymity via TOR hidden services
- **Zero-Logging Mode**: Optional complete logging disable for maximum privacy
- **Chat Rooms**: Create and join encrypted chat rooms
- **Multi-Platform**: WebUI, Desktop (Windows/macOS/Linux), and Android
- **Real-time Communication**: WebSocket-based instant messaging
- **Production Ready**: Docker deployment, PostgreSQL database, secure authentication

## Architecture

```
┌─────────────────┐
│   TOR Network   │
└────────┬────────┘
         │
    ┌────▼────┐
    │ Backend │ (Node.js + Socket.IO + PostgreSQL)
    │  Server │ (E2EE + TOR Hidden Service)
    └────┬────┘
         │
    ┌────┴────────────────┬───────────────┐
    ▼                     ▼               ▼
┌───────┐          ┌──────────┐     ┌─────────┐
│ WebUI │          │ Desktop  │     │ Android │
│(React)│          │(Electron)│     │  (RN)   │
└───────┘          └──────────┘     └─────────┘
```

## Quick Start

### Super Fast Setup

```bash
# 1. Generate environment configuration
./setup.sh

# 2. Start the application
docker compose up -d

# Access at http://localhost:5173 (or your server IP)
```

### Prerequisites

- Docker & Docker Compose (recommended)
- OR Node.js 18+, TOR, PostgreSQL 15+

### Installation

#### Option 1: Docker (Recommended)

```bash
# Setup environment
./setup.sh

# Start services
docker compose up -d

# Access at http://localhost:5173 (or http://YOUR_SERVER_IP:5173 for remote)
```

#### Option 2: Manual Setup

```bash
# Install all dependencies
npm run install:all

# Start backend
npm run dev:backend

# Run WebUI
npm run dev:web

# Run Desktop App
npm run dev:desktop

# Run Android App
npm run dev:android
```

### Using Pre-built Docker Images

Pull from DockerHub:

```bash
# Backend
docker pull idan2025/tor-chat-backend:latest

# Web
docker pull idan2025/tor-chat-web:latest

# Run with docker-compose (uses images from Docker Hub automatically)
docker-compose up -d
```

**Note**: The `docker-compose.yml` file is already configured to use the pre-built images from Docker Hub (`idan2025/tor-chat-backend:latest` and `idan2025/tor-chat-web:latest`), so you don't need to build anything locally!

### Environment Setup

Create `.env` file in `packages/backend/`:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://toruser:torpass@localhost:5432/torchat
JWT_SECRET=your-secure-random-secret-here
TOR_SOCKS_PORT=9050
TOR_CONTROL_PORT=9051
HIDDEN_SERVICE_DIR=/var/lib/tor/hidden_service
```

## Security Features

### End-to-End Encryption

- **Algorithm**: ChaCha20-Poly1305 via libsodium
- **Key Exchange**: X25519 (ECDH)
- **Message Authentication**: Poly1305 MAC
- **Forward Secrecy**: Supported via session keys

### TOR Integration

- All traffic routed through TOR SOCKS proxy
- Backend runs as TOR hidden service (.onion)
- No IP address exposure
- Censorship resistant

### Authentication

- bcrypt password hashing (12 rounds)
- JWT tokens with short expiration
- Optional 2FA support

### Zero-Logging Mode

For maximum privacy, the application supports complete logging disable:

- **Environment Variable**: `ENABLE_LOGGING=false`
- **Effect**: NO logs created anywhere (console, files, etc.)
- **Use Case**: High-security TOR deployments where logging could compromise anonymity
- **Documentation**: See [ZERO_LOGGING.md](ZERO_LOGGING.md) for details

```bash
# Deploy with zero-logging for maximum privacy
ENABLE_LOGGING=false docker-compose up -d

# Or set in .env file
echo "ENABLE_LOGGING=false" >> packages/backend/.env
```

**Privacy Warning**: When `ENABLE_LOGGING=false`, absolutely NO logs are created. This means no debugging, no error logs, no audit trails. Use only when privacy is more critical than observability.

## Project Structure

```
tor-chat-app/
├── packages/
│   ├── backend/          # Node.js backend server
│   │   ├── src/
│   │   │   ├── server.ts
│   │   │   ├── socket.ts
│   │   │   ├── crypto.ts
│   │   │   ├── tor.ts
│   │   │   ├── routes/
│   │   │   ├── models/
│   │   │   └── middleware/
│   │   └── package.json
│   ├── web/              # React WebUI
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   ├── components/
│   │   │   └── services/
│   │   └── package.json
│   ├── desktop/          # Electron app
│   │   ├── src/
│   │   └── package.json
│   └── android/          # React Native app
│       ├── src/
│       └── package.json
├── docker-compose.yml
├── Dockerfile
└── README.md
```

## Production Deployment

### Quick Deploy with Pre-built Images

```bash
# 1. Run the setup script to generate .env file
./setup.sh

# 2. Pull the latest images from DockerHub
docker compose pull

# 3. Start the services
docker compose up -d

# 4. Check logs
docker compose logs -f

# Access at http://YOUR_SERVER_IP:5173
```

### Build from Source (For Development)

```bash
# Build and run with development configuration
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# Or build images separately
docker compose -f docker-compose.yml -f docker-compose.dev.yml build

# Then start
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

For detailed production setup, see [DEPLOYMENT.md](DEPLOYMENT.md)

## API Documentation

### REST API

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/rooms` - List chat rooms
- `POST /api/rooms` - Create chat room
- `GET /api/rooms/:id/messages` - Get room messages

### WebSocket Events

- `join_room` - Join a chat room
- `leave_room` - Leave a chat room
- `send_message` - Send encrypted message
- `message` - Receive encrypted message
- `user_joined` - User joined room notification
- `user_left` - User left room notification

## CI/CD

This project uses GitHub Actions for continuous integration and deployment:

- **Automated Testing**: Every push runs tests
- **Docker Images**: Auto-built and pushed to DockerHub
- **Multi-Platform Builds**: Windows, macOS, Linux
- **Security Scanning**: Automated vulnerability checks

See [CI_CD_GUIDE.md](CI_CD_GUIDE.md) for details.

## Documentation

- **[SETUP.md](SETUP.md)** - Detailed setup instructions
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Production deployment guide
- **[SECURITY.md](SECURITY.md)** - Security features and best practices
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Contribution guidelines
- **[CI_CD_GUIDE.md](CI_CD_GUIDE.md)** - CI/CD pipeline documentation
- **[CHANGELOG.md](CHANGELOG.md)** - Version history

## License

MIT - See [LICENSE](LICENSE) for details

## Security Disclosure

For security issues, please use [GitHub Security Advisories](https://github.com/idan2025/tor-chat-app/security/advisories) or create a private security report.

**Do NOT create public issues for security vulnerabilities.**

## Contributing

Contributions welcome! Please:

1. Read [CONTRIBUTING.md](CONTRIBUTING.md)
2. Fork the repository
3. Create a feature branch
4. Submit a pull request

## Support

- **Issues**: [GitHub Issues](https://github.com/idan2025/tor-chat-app/issues)
- **Discussions**: [GitHub Discussions](https://github.com/idan2025/tor-chat-app/discussions)

## Star History

If you find this project useful, please give it a ⭐️!
