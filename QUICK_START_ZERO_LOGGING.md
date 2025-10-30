# Quick Start: Zero-Logging Mode

## TL;DR - Maximum Privacy Deployment

```bash
# Deploy with zero-logging (NO logs anywhere)
ENABLE_LOGGING=false docker-compose up -d
```

That's it! Your TOR chat application now creates ZERO logs.

---

## What This Does

When you set `ENABLE_LOGGING=false`:

- **NO console output** (except critical Node.js crashes)
- **NO log files** created
- **NO logs directory** created
- **NO error logs**
- **NO audit trails**
- **Complete privacy**

## When to Use This

Use `ENABLE_LOGGING=false` when:
- Deploying on TOR for maximum anonymity
- Privacy is more important than debugging
- User anonymity must be guaranteed
- Operating in high-risk environments
- Legal/regulatory requirements prohibit logging

Do NOT use when:
- You need to debug issues
- Monitoring is required
- Compliance requires audit trails
- Testing/staging environments

## Configuration Options

### Option 1: Environment Variable (Recommended)

```bash
# Set in your shell
export ENABLE_LOGGING=false

# Then start the application
docker-compose up -d
```

### Option 2: .env File

Create or edit `packages/backend/.env`:
```bash
ENABLE_LOGGING=false
LOG_LEVEL=info  # Ignored when logging is disabled
```

### Option 3: Docker Compose Override

Edit `docker-compose.yml` backend service:
```yaml
backend:
  environment:
    ENABLE_LOGGING: "false"
```

### Option 4: Production .env File

Copy and edit production config:
```bash
cp .env.prod.example .env.prod
# Edit .env.prod and set:
# ENABLE_LOGGING=false
```

## Verification

After starting, verify zero-logging is active:

```bash
# 1. Check no logs directory exists
ls packages/backend/logs
# Should show: "No such file or directory"

# 2. Check Docker logs (should be minimal/empty)
docker logs torchat-backend
# Should show minimal or no output

# 3. Run verification script
./scripts/verify-zero-logging.sh
```

## Quick Comparison

| Feature | ENABLE_LOGGING=true | ENABLE_LOGGING=false |
|---------|---------------------|----------------------|
| Console output | Yes | No |
| Log files | Yes | No |
| Error logs | Yes | No |
| Debugging | Easy | Impossible |
| Privacy | Standard | Maximum |
| File I/O | Yes | No |
| Disk usage | Higher | Lower |

## Switching Back to Logging

To re-enable logging:

```bash
# Remove or change the environment variable
ENABLE_LOGGING=true docker-compose up -d

# Or simply omit it (defaults to enabled)
docker-compose up -d
```

## Common Questions

**Q: Can I see if the application is running?**
A: Yes, use health check endpoints:
- `http://localhost:3000/health`
- `http://localhost:3000/api/tor-status`

**Q: What if something breaks?**
A: You won't have logs. Enable logging temporarily to debug, then disable again.

**Q: Does this affect performance?**
A: Slightly improves performance (no I/O operations for logging).

**Q: Can I log only errors?**
A: Not with current implementation. It's all or nothing for maximum privacy.

**Q: Is user data still encrypted?**
A: Yes! Zero-logging is independent of encryption. All messages remain E2E encrypted.

## Emergency Debugging

If you need to debug while maintaining privacy:

1. Enable logging temporarily:
   ```bash
   ENABLE_LOGGING=true docker-compose restart backend
   ```

2. Reproduce the issue

3. Review logs:
   ```bash
   docker logs torchat-backend
   ```

4. Disable logging again:
   ```bash
   ENABLE_LOGGING=false docker-compose restart backend
   ```

5. Securely delete logs:
   ```bash
   docker exec torchat-backend rm -rf logs/
   # Or use secure deletion tool
   docker exec torchat-backend shred -vfz -n 10 logs/*
   ```

## Production Deployment Example

Complete production deployment with zero-logging:

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/tor-chat-app.git
cd tor-chat-app

# 2. Set environment variables
export ENABLE_LOGGING=false
export JWT_SECRET=$(openssl rand -base64 64)
export DB_PASSWORD=$(openssl rand -base64 32)

# 3. Start services
docker-compose up -d

# 4. Verify zero-logging
docker logs torchat-backend  # Should be empty or minimal
ls packages/backend/logs     # Should not exist

# 5. Check health
curl http://localhost:3000/health
```

## Security Checklist

Before deploying with zero-logging:

- [ ] Understood the privacy vs observability tradeoff
- [ ] Set up external health monitoring
- [ ] Documented why zero-logging is needed
- [ ] Tested in staging environment first
- [ ] Have emergency re-enable procedure ready
- [ ] Team knows there are no logs
- [ ] Alternative monitoring in place

## One-Line Deployments

### Docker Compose (Zero-Logging)
```bash
ENABLE_LOGGING=false docker-compose up -d
```

### Docker Compose (Standard Logging)
```bash
docker-compose up -d
```

### Local Development (Zero-Logging)
```bash
cd packages/backend && ENABLE_LOGGING=false npm run dev
```

### Local Development (Standard Logging)
```bash
cd packages/backend && npm run dev
```

## Further Reading

- **Detailed Guide**: [ZERO_LOGGING.md](ZERO_LOGGING.md)
- **Implementation Details**: [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)
- **Main Documentation**: [README.md](README.md)
- **Configuration Examples**: `packages/backend/.env.example`

## Support

If zero-logging isn't working:

1. Run verification: `./scripts/verify-zero-logging.sh`
2. Check spelling: `ENABLE_LOGGING` (case-sensitive)
3. Verify value: Must be exactly `"false"` (string)
4. Restart services: `docker-compose restart backend`

---

**Remember**: Zero-logging = ZERO logs = Maximum privacy + Zero observability

Choose wisely based on your deployment requirements.
