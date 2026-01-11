# Docker Deployment Guide

This guide covers how to deploy TOR Chat using Docker and Docker Compose.

## Quick Start

### Using Pre-built Images (Recommended)

```bash
# Copy environment template
cp .env.example .env

# Edit .env and set your JWT_SECRET
nano .env

# Start services using pre-built images
docker-compose -f docker-compose.prod.yml up -d

# Check logs
docker-compose -f docker-compose.prod.yml logs -f
```

Access the application:
- Web UI: http://localhost:8080
- Backend API: http://localhost:3000

### Building from Source

```bash
# Copy environment template
cp .env.example .env

# Edit .env and set your JWT_SECRET
nano .env

# Build and start services
docker-compose up -d --build

# Check logs
docker-compose logs -f
```

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Database
POSTGRES_DB=tor_chat
POSTGRES_USER=toruser
POSTGRES_PASSWORD=your-secure-password

# Backend
JWT_SECRET=your-super-secret-jwt-key-change-this
RUST_LOG=info
TOR_SOCKS_HOST=127.0.0.1
TOR_SOCKS_PORT=9050

# Ports
BACKEND_PORT=3000
WEB_PORT=8080
```

**Important**: Change `JWT_SECRET` and `POSTGRES_PASSWORD` to secure random values in production!

### Generate Secure Secrets

```bash
# Generate JWT_SECRET
openssl rand -base64 32

# Generate POSTGRES_PASSWORD
openssl rand -base64 24
```

## Services

The stack consists of 3 services:

1. **postgres** - PostgreSQL 15 database
   - Port: 5432 (internal)
   - Data persisted in `postgres_data` volume

2. **backend** - Rust backend API
   - Port: 3000 (configurable)
   - Handles authentication, messaging, and real-time communication
   - File uploads stored in `backend_uploads` volume

3. **web** - Dioxus web frontend (WASM)
   - Port: 8080 (configurable)
   - Served by nginx

## Common Commands

### Start Services

```bash
# Development (builds from source)
docker-compose up -d

# Production (uses pre-built images)
docker-compose -f docker-compose.prod.yml up -d
```

### Stop Services

```bash
docker-compose down

# Stop and remove volumes (WARNING: deletes all data)
docker-compose down -v
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f web
docker-compose logs -f postgres
```

### Restart Service

```bash
docker-compose restart backend
docker-compose restart web
```

### Update Images (Production)

```bash
# Pull latest images
docker-compose -f docker-compose.prod.yml pull

# Restart services
docker-compose -f docker-compose.prod.yml up -d
```

### Database Management

```bash
# Access PostgreSQL shell
docker-compose exec postgres psql -U toruser -d tor_chat

# Backup database
docker-compose exec postgres pg_dump -U toruser tor_chat > backup.sql

# Restore database
docker-compose exec -T postgres psql -U toruser tor_chat < backup.sql
```

### View Container Status

```bash
docker-compose ps
```

## Production Deployment

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- Domain name (optional, for SSL)
- Reverse proxy (nginx/Traefik) for HTTPS

### Steps

1. **Clone repository**
   ```bash
   git clone https://github.com/idan2025/tor-chat-app.git
   cd tor-chat-app
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   nano .env
   # Set secure JWT_SECRET and POSTGRES_PASSWORD
   ```

3. **Start services**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

4. **Configure reverse proxy** (example with nginx)
   ```nginx
   server {
       listen 80;
       server_name chat.example.com;

       location / {
           proxy_pass http://localhost:8080;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }

       location /api {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }

       location /socket.io {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
       }
   }
   ```

5. **Add SSL with Let's Encrypt**
   ```bash
   sudo certbot --nginx -d chat.example.com
   ```

## Security Considerations

### Production Checklist

- [ ] Change default `JWT_SECRET` to a secure random value
- [ ] Change default `POSTGRES_PASSWORD`
- [ ] Use HTTPS (SSL/TLS) in production
- [ ] Configure firewall rules (only expose 80/443)
- [ ] Enable log rotation
- [ ] Set up regular database backups
- [ ] Update images regularly for security patches
- [ ] Use Docker secrets instead of environment variables for sensitive data

### Firewall Configuration

```bash
# Allow only HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Block direct access to backend/database
sudo ufw deny 3000/tcp
sudo ufw deny 5432/tcp
```

## Monitoring

### Health Checks

```bash
# Check if services are healthy
docker-compose ps

# Backend health
curl http://localhost:3000/api/tor/status

# Web health
curl http://localhost:8080
```

### Resource Usage

```bash
# View resource usage
docker stats

# View disk usage
docker system df
```

## Troubleshooting

### Backend Won't Start

```bash
# Check logs
docker-compose logs backend

# Common issues:
# 1. Database not ready - wait for postgres health check
# 2. Missing libsodium - rebuild image
# 3. Wrong DATABASE_URL - check .env file
```

### Web Can't Connect to Backend

```bash
# Check if backend is accessible
curl http://localhost:3000/api/tor/status

# Check web configuration
docker-compose logs web

# Ensure both services are on same network
docker network inspect tor-chat-app_tor-chat-network
```

### Database Connection Issues

```bash
# Test database connection
docker-compose exec postgres psql -U toruser -d tor_chat

# Check logs
docker-compose logs postgres

# Reset database (WARNING: deletes all data)
docker-compose down -v
docker-compose up -d
```

### Out of Disk Space

```bash
# Clean up unused containers and images
docker system prune -a

# Remove old volumes
docker volume prune
```

## Updating

### Update Application

```bash
# Pull latest code
git pull origin main

# Production (pre-built images)
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d

# Development (rebuild)
docker-compose up -d --build
```

### Database Migrations

Database migrations are run automatically on backend startup. If migrations fail:

```bash
# Check backend logs
docker-compose logs backend

# Manually run migrations
docker-compose exec backend ./tor-chat-backend migrate
```

## Performance Tuning

### PostgreSQL

Edit `docker-compose.yml` to add PostgreSQL configuration:

```yaml
postgres:
  command: postgres -c max_connections=200 -c shared_buffers=256MB
```

### Backend

Scale backend instances:

```bash
docker-compose up -d --scale backend=3
```

Note: Requires load balancer configuration.

## Backup Strategy

### Automated Backups

Create a cron job for daily backups:

```bash
# /etc/cron.daily/tor-chat-backup
#!/bin/bash
BACKUP_DIR=/backups/tor-chat
DATE=$(date +%Y%m%d_%H%M%S)

# Backup database
docker-compose exec -T postgres pg_dump -U toruser tor_chat | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup uploads
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz ./backend_uploads

# Keep only last 7 days
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete
```

## Support

For issues and questions:
- GitHub Issues: https://github.com/idan2025/tor-chat-app/issues
- Documentation: https://github.com/idan2025/tor-chat-app/wiki
