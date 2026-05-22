import app from './app.js';
import config from './config/index.js';
import logger from './config/logger.js';
import prisma from './utils/prisma.js';

/**
 * Start the HTTP server after establishing a database connection.
 */
const start = async () => {
  try {
    // Connect to the database
    await prisma.$connect();
    logger.info('Database connection established');

    // Start listening
    const server = app.listen(config.port, () => {
      logger.info(
        `Server running on port ${config.port} in ${config.env} mode`
      );
    });

    // -----------------------------------------------------------------------
    // Graceful shutdown
    // -----------------------------------------------------------------------

    /** @param {string} signal - The OS signal received */
    const gracefulShutdown = async (signal) => {
      logger.info(`${signal} received — shutting down gracefully…`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await prisma.$disconnect();
          logger.info('Database connection closed');
        } catch (err) {
          logger.error(err, 'Error disconnecting from database');
        }

        process.exit(0);
      });

      // Force exit after 30 seconds if graceful shutdown stalls
      setTimeout(() => {
        logger.error('Forced shutdown — graceful shutdown timed out');
        process.exit(1);
      }, 30_000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // -----------------------------------------------------------------------
    // Unhandled errors
    // -----------------------------------------------------------------------

    process.on('unhandledRejection', (reason) => {
      logger.error(reason, 'Unhandled promise rejection');
      process.exit(1);
    });

    process.on('uncaughtException', (error) => {
      logger.error(error, 'Uncaught exception');
      process.exit(1);
    });
  } catch (error) {
    logger.error(error, 'Failed to start server');
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  }
};

start();
