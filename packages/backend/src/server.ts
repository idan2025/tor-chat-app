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

// Startup
async function start(): Promise<void> {
  try {
    // Initialize database
    await initializeDatabase();
    logger.info('Database initialized');

    // Check TOR connection
    if (config.tor.enabled) {
      const torConnected = await torService.checkTorConnection();
      if (torConnected) {
        logger.info('TOR connection verified');
        const hiddenService = torService.getHiddenServiceAddress();
        if (hiddenService) {
          logger.info(`Hidden service: ${hiddenService}`);
        } else {
          logger.warn('Hidden service not configured. See instructions:');
          logger.warn(torService.getHiddenServiceConfig());
        }
      } else {
        logger.warn('TOR connection failed. Make sure TOR is running.');
      }
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
    server.close();
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

// Start server
start();
