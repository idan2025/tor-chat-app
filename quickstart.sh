#!/bin/bash

# TOR Chat Quick Start Script
# This script sets up and runs TOR Chat with Docker

set -e

echo "========================================="
echo "  TOR Chat - Quick Start Setup"
echo "========================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    echo "   Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker and Docker Compose are installed"
echo ""

# Create backend .env if it doesn't exist
if [ ! -f packages/backend/.env ]; then
    echo "📝 Creating backend environment file..."
    cp packages/backend/.env.example packages/backend/.env

    # Generate a random JWT secret
    JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')

    # Update JWT_SECRET in .env file
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" packages/backend/.env
    else
        sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" packages/backend/.env
    fi

    echo "✅ Backend configuration created with secure JWT secret"
else
    echo "✅ Backend configuration already exists"
fi
echo ""

# Create web .env if it doesn't exist
if [ ! -f packages/web/.env ]; then
    echo "📝 Creating web environment file..."
    cp packages/web/.env.example packages/web/.env
    echo "✅ Web configuration created"
else
    echo "✅ Web configuration already exists"
fi
echo ""

# Start Docker Compose
echo "🚀 Starting TOR Chat services..."
echo ""
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if services are running
if docker-compose ps | grep -q "Up"; then
    echo "✅ Services are running!"
    echo ""
    echo "========================================="
    echo "  TOR Chat is now running!"
    echo "========================================="
    echo ""
    echo "📱 WebUI:      http://localhost:5173"
    echo "🔧 Backend:    http://localhost:3000"
    echo "💾 Database:   localhost:5432"
    echo ""
    echo "📋 View logs:  docker-compose logs -f"
    echo "🛑 Stop:       docker-compose down"
    echo ""
    echo "🧅 Getting .onion address (may take a minute)..."
    sleep 5
    if docker exec torchat-tor cat /var/lib/tor/hidden_service/hostname 2>/dev/null; then
        echo ""
    else
        echo "   (TOR is still starting up, check later with:"
        echo "    docker exec torchat-tor cat /var/lib/tor/hidden_service/hostname)"
        echo ""
    fi
    echo "========================================="
    echo "  Next Steps:"
    echo "========================================="
    echo ""
    echo "1. Open http://localhost:5173 in your browser"
    echo "2. Register a new account"
    echo "3. Create or join a chat room"
    echo "4. Start chatting securely!"
    echo ""
    echo "📖 Documentation: See README.md and SETUP.md"
    echo "🔒 Security: See SECURITY.md"
    echo ""
else
    echo "❌ Some services failed to start. Check logs:"
    echo "   docker-compose logs"
    exit 1
fi
