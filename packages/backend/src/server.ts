import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { initializeDatabase, closeDatabase } from './database';
import { SocketService } from './socket';
import { torService } from './services/tor';
import { logger } from './utils/logger';

// Import routes
import authRoutes from './routes/auth';
import roomRoutes from './routes/rooms';

// Import models to ensure they are registered
import './models';

const app = express();
const server = createServer(app);

// Trust proxy - required when behind nginx reverse proxy
app.set('trust proxy', true);

// Middleware
app.use(helmet({
  contentSecurityPolicy: config.env === 'production',
}));

app.use(cors({
  origin: config.cors.origins,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// TOR status endpoint
app.get('/api/tor-status', async (_req, res) => {
  const isConnected = await torService.checkTorConnection();
  const info = torService.getConnectionInfo();
  res.json({
    ...info,
    connected: isConnected,
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: config.env === 'development' ? err.message : 'Internal server error',
  });
});

// Initialize Socket.IO
new SocketService(server);

// TOR connection retry logic
async function retryTorConnection(attempt: number = 1, maxAttempts: number = 10): Promise<void> {
  try {
    const torConnected = await torService.checkTorConnection();
    if (torConnected) {
      logger.info('TOR connection verified');
      const hiddenService = torService.getHiddenServiceAddress();
      if (hiddenService) {
        logger.info(`Hidden service available: ${hiddenService}`);
      } else {
        logger.debug('Hidden service address not found (this is normal if using Docker tor-hidden-service)');
      }
      return;
    }

    // If not connected and we haven't reached max attempts, retry
    if (attempt < maxAttempts) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000); // Exponential backoff, max 30s
      logger.warn(`TOR connection failed (attempt ${attempt}/${maxAttempts}). Retrying in ${delay}ms...`);
      setTimeout(() => retryTorConnection(attempt + 1, maxAttempts), delay);
    } else {
      logger.error(`TOR connection failed after ${maxAttempts} attempts. Continuing without TOR.`);
    }
  } catch (error) {
    logger.error('Error checking TOR connection:', error);
    if (attempt < maxAttempts) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
      setTimeout(() => retryTorConnection(attempt + 1, maxAttempts), delay);
    }
  }
}

// Startup
async function start(): Promise<void> {
  try {
    // Initialize database
    await initializeDatabase();
    logger.info('Database initialized');

    // Check TOR connection with retry logic
    if (config.tor.enabled) {
      retryTorConnection().catch((error) => {
        logger.error('Fatal error in TOR connection retry:', error);
      });
    }

    // Start server
    server.listen(config.port, config.host, () => {
      logger.info(`Server running on ${config.host}:${config.port}`);
      logger.info(`Environment: ${config.env}`);
      logger.info(`TOR enabled: ${config.tor.enabled}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(): Promise<void> {
  logger.info('Shutting down gracefully...');
  try {
    // Close HTTP server
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Close database connection
    await closeDatabase();
    logger.info('Server shut down successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Promise Rejection:', reason);
  // Don't exit the process, just log the error
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  // For critical errors, gracefully shutdown
  shutdown();
});

// Start server
start();
