#!/bin/bash

# TOR Chat App Setup Script
# This script helps you set up the environment for deployment

set -e

echo "===================================="
echo "TOR Chat App Setup"
echo "===================================="
echo ""

# Check if .env exists
if [ -f .env ]; then
    echo "⚠️  .env file already exists."
    read -p "Do you want to regenerate it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Setup cancelled. Using existing .env file."
        exit 0
    fi
fi

# Generate JWT secret
echo "Generating secure JWT secret..."
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')

# Create .env file
cat > .env <<EOF
# JWT Secret (auto-generated)
JWT_SECRET=${JWT_SECRET}

# CORS Configuration (backend)
# Allow all origins by default (safe when using nginx proxy)
# To restrict, set specific origins: http://example.com:5173,http://another.com
ALLOWED_ORIGINS=*

# API URLs for web frontend
# The web app uses nginx proxy to forward API requests to the backend
# Use relative paths (default) for production deployment:
API_URL=/api
SOCKET_URL=

# For local development without docker (direct backend access):
# API_URL=http://localhost:3000/api
# SOCKET_URL=http://localhost:3000

# For remote server with external backend access:
# API_URL=http://YOUR_SERVER_IP:3000/api
# SOCKET_URL=http://YOUR_SERVER_IP:3000
EOF

echo "✅ .env file created successfully!"
echo ""
echo "Next steps:"
echo "1. Review the .env file if needed: cat .env"
echo "2. Pull the latest Docker images: docker compose pull"
echo "3. Start the services: docker compose up -d"
echo "4. Check the logs: docker compose logs -f"
echo ""
echo "Access the application at: http://YOUR_SERVER_IP:5173"
echo ""
