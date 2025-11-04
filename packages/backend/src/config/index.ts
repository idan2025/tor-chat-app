import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Only load .env file if it exists (for local development)
// In production (Docker), environment variables are injected by docker-compose
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',

  database: {
    url: process.env.DATABASE_URL || '',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'torchat',
    user: process.env.DB_USER || 'toruser',
    password: process.env.DB_PASSWORD || 'torpass',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'change-this-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  bcrypt: {
    rounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  },

  tor: {
    socksHost: process.env.TOR_SOCKS_HOST || 'localhost',
    socksPort: parseInt(process.env.TOR_SOCKS_PORT || '9050', 10),
    controlPort: parseInt(process.env.TOR_CONTROL_PORT || '9051', 10),
    controlPassword: process.env.TOR_CONTROL_PASSWORD || '',
    hiddenServiceDir: process.env.HIDDEN_SERVICE_DIR || '/var/lib/tor/hidden_service',
    enabled: process.env.ENABLE_TOR === 'true',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  cors: {
    origins: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(','),
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enabled: process.env.ENABLE_LOGGING !== 'false', // Default to enabled, set to 'false' to disable all logging
  },
};

export default config;
