# CI/CD Guide - TOR Chat

## Overview

TOR Chat uses GitHub Actions for continuous integration and deployment, automatically building, testing, and publishing Docker images to DockerHub.

## GitHub Actions Workflows

### 1. Backend CI (`backend-ci.yml`)

**Triggers**: Push/PR to `main` or `develop` branches affecting backend code

**Jobs**:
- Lint and test on Node.js 18 and 20
- Build TypeScript
- Run tests with PostgreSQL
- Upload build artifacts

### 2. Docker Build and Push (`docker-build-push.yml`)

**Triggers**: Push to `main`, version tags, or manual dispatch

**Jobs**:
- Build multi-arch Docker images (amd64, arm64)
- Push to DockerHub
- Security scanning with Trivy
- Tag images appropriately

**Images**:
- `your-dockerhub-username/tor-chat-backend:latest`
- `your-dockerhub-username/tor-chat-web:latest`

### 3. Web CI (`web-ci.yml`)

**Triggers**: Push/PR affecting web code

**Jobs**:
- Build React app on Node.js 18 and 20
- Lint and test
- Check bundle size
- Deploy to GitHub Pages (optional)

### 4. Desktop Build (`desktop-build.yml`)

**Triggers**: Push to `main`, version tags, or manual dispatch

**Jobs**:
- Build Electron app for Windows, macOS, and Linux
- Create installers (.exe, .dmg, .deb, .rpm)
- Upload artifacts
- Create GitHub releases for tagged versions

### 5. Android Build (`android-build.yml`)

**Triggers**: Push to `main`, version tags, or affecting Android code

**Jobs**:
- Build debug and release APKs
- Upload artifacts
- Create releases for tagged versions

### 6. Code Quality (`code-quality.yml`)

**Triggers**: Push/PR, weekly schedule

**Jobs**:
- Security audit (npm audit)
- CodeQL analysis
- Dependency review
- Linting all packages

### 7. Release (`release.yml`)

**Triggers**: Version tags (v*.*.*)

**Jobs**:
- Create GitHub release with changelog
- Trigger Docker, desktop, and Android releases
- Send notifications

## Setup Instructions

### 1. DockerHub Setup

1. Create DockerHub account at https://hub.docker.com
2. Create repositories:
   - `tor-chat-backend`
   - `tor-chat-web`
3. Generate access token:
   - Go to Account Settings → Security → New Access Token
   - Save the token securely

### 2. GitHub Secrets Configuration

Go to your GitHub repository → Settings → Secrets and variables → Actions → New repository secret

Add the following secrets:

```
DOCKERHUB_USERNAME=your-dockerhub-username
DOCKERHUB_TOKEN=your-dockerhub-access-token
```

**Optional secrets**:
```
SNYK_TOKEN=your-snyk-token (for security scanning)
SIGNING_KEY_ALIAS=your-android-key-alias
SIGNING_KEY_PASSWORD=your-android-key-password
SIGNING_STORE_PASSWORD=your-android-store-password
```

### 3. Push to GitHub

```bash
# Initialize git (if not done)
git init
git add .
git commit -m "feat: initial commit with CI/CD"

# Add remote
git remote add origin https://github.com/yourusername/tor-chat-app.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### 4. Enable GitHub Actions

1. Go to repository → Actions tab
2. Enable workflows if prompted
3. Workflows will run automatically on push

### 5. Verify Workflows

Check the Actions tab to see workflows running:
- ✅ Backend CI
- ✅ Web CI
- ✅ Docker Build and Push
- ✅ Code Quality

## Using the CI/CD Pipeline

### Continuous Integration

Every push/PR triggers:
1. **Code Quality Checks**: Linting, formatting
2. **Tests**: Unit and integration tests
3. **Builds**: Compile TypeScript, bundle React
4. **Security Scans**: Dependency audits

### Continuous Deployment

#### Development Workflow

```bash
# Feature branch
git checkout -b feature/new-feature
# Make changes
git add .
git commit -m "feat: add new feature"
git push origin feature/new-feature

