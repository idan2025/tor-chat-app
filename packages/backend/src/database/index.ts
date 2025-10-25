import { Sequelize } from 'sequelize';
import { config } from '../config';
import { logger } from '../utils/logger';

export const sequelize = new Sequelize(config.database.url, {
  dialect: 'postgres',
  logging: (msg) => logger.debug(msg),
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

export async function initializeDatabase(): Promise<void> {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully');

    // Sync models
    if (config.env === 'development') {
      await sequelize.sync({ alter: true });
      logger.info('Database models synchronized (development mode)');
    } else {
      // In production, create tables if they don't exist but don't alter existing ones
      await sequelize.sync();
      logger.info('Database models synchronized (production mode)');
    }
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    throw error;
  }
}

export async function closeDatabase(): Promise<void> {
  await sequelize.close();
  logger.info('Database connection closed');
}
