require('dotenv').config();

const app = require('./app');
const logger = require('./utils/logger');
const pool = require('./db/connection');

const API_PORT = process.env.API_PORT || 8080;

// Start server
const server = app.listen(API_PORT, async () => {
  logger.info(`CSV Export Service listening on port ${API_PORT}`);

  // Test database connection
  try {
    const result = await pool.query('SELECT NOW()');
    logger.info('Database connected successfully');
  } catch (err) {
    logger.error('Database connection failed:', err);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(async () => {
    await pool.end();
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(async () => {
    await pool.end();
    logger.info('Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
