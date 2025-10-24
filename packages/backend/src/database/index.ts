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

    // Sync models (in production, use migrations instead)
    if (config.env === 'development') {
      await sequelize.sync({ alter: true });
      logger.info('Database models synchronized');
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
