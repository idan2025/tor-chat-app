import winston from 'winston';
import { config } from '../config';
import * as fs from 'fs';

/**
 * PRIVACY-FOCUSED LOGGING SYSTEM
 *
 * This logger can be completely disabled for maximum privacy in production TOR deployments.
 * When ENABLE_LOGGING=false is set, ALL logging is disabled - no console output, no file writes.
 * This ensures ZERO logs are created, which is critical for privacy-focused applications.
 *
 * Configuration:
 * - ENABLE_LOGGING=true  (default) - Full logging enabled for development/debugging
 * - ENABLE_LOGGING=false - Complete zero-logging mode for maximum privacy
 * - LOG_LEVEL=info       - Log level when logging is enabled
 *
 * WARNING: Disabling logging means NO error logs, NO audit trails, NO debugging information.
 * Only use ENABLE_LOGGING=false in production environments where privacy is paramount.
 */

// Silent no-op logger that does nothing when logging is disabled
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

// Create the actual Winston logger
const createWinstonLogger = () => {
  const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  );

  const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      let msg = `${timestamp} [${level}]: ${message}`;
      if (Object.keys(meta).length > 0) {
        msg += ` ${JSON.stringify(meta)}`;
      }
      return msg;
    })
  );

  // Create logs directory if it doesn't exist (only when logging is enabled)
  if (!fs.existsSync('logs')) {
    fs.mkdirSync('logs', { recursive: true });
  }

  return winston.createLogger({
    level: config.logging.level,
    format: logFormat,
    transports: [
      new winston.transports.Console({
        format: consoleFormat,
      }),
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
      }),
    ],
  });
};

/**
 * Export logger based on configuration
 * If logging is disabled, all logger methods become silent no-ops
 * If logging is enabled, full Winston logger with console and file transports
 */
export const logger = config.logging.enabled
  ? createWinstonLogger()
  : createNoOpLogger();
