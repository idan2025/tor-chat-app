# TOR Chat Deployment Guide

## Quick Start with Docker

### Development

```bash
# Copy environment file
cp packages/backend/.env.example packages/backend/.env

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production

```bash
# Copy and configure production environment
cp .env.prod.example .env.prod
nano .env.prod  # Edit with your secure values

# Start production stack
docker-compose -f docker-compose.prod.yml up -d

# View .onion address
docker exec torchat-tor cat /var/lib/tor/hidden_service/hostname
```

## Manual Deployment

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- TOR installed and running
- Nginx (optional, for production)

### Backend Setup

```bash
cd packages/backend

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
nano .env

# Run migrations
npm run migrate

# Build
npm run build

# Start
npm start
```

### TOR Hidden Service Configuration

Add to `/etc/tor/torrc`:

```
HiddenServiceDir /var/lib/tor/hidden_service/
HiddenServicePort 80 127.0.0.1:3000
```

Restart TOR:
```bash
sudo systemctl restart tor
```

Get your .onion address:
```bash
sudo cat /var/lib/tor/hidden_service/hostname
```

### WebUI Deployment

```bash
cd packages/web

# Install dependencies
npm install

# Build for production
npm run build

# Files will be in dist/ directory
# Serve with nginx or any static file server
```

### Nginx Configuration (Production)

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/ssl/certs/your-cert.crt;
    ssl_certificate_key /etc/ssl/private/your-key.key;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    root /var/www/torchat/web/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Desktop App Build

```bash
cd packages/desktop

# Install dependencies
npm install

# Build for all platforms
npm run make

# Installers will be in out/make/ directory
```

### Android App Build

```bash
cd packages/android

# Install dependencies
npm install

# Build release APK
cd android
./gradlew assembleRelease

# APK location:
# android/app/build/outputs/apk/release/app-release.apk
```

## Security Checklist

### Before Production Deployment

- [ ] Change all default passwords
- [ ] Generate strong JWT_SECRET (min 32 characters)
- [ ] Configure firewall (only expose necessary ports)
- [ ] Enable HTTPS with valid SSL certificate
- [ ] Configure rate limiting
- [ ] Set up database backups
- [ ] Enable logging and monitoring
- [ ] Review CORS allowed origins
- [ ] Test TOR connection
- [ ] Update all dependencies
- [ ] Disable debug modes
- [ ] Set NODE_ENV=production
- [ ] Configure fail2ban or similar
- [ ] Set up regular security updates

## Monitoring

### Health Checks

```bash
# Backend health
curl http://localhost:3000/health

# TOR status
curl http://localhost:3000/api/tor-status

# Database connection
docker exec torchat-postgres pg_isready
```

### Logs

```bash
# Docker logs
docker-compose logs -f backend
docker-compose logs -f postgres

# Application logs
tail -f packages/backend/logs/combined.log
tail -f packages/backend/logs/error.log
```

## Backup & Restore

### Database Backup

```bash
# Backup
docker exec torchat-postgres pg_dump -U toruser torchat > backup.sql

# Restore
docker exec -i torchat-postgres psql -U toruser torchat < backup.sql
```

### TOR Keys Backup

```bash
# Backup hidden service keys
docker cp torchat-tor:/var/lib/tor/hidden_service ./tor_backup/

# Restore
docker cp ./tor_backup/ torchat-tor:/var/lib/tor/hidden_service
```

## Troubleshooting

### Backend won't start

1. Check logs: `docker-compose logs backend`
2. Verify database connection
3. Check environment variables
4. Ensure ports are not in use

### TOR connection fails

1. Verify TOR is running: `docker ps | grep tor`
2. Check TOR logs: `docker-compose logs tor`
3. Verify SOCKS proxy port (9050)
4. Test with: `curl --socks5 localhost:9050 https://check.torproject.org`

### Database connection errors

1. Check PostgreSQL is running
2. Verify DATABASE_URL is correct
3. Check credentials
4. Ensure database exists

### WebSocket not connecting

1. Verify backend is running
2. Check CORS configuration
3. Ensure Socket.IO port is accessible
4. Check firewall rules

## Performance Tuning

### PostgreSQL

```sql
-- Increase connection pool
ALTER SYSTEM SET max_connections = 100;

-- Tune shared buffers
ALTER SYSTEM SET shared_buffers = '256MB';

-- Optimize work memory
ALTER SYSTEM SET work_mem = '16MB';
```

### Node.js

```bash
# Increase max memory
NODE_OPTIONS="--max-old-space-size=4096" npm start
```

### Nginx

```nginx
# Enable caching
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m max_size=1g inactive=60m;

# Worker processes
worker_processes auto;
worker_connections 1024;
```

## Scaling

### Horizontal Scaling

Use Docker Swarm or Kubernetes for multi-instance deployment:

```bash
# Docker Swarm example
docker swarm init
docker stack deploy -c docker-compose.prod.yml torchat
docker service scale torchat_backend=3
```

### Load Balancing

Add Nginx load balancer:

```nginx
upstream backend {
    least_conn;
    server backend1:3000;
    server backend2:3000;
    server backend3:3000;
}
```

## Support

For issues and questions:
- GitHub Issues: https://github.com/yourusername/tor-chat-app/issues
- Documentation: See README.md
