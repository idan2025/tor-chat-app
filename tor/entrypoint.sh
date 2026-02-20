#!/bin/sh
set -e

# Resolve the target hostname to an IP address.
# Docker DNS may not be ready immediately, so retry.
TARGET_HOST="${HIDDEN_SERVICE_TARGET:-web}"
TARGET_PORT="${HIDDEN_SERVICE_PORT:-80}"
MAX_RETRIES=30
RETRY=0

echo "Waiting for $TARGET_HOST to be resolvable..."

while ! getent hosts "$TARGET_HOST" >/dev/null 2>&1; do
    RETRY=$((RETRY + 1))
    if [ "$RETRY" -ge "$MAX_RETRIES" ]; then
        echo "ERROR: Could not resolve $TARGET_HOST after $MAX_RETRIES attempts"
        exit 1
    fi
    sleep 2
done

TARGET_IP=$(getent hosts "$TARGET_HOST" | awk '{ print $1 }')
echo "Resolved $TARGET_HOST -> $TARGET_IP"

# Generate torrc with resolved IP
cat > /tmp/torrc <<TORRC
# Tor Chat - Tor daemon configuration (generated)

# SOCKS5 proxy accessible from other containers
SocksPort 0.0.0.0:9050

# Hidden service configuration
HiddenServiceDir /var/lib/tor/hidden_service/service1
HiddenServicePort 80 ${TARGET_IP}:${TARGET_PORT}
TORRC

echo "Starting Tor with hidden service pointing to ${TARGET_IP}:${TARGET_PORT}"
exec tor -f /tmp/torrc
