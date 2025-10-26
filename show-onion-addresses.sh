#!/bin/bash

echo "=================================================="
echo "  TOR CHAT - Hidden Service Addresses"
echo "=================================================="
echo ""
echo "Waiting for Tor to generate .onion addresses..."
echo ""

# Wait for Tor to create the hostname files (max 60 seconds)
COUNTER=0
MAX_WAIT=60

while [ $COUNTER -lt $MAX_WAIT ]; do
  if [ -f "/var/lib/tor/hidden_service/service1/hostname" ] && [ -f "/var/lib/tor/hidden_service/service2/hostname" ]; then
    break
  fi
  sleep 1
  COUNTER=$((COUNTER + 1))
done

if [ -f "/var/lib/tor/hidden_service/service1/hostname" ]; then
  BACKEND_ONION=$(cat /var/lib/tor/hidden_service/service1/hostname)
  echo "╔════════════════════════════════════════════════════════════════════╗"
  echo "║  BACKEND API .onion ADDRESS                                        ║"
  echo "║  ${BACKEND_ONION}                              ║"
  echo "╚════════════════════════════════════════════════════════════════════╝"
  echo ""
else
  echo "⚠️  Backend .onion address not found"
  echo ""
fi

if [ -f "/var/lib/tor/hidden_service/service2/hostname" ]; then
  WEB_ONION=$(cat /var/lib/tor/hidden_service/service2/hostname)
  echo "╔════════════════════════════════════════════════════════════════════╗"
  echo "║  WEB APP .onion ADDRESS                                            ║"
  echo "║  ${WEB_ONION}                              ║"
  echo "╚════════════════════════════════════════════════════════════════════╝"
  echo ""
else
  echo "⚠️  Web app .onion address not found"
  echo ""
fi

echo "=================================================="
echo "  Access Options:"
echo "=================================================="
echo ""
echo "REGULAR BROWSERS (No Tor):"
echo "  Web App: http://localhost:5173"
echo "  Backend API: http://localhost:3000"
echo ""
echo "TOR BROWSER (Full Anonymity):"
if [ -f "/var/lib/tor/hidden_service/service2/hostname" ]; then
  echo "  Web App: http://${WEB_ONION}"
fi
if [ -f "/var/lib/tor/hidden_service/service1/hostname" ]; then
  echo "  Backend API: http://${BACKEND_ONION}"
fi
echo ""
echo "=================================================="
echo "  All messages are end-to-end encrypted!"
echo "  Tor routing provides additional anonymity."
echo "=================================================="
