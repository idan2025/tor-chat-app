# Using TOR Chat with Full Tor Network Routing

This app provides **Tor-grade security** for anonymous, encrypted communication. The backend is exposed as a Tor hidden service (.onion address), and you can route all traffic through the Tor network.

## Current Architecture

### Without Tor Browser (Default)
```
Client → nginx:5173 → backend:3000 (regular HTTP/WebSocket)
- ✅ End-to-end encryption (messages encrypted with room keys)
- ❌ NOT routed through Tor network
- ❌ IP addresses visible
```

### With Tor Browser (Full Anonymity)
```
Client → Tor Network → .onion address → backend:3000
- ✅ End-to-end encryption
- ✅ Fully routed through Tor network
- ✅ IP addresses hidden
- ✅ Anonymous access
```

## How to Use with Full Tor Routing

### Step 1: Find Your .onion Address

After running `docker compose up`, check the backend logs for your .onion address:

```bash
docker compose logs backend | grep "onion"
```

You should see:
```
╔════════════════════════════════════════════════════════════════╗
║  TOR HIDDEN SERVICE ACTIVE                                     ║
║  .onion address: abc123xyz456.onion                            ║
╚════════════════════════════════════════════════════════════════╝
```

### Step 2: Use Tor Browser

1. **Download Tor Browser**: https://www.torproject.org/download/

2. **Access your .onion address**:
   ```
   http://your-onion-address.onion:3000
   ```

3. **All traffic now routed through Tor!**
   - Your IP is hidden
   - Connection is anonymous
   - Messages still end-to-end encrypted

### Step 3: Share the .onion Address

- Give your .onion address to users who want to connect
- They must use Tor Browser to access it
- No port forwarding or public IP needed
- Works anywhere in the world anonymously

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
