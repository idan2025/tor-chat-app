# TOR Chat App - Secure & Encrypted Communication

[![Backend CI](https://github.com/idan2025/tor-chat-app/workflows/Backend%20CI/badge.svg)](https://github.com/idan2025/tor-chat-app/actions)
[![Docker Build](https://github.com/idan2025/tor-chat-app/workflows/Docker%20Build%20and%20Push/badge.svg)](https://github.com/idan2025/tor-chat-app/actions)
[![Web CI](https://github.com/idan2025/tor-chat-app/workflows/Web%20CI/badge.svg)](https://github.com/idan2025/tor-chat-app/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker Pulls](https://img.shields.io/docker/pulls/idan2025/tor-chat-backend.svg)](https://hub.docker.com/r/idan2025/tor-chat-backend)

A production-ready, end-to-end encrypted chat application running over TOR for maximum privacy and security.

## Features

- **End-to-End Encryption (E2EE)**: All messages encrypted with libsodium
- **TOR Integration**: Complete anonymity via TOR hidden services
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

### Super Fast Setup (3 seconds!)

```bash
./quickstart.sh
```

### Prerequisites

- Docker & Docker Compose (recommended)
- OR Node.js 18+, TOR, PostgreSQL 15+

### Installation

#### Option 1: Docker (Recommended)

```bash
# One-command setup
./quickstart.sh

# Or manually
docker-compose up -d

# Access at http://localhost:5173
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

## Building for Production

```bash
# Build all packages
npm run build:all

# Build Docker image
docker build -t tor-chat-app .

# Deploy with Docker Compose
docker-compose -f docker-compose.prod.yml up -d
```

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

For security issues, please email: security@example.com

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
- **Email**: support@example.com

## Star History

If you find this project useful, please give it a ⭐️!
