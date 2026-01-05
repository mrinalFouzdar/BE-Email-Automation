import dotenv from 'dotenv';
import { createApp } from './app.js';
import { database } from './config/database.config.js';
import { logger } from './utils/index.js';
import { APP_CONFIG } from './config/constants.js';
import { startEmailSyncCron, stopEmailSyncCron } from './jobs/email-sync-cron.js';

// Load environment variables
dotenv.config();

/**
 * Start the server
 */
async function startServer() {
  try {
    // Connect to database
    logger.info('🔄 Connecting to database...');
    await database.connect();

    // Create Express app
    const app = createApp();

    // Start server
    const PORT = APP_CONFIG.PORT;
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📝 Environment: ${APP_CONFIG.NODE_ENV}`);
      logger.info(`🌐 API v1: http://localhost:${PORT}/api/v1`);
      logger.info(`💚 Health: http://localhost:${PORT}/api/v1/health`);
      logger.info(`💬 Chat API: http://localhost:${PORT}/api/v1/chat`);

      // Start email sync cron job
      const enableCron = process.env.ENABLE_EMAIL_SYNC_CRON !== 'false';
      if (enableCron) {
        logger.info('');
        startEmailSyncCron();
      } else {
        logger.info('⚠️  Email sync cron job is disabled (ENABLE_EMAIL_SYNC_CRON=false)');
      }
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      stopEmailSyncCron();
      await database.disconnect();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully...');
      stopEmailSyncCron();
      await database.disconnect();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Start the server
startServer();