# Create PR → Triggers CI checks
# Merge to main → Triggers builds and Docker push
```

#### Docker Images

**Automatic tags**:
- `latest` - Latest main branch
- `develop` - Latest develop branch
- `v1.2.3` - Semantic version tags
- `main-abc1234` - Git commit SHA

**Pull images**:
```bash
docker pull your-dockerhub-username/tor-chat-backend:latest
docker pull your-dockerhub-username/tor-chat-web:latest
```

#### Release Workflow

1. **Update version**:
   ```bash
   npm version patch  # or minor, major
   ```

2. **Create tag**:
   ```bash
   git tag -a v1.0.1 -m "Release version 1.0.1"
   git push origin v1.0.1
   ```

3. **Automatic actions**:
   - GitHub release created
   - Docker images built and tagged
   - Desktop installers built
   - Android APK built
   - Artifacts uploaded to release

### Manual Dispatch

Some workflows support manual triggering:

1. Go to Actions tab
2. Select workflow (e.g., "Docker Build and Push")
3. Click "Run workflow"
4. Select branch
5. Click "Run workflow"

## Docker Image Usage

### Pull from DockerHub

```bash
# Backend
docker pull your-dockerhub-username/tor-chat-backend:latest

# Web
docker pull your-dockerhub-username/tor-chat-web:latest
```

### Use in docker-compose

Update `docker-compose.yml`:

```yaml
services:
  backend:
    image: your-dockerhub-username/tor-chat-backend:latest
    # Remove build section

  web:
    image: your-dockerhub-username/tor-chat-web:latest
    # Remove build section
```

### Production Deployment

```bash
# Pull latest images
docker-compose pull

# Start services
docker-compose up -d
```

## Monitoring Builds

### GitHub Actions Dashboard

1. Go to repository → Actions tab
2. View all workflow runs
3. Click on a run to see details
4. View logs for debugging

### Build Status Badges

Add to README.md:

```markdown
![Backend CI](https://github.com/yourusername/tor-chat-app/workflows/Backend%20CI/badge.svg)
![Docker Build](https://github.com/yourusername/tor-chat-app/workflows/Docker%20Build%20and%20Push/badge.svg)
![Web CI](https://github.com/yourusername/tor-chat-app/workflows/Web%20CI/badge.svg)
```

## Troubleshooting

### Docker Push Fails

**Error**: `unauthorized: authentication required`

**Solution**:
1. Verify DOCKERHUB_USERNAME and DOCKERHUB_TOKEN secrets
2. Check token permissions
3. Ensure repositories exist on DockerHub

### Build Fails

**Check**:
1. Review workflow logs in Actions tab
2. Verify all dependencies are in package.json
3. Check Node.js version compatibility
4. Ensure environment variables are set

### Tests Fail

**Common issues**:
1. Database connection errors → Check services in workflow
2. Missing environment variables → Add to workflow
3. Timeout errors → Increase timeout in workflow

### Android Build Fails

**Common issues**:
1. Gradle wrapper not executable → Add `chmod +x gradlew`
2. Missing Android project structure
3. Signing keys not configured

## Security Best Practices

1. **Never commit secrets** to repository
2. **Use GitHub Secrets** for sensitive data
3. **Enable Dependabot** for dependency updates
4. **Review security alerts** regularly
5. **Use Trivy scanning** for Docker images
6. **Enable CodeQL** for code analysis

## Performance Optimization

### Caching

Workflows use caching for:
- npm dependencies
- Gradle packages
- Docker layers

### Parallel Jobs

Multiple jobs run in parallel:
- Backend and Web CI
- Multi-OS desktop builds
- Multi-platform Docker builds

## Advanced Configuration

### Custom Docker Tags

Edit `docker-build-push.yml`:

```yaml
tags: |
  type=ref,event=branch
  type=semver,pattern={{version}}
  type=raw,value=production,enable={{is_default_branch}}
```

### Matrix Builds

Test on multiple versions:

```yaml
strategy:
  matrix:
    node-version: [18.x, 20.x, 21.x]
    os: [ubuntu-latest, windows-latest]
```

### Conditional Workflows

Run only on specific paths:

```yaml
on:
  push:
    paths:
      - 'packages/backend/**'
      - '!**/*.md'
```

## Cost Management

### GitHub Actions

- **Free tier**: 2,000 minutes/month for private repos
- **Public repos**: Unlimited
- **Optimize**: Use caching, parallel jobs

### DockerHub

- **Free tier**: Unlimited public repositories
- **Rate limits**: 100 pulls per 6 hours (anonymous)
- **Optimize**: Use multi-stage builds, layer caching

## Resources

- **GitHub Actions Docs**: https://docs.github.com/actions
- **DockerHub**: https://hub.docker.com
- **Workflow Examples**: https://github.com/actions/starter-workflows

## Support

For CI/CD issues:
1. Check workflow logs
2. Review this guide
3. Open GitHub issue
4. Email: devops@example.com

---

**Last Updated**: 2024-10-24
