import express, { Application } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import apiRoutes from './routes/index.js';
import {
  errorHandler,
  notFoundHandler,
  requestLogger,
  rateLimiter,
} from './middlewares/index.js';
import { logger } from './utils/index.js';

/**
 * Create and configure Express application
 */
export const createApp = (): Application => {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  // Request logging
  app.use(requestLogger);

  // Rate limiting
  app.use(rateLimiter.middleware());

  // API Routes
  app.use('/api', apiRoutes);

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      success: true,
      message: 'Email RAG API Server',
      version: '1.0.0',
      docs: '/api-docs',
      api: {
        v1: '/api/v1',
        health: '/api/v1/health',
      },
    });
  });

  // 404 Handler
  app.use(notFoundHandler);

  // Error Handler (must be last)
  app.use(errorHandler);

  logger.info('✅ Express app configured successfully');

  return app;
};
