# Zero-Logging Configuration for Maximum Privacy

## Overview

This TOR-based chat application includes an optional **zero-logging mode** designed for maximum privacy. When enabled, the application creates absolutely NO logs of any kind - no console output, no log files, no error logs, and no audit trails.

This feature is critical for privacy-focused deployments where logging could potentially compromise user anonymity or leave traces of user activity.

## How It Works

The application uses a sophisticated logging system that can be completely disabled via environment variable:

- **When `ENABLE_LOGGING=true`** (default): Full Winston-based logging with console output and rotating log files
- **When `ENABLE_LOGGING=false`**: All logger methods become silent no-ops - NO output anywhere

## Configuration

### Environment Variable

Add this to your `.env` file or docker-compose environment:

```bash
ENABLE_LOGGING=false  # Disables ALL logging
```

Or to enable logging (default):

```bash
ENABLE_LOGGING=true   # Enables full logging
LOG_LEVEL=info        # Options: error, warn, info, http, verbose, debug, silly
```

### Docker Compose

The main `docker-compose.yml` file already supports this via environment variable passthrough:

```yaml
backend:
  environment:
    ENABLE_LOGGING: ${ENABLE_LOGGING:-true}
    LOG_LEVEL: ${LOG_LEVEL:-info}
```

To run with zero-logging:

```bash
ENABLE_LOGGING=false docker-compose up -d
```

Or add it to your `.env` file at the project root.

## Privacy Implications

### When ENABLE_LOGGING=false (Zero-Logging Mode)

**NO logs are created for:**
- User authentication attempts (success or failure)
- Message sending/receiving
- Room joins/leaves
- Connection events
- Errors (including database, network, or application errors)
- Security events
- TOR connection status
- System startup/shutdown
- Any user activity

**Benefits:**
- Maximum user privacy and anonymity
- No audit trail of user activities
- No accidental exposure of sensitive information
- Ideal for high-security TOR deployments
- Compliance with strict privacy requirements

**Drawbacks:**
- Impossible to debug production issues
- No monitoring or alerting capability
- Cannot investigate security incidents
- No performance metrics
- Cannot track system health

### When ENABLE_LOGGING=true (Standard Mode)

**Logs include:**
- Server startup/shutdown events
- User connections/disconnections
- Message events (with encrypted content only)
- Database operations
- TOR connection status
- Errors and warnings
- Security events

**Storage:**
- Console output (stdout/stderr)
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only

## Deployment Recommendations

### Development Environment
```bash
ENABLE_LOGGING=true
LOG_LEVEL=debug
```
Use full logging for development and debugging.

### Production (Privacy-Focused)
```bash
ENABLE_LOGGING=false
```
For maximum privacy TOR deployments where user anonymity is paramount.

### Production (With Monitoring)
```bash
ENABLE_LOGGING=true
LOG_LEVEL=error
```
Compromise: Only log errors for critical monitoring while minimizing log volume.

## Technical Implementation

### Logger Architecture

The logger is implemented in `/packages/backend/src/utils/logger.ts`:

```typescript
// Check environment variable
export const logger = config.logging.enabled
  ? createWinstonLogger()    // Full Winston logger
  : createNoOpLogger();       // Silent no-op logger
```

### No-Op Logger

When logging is disabled, all logger methods become silent functions:

```typescript
const createNoOpLogger = () => {
  const noOp = () => {};
  return {
    error: noOp,
    warn: noOp,
    info: noOp,
    http: noOp,
    verbose: noOp,
    debug: noOp,
    silly: noOp,
  };
};
```

This ensures **zero overhead** and **zero output** when logging is disabled.

## Verification

To verify zero-logging is working:

1. Set `ENABLE_LOGGING=false` in your environment
2. Start the application
3. Check that:
   - No console output appears (except critical Node.js errors)
   - No `logs/` directory is created
   - No log files exist

## Security Considerations

### When to Use Zero-Logging

Use `ENABLE_LOGGING=false` when:
- Deploying on TOR network where anonymity is critical
- Privacy regulations prohibit logging user activity
- Operating in jurisdictions with strict data retention laws
- Users require maximum anonymity guarantees
- The threat model includes log file compromise

### When NOT to Use Zero-Logging

Avoid `ENABLE_LOGGING=false` when:
- You need to debug production issues
- Security monitoring is required
- Compliance requires audit trails
- You need performance metrics
- The application is in testing/staging

## File System Impact

### With Logging Enabled
- Creates `logs/` directory
- Writes to `logs/combined.log` (all logs)
- Writes to `logs/error.log` (errors only)
- Files rotate based on size/date (Winston transports)

### With Logging Disabled
- NO `logs/` directory created
- NO log files written
- NO file I/O operations for logging
- Reduced disk space usage
- No log rotation needed

## Environment Variable Priority

The configuration follows this priority order:

1. **Environment variable** `ENABLE_LOGGING` (runtime)
2. **Docker environment** (docker-compose.yml)
3. **.env file** (packages/backend/.env)
4. **Default value** (`true` - logging enabled)

## Docker Volume Considerations

The docker-compose.yml includes a `backend_logs` volume:

```yaml
volumes:
  - backend_logs:/app/packages/backend/logs
```

When zero-logging is enabled, this volume will remain empty. You may choose to remove this volume mapping in production deployments with `ENABLE_LOGGING=false`.

## Testing the Feature

### Test Zero-Logging Mode

```bash
# Set environment variable
export ENABLE_LOGGING=false

# Run backend
cd packages/backend
npm run dev

# Perform various actions (login, send messages, etc.)
# Verify NO console output or log files are created
```

### Test Standard Logging Mode

```bash
# Set environment variable
export ENABLE_LOGGING=true
export LOG_LEVEL=debug

# Run backend
cd packages/backend
npm run dev

# Verify console output and log files are created in logs/
```

## Monitoring Without Logs

If you need to monitor a zero-logging deployment, consider:

1. **Health check endpoints**: Use `/health` and `/api/tor-status` endpoints
2. **External monitoring**: Monitor from outside (uptime checks, response times)
3. **Metrics endpoint**: Consider adding a Prometheus/metrics endpoint (separate from logs)
4. **Container health**: Use Docker health checks

## Questions and Support

For questions about the zero-logging feature:

1. Review this documentation
2. Check `/packages/backend/src/utils/logger.ts` for implementation details
3. Review `/packages/backend/.env.example` for configuration examples
4. Examine `/packages/backend/src/config/index.ts` for environment variable parsing

## Future Enhancements

Potential improvements to the logging system:

- Selective logging (e.g., errors only, no user activity)
- In-memory ring buffer for last N logs (no persistence)
- Optional syslog forwarding (external logging)
- Metrics collection without detailed logs
- Audit-only mode (log security events only)

---

**Remember:** Zero-logging means ZERO logs. Use this feature responsibly and only when privacy requirements justify the loss of observability.
