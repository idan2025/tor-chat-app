#!/bin/bash
set -e

echo "=== Stopping containers ==="
sudo docker compose -f docker-compose.prod.yaml down

echo "=== Removing images ==="
sudo docker compose -f docker-compose.prod.yaml down --rmi all

echo "=== Removing volumes ==="
sudo docker compose -f docker-compose.prod.yaml down -v

echo "=== Pulling latest code ==="
git pull

echo "=== Pulling latest images ==="
sudo docker compose -f docker-compose.prod.yaml pull

echo "=== Starting containers ==="
sudo docker compose -f docker-compose.prod.yaml up
