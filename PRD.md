# TOR Chat App - Product Requirements Document

## Overview
TOR Chat is a secure, privacy-focused messaging application that provides end-to-end encrypted communication with optional TOR network integration for enhanced anonymity.

## Architecture

### Components

1. **Rust Backend** (`rust-backend/`)
   - Axum web framework with WebSocket support via Socket.IO
   - PostgreSQL database with SQLx
   - JWT authentication with bcrypt password hashing
   - Sodium-based cryptography for E2E encryption
   - TOR integration via SOCKS5 proxy

2. **Dioxus Web Frontend** (`dioxus-web/`)
   - Dioxus 0.5 with WASM compilation
   - Router-based navigation
   - Real-time messaging via WebSocket
   - Tailwind CSS styling

3. **Dioxus Desktop App** (`dioxus-desktop/`)
   - Native desktop application using dioxus-desktop
   - Shares codebase with web frontend
   - Builds for Linux (AppImage), Windows, and macOS

4. **Flutter Mobile App** (`flutter-app/`)
   - Android application
   - Riverpod state management
   - Secure storage with flutter_secure_storage
   - Sodium-based cryptography

## Features

### Authentication
- User registration with email verification
- JWT-based session management
- Password hashing with bcrypt
- Admin role support

### Messaging
- Real-time chat via Socket.IO
- Public and private chat rooms
- Message history
- Online presence indicators

### Security
- End-to-end encryption using libsodium
- TOR network integration for anonymity
- Secure key exchange

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Rust, Axum, Socket.IO, SQLx, PostgreSQL |
| Web Frontend | Rust, Dioxus, WASM |
| Desktop | Rust, Dioxus Desktop |
| Mobile | Flutter, Dart |
| Encryption | libsodium/sodiumoxide |
| Auth | JWT, bcrypt |

## Current Version
v0.2.0

## Repository
https://github.com/idan2025/tor-chat-app
