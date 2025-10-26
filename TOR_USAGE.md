# TOR Chat - Hassle-Free Tor-Grade Security

This app provides **Tor-grade security for everyone** - whether you use a regular browser or Tor Browser. The app is accessible both ways, and all messages are end-to-end encrypted.

## Dual Access: Regular Network + Tor Network

**TOR Chat is accessible TWO ways:**

### 1. Regular Browsers (Chrome, Brave, Firefox, etc.)
```
Access: http://localhost:5173
✅ Works instantly, no setup
✅ Messages fully encrypted
✅ Perfect for regular users
```

### 2. Tor Browser (Maximum Anonymity)
```
Access: http://your-web-app.onion
✅ IP address hidden
✅ Fully anonymous
✅ Censorship-resistant
✅ Messages fully encrypted
```

**Both groups can message each other seamlessly!** A user on a regular browser can chat with a user on Tor Browser - they'll never know the difference.

## Architecture

### Dual .onion Addresses

Your app has **TWO** .onion addresses:

1. **Web App .onion** - Access the chat interface via Tor
2. **Backend API .onion** - API accessible via Tor

Both are automatically created when you start the app.

### How Messages Flow

**Regular Browser User ↔ Tor Browser User:**
```
User A (Chrome, localhost:5173)
  → nginx
  → backend
  → nginx
  → User B (Tor Browser, xyz.onion)
```

- ✅ Messages are **end-to-end encrypted** with room keys
- ✅ Both users can send/receive flawlessly
- ✅ Tor users get full anonymity
- ✅ Regular users get instant access

## Getting Started

### For Regular Users (No Setup Required)

1. Start the app:
   ```bash
   docker compose up -d
   ```

2. Open your browser:
   ```
   http://localhost:5173
   ```

3. Register and start chatting!
   - ✅ Instant access
   - ✅ Messages fully encrypted
   - ✅ Chat with anyone (Tor or regular)

### For Tor Users (Maximum Anonymity)

1. Start the app (same as above):
   ```bash
   docker compose up -d
   ```

2. Find your .onion addresses:
   ```bash
   docker compose logs backend | grep -A 6 "TOR HIDDEN SERVICES"
   ```

   You'll see:
   ```
   ╔════════════════════════════════════════════════════════════════════╗
   ║                  TOR HIDDEN SERVICES ACTIVE                        ║
   ╠════════════════════════════════════════════════════════════════════╣
   ║  Backend API:  http://abc123backend.onion                          ║
   ║  Web App:      http://xyz789webapp.onion                           ║
   ╚════════════════════════════════════════════════════════════════════╝
   ```

3. Download **Tor Browser**: https://www.torproject.org/download/

4. Access your **Web App .onion** address in Tor Browser

5. Register and chat with full anonymity!
   - ✅ IP address hidden
   - ✅ Fully anonymous
   - ✅ Works anywhere
   - ✅ No port forwarding needed

### Sharing with Friends

**For regular users:** Share `http://your-server-ip:5173`

**For Tor users:** Share the **Web App .onion** address

Both can chat together seamlessly!

## Tor Network Benefits

When using the .onion address through Tor Browser:

1. **Anonymous Access**: Your IP address is hidden through Tor's onion routing
2. **No Firewall Issues**: Tor hidden services work without port forwarding
3. **Censorship Resistant**: Works even in restrictive networks
4. **Location Hidden**: Server location is hidden
5. **End-to-End Encrypted**: Messages encrypted + Tor transport encryption

## Technical Details

### What's Already Working

- ✅ Backend exposed as Tor hidden service (.onion)
- ✅ Tor bootstrapping automatically
- ✅ Room-based end-to-end encryption
- ✅ WebSocket real-time messaging
- ✅ Hidden service persists across restarts (volume)

### How Messages Flow (with Tor Browser)

```
User A (Tor Browser)
  → Tor Network (3 hops)
  → .onion address
  → Backend
  → Tor Network (3 hops)
  → User B (Tor Browser)
```

### Environment Variables

To build the web app for .onion access, set:

```bash
# In .env or docker build args
VITE_API_URL=http://your-onion-address.onion:3000/api
VITE_SOCKET_URL=http://your-onion-address.onion:3000
```

Then rebuild the web container:
```bash
docker compose build web
docker compose up -d web
```

## Advanced: Transparent Tor Proxy (Future)

To make regular browsers work with Tor without Tor Browser, we could add a Tor SOCKS proxy layer:

```yaml
# Future docker-compose addition
tor-proxy:
  image: dperson/torproxy
  ports:
    - "8118:8118"  # HTTP proxy
    - "9050:9050"  # SOCKS proxy
```

Then configure your browser to use `localhost:8118` as HTTP proxy.

## Security Considerations

- **With Tor Browser**: Maximum anonymity, IP hidden, censorship-resistant
- **Without Tor Browser**: Messages still encrypted, but IP visible to server
- **Best Practice**: Use Tor Browser for accessing .onion address
- **Network**: All users should use same method (all Tor or all regular)

## Troubleshooting

### Can't find .onion address

```bash
# Check if Tor container is running
docker compose ps tor

# Check Tor logs
docker compose logs tor

# Check backend logs for .onion
docker compose logs backend | grep -A 3 "TOR HIDDEN SERVICE"

# Manually check hostname file
docker compose exec tor cat /var/lib/tor/hidden_service/hostname
```

### Connection refused to .onion

- Ensure you're using **Tor Browser** (regular browsers can't access .onion)
- Check backend is running: `docker compose ps backend`
- Verify Tor bootstrapped: `docker compose logs tor | grep "100%"`

### Slow connections

- Tor routing adds latency (3-6 hops total)
- Normal for Tor hidden services
- Trade-off for anonymity

## Quick Start Commands

```bash
# Start everything
docker compose up -d

# Get your .onion address
docker compose logs backend | grep "onion address"

# Or directly from Tor
docker compose exec tor cat /var/lib/tor/hidden_service/hostname

# Test backend is accessible
curl http://your-onion.onion:3000/health --proxy socks5h://localhost:9050

# Access in Tor Browser
# http://your-onion.onion:3000
```

---

**Bottom Line**: Your app is **already a Tor hidden service**. Using Tor Browser to access the .onion address gives you **full Tor-grade anonymity** without any code changes!
