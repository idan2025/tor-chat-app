# Changelog

All notable changes to TOR Chat will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-10-24

### Added

#### Backend
- Node.js + Express + Socket.IO server
- PostgreSQL database with Sequelize ORM
- End-to-end encryption with libsodium (ChaCha20-Poly1305)
- TOR integration with hidden service support
- JWT-based authentication
- bcrypt password hashing
- Real-time WebSocket communication
- Rate limiting and security middleware
- RESTful API endpoints
- Health check and monitoring endpoints

#### WebUI
- React + TypeScript + Vite frontend
- Tailwind CSS styling
- Login and registration pages
- Chat interface with rooms
- Real-time messaging
- Room creation and management
- Zustand state management
- Socket.IO client integration
- Responsive design

#### Desktop App
- Electron-based cross-platform app
- Windows, macOS, Linux support
- Native desktop experience
- System tray integration support
- Auto-update capability

#### Android App
- React Native mobile app
- Native Android UI
- Push notifications support
- Offline message queue
- Biometric authentication support

#### Infrastructure
- Docker and Docker Compose setup
- Production-ready deployment configuration
- Nginx configuration
- PostgreSQL database
- TOR hidden service integration
- Health checks and monitoring
- Automated backups support

#### Documentation
- Comprehensive README
- Setup guide (SETUP.md)
- Deployment guide (DEPLOYMENT.md)
- Security documentation (SECURITY.md)
- Contributing guidelines (CONTRIBUTING.md)
- API documentation

### Security
- End-to-end encryption for all messages
- TOR network integration
- Secure password hashing (bcrypt)
- JWT token authentication
- Rate limiting
- CORS protection
- Helmet.js security headers
- SQL injection prevention
- XSS protection

### Changed
- N/A (initial release)

### Deprecated
- N/A (initial release)

### Removed
- N/A (initial release)

### Fixed
- N/A (initial release)

## Roadmap

### [1.1.0] - Planned

#### Features
- File sharing and attachments
- Voice messages
- Image uploads
- User profiles with avatars
- Read receipts
- Typing indicators enhancement
- Search functionality
- Message reactions

#### Improvements
- Performance optimizations
- Better error handling
- Enhanced logging
- UI/UX improvements
- Mobile app enhancements

### [1.2.0] - Planned

#### Features
- Video/voice calls (WebRTC)
- Group video calls
- Screen sharing
- Self-destructing messages
- Two-factor authentication (2FA)
- User blocking and reporting

#### Security
- Perfect forward secrecy
- Key rotation
- Enhanced audit logging

### [2.0.0] - Future

#### Features
- Federation support
- Custom themes
- Plugin system
- Bot API
- Advanced admin tools
- Analytics dashboard

## Version History

- **1.0.0** (2024-10-24) - Initial release

---

For more information, see:
- [README.md](README.md) - Project overview
- [SECURITY.md](SECURITY.md) - Security policy
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines
