# CI/CD Setup Guide

This document explains how the CI/CD workflows are configured and how to set them up for your repository.

## Overview

The project has 5 main GitHub Actions workflows:

1. **Rust Backend CI/CD** - Builds and tests the backend, creates Docker images
2. **Dioxus Web CI/CD** - Builds and tests the web frontend, creates Docker images
3. **Dioxus Desktop CI/CD** - Builds desktop apps for Linux, Windows, and macOS
4. **Flutter Android CI/CD** - Builds Android APK and creates releases
5. **Code Quality & Security** - Runs security audits and dependency checks

## Automated Builds

### Docker Images (Backend & Web)

Docker images are automatically built and pushed to Docker Hub when:
- Code is pushed to the `main` branch
- Docker Hub credentials are configured (see secrets below)

**Docker Hub Images:**
- `<your-dockerhub-username>/tor-chat-backend:latest`
- `<your-dockerhub-username>/tor-chat-backend:<git-sha>`
- `<your-dockerhub-username>/tor-chat-web:latest`
- `<your-dockerhub-username>/tor-chat-web:<git-sha>`

### GitHub Releases

GitHub releases are automatically created when you push a git tag:

```bash
# Create a release
git tag v0.2.0
git push origin v0.2.0
```

**Release Artifacts:**
- **Android APK** - `app-release.apk`
- **Linux Desktop** - Binary and AppImage
- **Windows Desktop** - `.exe` file
- **macOS Desktop** - `.app` bundle and `.dmg` installer

## Required Secrets

Configure these secrets in your GitHub repository settings (Settings → Secrets and variables → Actions):

### For Docker Hub (Optional but Recommended)

- `DOCKER_USER` - Your Docker Hub username
- `DOCKER_PASS` - Your Docker Hub password or access token

**Note:** If these secrets are not configured, Docker build jobs will be skipped. All other jobs will still run successfully.

## No Play Store Deployment

The Play Store deployment has been removed from the workflow. Android APKs are only:
- Built on every push
- Uploaded as artifacts (retained for 7 days)
- Included in GitHub releases when you push a tag

## Workflow Triggers

### On Push to `main` or `develop`
- Run linting and formatting checks
- Run tests
- Build artifacts
- Create Docker images (if secrets configured)

### On Pull Request
- Run linting and formatting checks
- Run tests
- Build artifacts

### On Tag Push (`v*`)
- All of the above
- Create GitHub Release with all artifacts

### Weekly (Sunday at midnight)
- Run security audits
- Check for outdated dependencies

## Local Testing

### Rust Backend
```bash
cd rust-backend
cargo fmt -- --check
cargo clippy -- -D warnings -A dead_code -A deprecated
cargo test
cargo build --release
```

### Dioxus Web
```bash
cd dioxus-web
cargo fmt -- --check
cargo clippy -- -D warnings -A dead_code
trunk build --release
```

### Flutter Android
```bash
cd flutter-app
flutter pub get
flutter analyze
flutter test
flutter build apk --release
```

## Troubleshooting

### Docker builds fail with "Username and password required"
- Add `DOCKER_USER` and `DOCKER_PASS` secrets to your repository
- Or ignore these failures - they won't block other jobs

### Release workflow doesn't run
- Make sure you're pushing a tag, not just a commit
- Tag must start with `v` (e.g., `v1.0.0`, `v0.2.0`)

### Security audit fails
- Check the audit report for vulnerabilities
- Update dependencies with `cargo update`
- Or add `--ignore RUSTSEC-XXXX-XXXX` flags to the workflow

## Deployment

### Docker Compose Production
```bash
# Pull latest images
docker-compose -f docker-compose.prod.yml pull

# Start services
docker-compose -f docker-compose.prod.yml up -d
```

### Desktop Apps
- Download the appropriate build from GitHub Releases
- Linux: Use the AppImage or extract the binary
- Windows: Run the `.exe` file
- macOS: Open the `.dmg` and drag to Applications

### Android App
- Download the APK from GitHub Releases
- Install on Android device (may need to enable "Install from unknown sources")
