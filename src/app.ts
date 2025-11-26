import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.js';
import { passport } from './config/passport.js';
import { } from './middleware/auth.middleware.js';
import authRoutes from './modules/auth/auth.routes.js';
import emailRoutes from './modules/emails/email.routes.js';
import reminderRoutes from './modules/reminders/reminder.routes.js';
import classifyRoutes from './modules/classify/classify.routes.js';
import accountRoutes from './modules/accounts/account.routes.js';
import extensionRoutes from './modules/extension/extension.routes.js';
import imapSyncRoutes from './routes/imap-sync.routes.js';
import { errorHandler } from './core/error.js';

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(passport.initialize());

// Request Logging Middleware
app.use((req, res, next) => {
  const start = Date.now();
  const { method, url } = req;

  // Hook into response finish to log after request is processed
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    
    // Colorize status code
    let statusColor = '\x1b[32m'; // Green for 2xx
    if (status >= 300) statusColor = '\x1b[36m'; // Cyan for 3xx
    if (status >= 400) statusColor = '\x1b[33m'; // Yellow for 4xx
    if (status >= 500) statusColor = '\x1b[31m'; // Red for 5xx
    const resetColor = '\x1b[0m';

    console.log(`[${new Date().toISOString()}] ${method} ${url} ${statusColor}${status}${resetColor} - ${duration}ms`);
  });

  next();
});

app.get('/', (_req, res) => res.send('Email RAG Backend is running'));

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Email RAG API Docs'
}));
// requireAuth
// API Routes
app.use('/oauth2', authRoutes);
app.use('/api/emails',  emailRoutes);
app.use('/api/reminders',  reminderRoutes);
app.use('/api/classify',  classifyRoutes);
app.use('/api/accounts',  accountRoutes);
app.use('/api/extension',  extensionRoutes);
app.use('/api/imap-sync',  imapSyncRoutes);

app.use(errorHandler);

export default app;