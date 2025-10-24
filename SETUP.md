# TOR Chat - Complete Setup Guide

## Table of Contents

1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Running the Application](#running-the-application)
6. [Building for Production](#building-for-production)

## Quick Start

The fastest way to get TOR Chat running:

```bash
# Clone the repository
git clone https://github.com/yourusername/tor-chat-app.git
cd tor-chat-app

# Start with Docker Compose
docker-compose up -d

# Access the WebUI
open http://localhost:5173

# View your .onion address (after TOR starts)
docker exec torchat-tor cat /var/lib/tor/hidden_service/hostname
```

That's it! The application is now running on your local machine.

## Prerequisites

### For Docker Setup (Recommended)

- Docker 20.10+
- Docker Compose 2.0+

### For Manual Setup

- **Node.js** 18.0 or higher
- **PostgreSQL** 15.0 or higher
- **TOR** (latest version)
- **npm** or **yarn**

### For Desktop App Development

- All backend prerequisites
- Electron-compatible OS (Windows/macOS/Linux)

### For Android App Development

- Node.js 18+
- React Native CLI
- Android Studio
- Android SDK (API level 31+)
- Java Development Kit (JDK) 17

## Installation

### Option 1: Docker (Recommended)

```bash
# 1. Clone repository
git clone https://github.com/yourusername/tor-chat-app.git
cd tor-chat-app

# 2. Create environment file
cp packages/backend/.env.example packages/backend/.env

# 3. Edit environment variables (optional for development)
nano packages/backend/.env

# 4. Start services
docker-compose up -d

# 5. View logs
docker-compose logs -f
```

### Option 2: Manual Installation

#### Backend

```bash
# Navigate to backend
cd packages/backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit configuration
nano .env

# Build TypeScript
npm run build

# Run migrations (creates database tables)
npm run migrate

# Start server
npm start
```

#### WebUI

```bash
# Navigate to web
cd packages/web

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Start development server
npm run dev
```

#### Desktop App

```bash
# Navigate to desktop
cd packages/desktop

# Install dependencies
npm install

# Run in development mode
npm run dev
```

#### Android App

```bash
# Navigate to android
cd packages/android

# Install dependencies
npm install

# Start Metro bundler
npm start

# In another terminal, run on Android
npm run android
```

## Configuration

### Backend Configuration

Edit `packages/backend/.env`:

```env
# Server
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://toruser:torpass@localhost:5432/torchat

# Security (CHANGE THESE!)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
BCRYPT_ROUNDS=12

# TOR
TOR_SOCKS_HOST=localhost
TOR_SOCKS_PORT=9050
ENABLE_TOR=true

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3001
```

### WebUI Configuration

Edit `packages/web/.env`:

```env
VITE_API_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000
```

### TOR Configuration

#### Linux/macOS

Edit `/etc/tor/torrc`:

```
HiddenServiceDir /var/lib/tor/hidden_service/
HiddenServicePort 80 127.0.0.1:3000
```

Restart TOR:
```bash
sudo systemctl restart tor
```

#### Windows

Edit `C:\Program Files\Tor Browser\Browser\TorBrowser\Data\Tor\torrc`:

```
HiddenServiceDir C:\tor\hidden_service\
HiddenServicePort 80 127.0.0.1:3000
```

### Database Setup

```bash
# Create PostgreSQL database
createdb torchat

# Or with Docker
docker exec -it torchat-postgres psql -U toruser -c "CREATE DATABASE torchat;"
```

## Running the Application

### Development Mode

#### All-in-One (Docker)

```bash
docker-compose up
```

#### Individual Components

Terminal 1 - Backend:
```bash
cd packages/backend
npm run dev
```

Terminal 2 - WebUI:
```bash
cd packages/web
npm run dev
```

Terminal 3 - Desktop (optional):
```bash
cd packages/desktop
npm run dev
```

Terminal 4 - Android (optional):
```bash
cd packages/android
npm start
# In another terminal
npm run android
```

### Accessing the Application

- **WebUI**: http://localhost:5173
- **Backend API**: http://localhost:3000/api
- **TOR Hidden Service**: Check `.onion` address in `/var/lib/tor/hidden_service/hostname`

### Creating Your First User

1. Open WebUI at http://localhost:5173
2. Click "Register"
3. Fill in:
   - Username (3-50 characters)
   - Email
   - Password (min 8 characters)
   - Display Name (optional)
4. Click "Register"

### Creating Your First Room

1. Log in to the application
2. Click "Create Room"
3. Enter room name and description
4. Select room type (Public/Private)
5. Click "Create"

## Building for Production

### Backend

```bash
cd packages/backend
npm run build
npm start
```

### WebUI

```bash
cd packages/web
npm run build
# Output in dist/ directory
```

### Desktop App

```bash
cd packages/desktop
npm run make

# Installers will be in:
# out/make/squirrel.windows/ (Windows)
# out/make/zip/darwin/ (macOS)
# out/make/deb/ (Linux .deb)
# out/make/rpm/ (Linux .rpm)
```

### Android App

```bash
cd packages/android
cd android
./gradlew assembleRelease

# APK location:
# android/app/build/outputs/apk/release/app-release.apk
```

## Verifying Installation

### Check Backend

```bash
curl http://localhost:3000/health
# Should return: {"status":"ok",...}
```

### Check Database

```bash
docker exec -it torchat-postgres psql -U toruser -d torchat -c "\dt"
# Should list: users, rooms, messages, room_members
```

### Check TOR

```bash
curl http://localhost:3000/api/tor-status
# Should return TOR connection status
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000
# Kill it
kill -9 <PID>
```

### Database Connection Failed

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql
# Or with Docker
docker ps | grep postgres
```

### TOR Not Connecting

```bash
# Check TOR service
sudo systemctl status tor
# View logs
journalctl -u tor -f
```

### Node Modules Issues

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Build Errors

```bash
# Clear build cache
rm -rf dist/
npm run build
```

## Next Steps

1. Read [SECURITY.md](SECURITY.md) for security best practices
2. Read [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment
3. Customize the application for your needs
4. Star the repository if you find it useful!

## Getting Help

- **Documentation**: See README.md
- **Issues**: https://github.com/yourusername/tor-chat-app/issues
- **Security**: See SECURITY.md
- **Contributing**: See CONTRIBUTING.md

## License

MIT License - see LICENSE file for details
