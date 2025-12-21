import { Router } from 'express';
import authRoutes from './auth.routes';
import emailRoutes from './email.routes';
import accountRoutes from './account.routes';
import labelRoutes from './label.routes';
import reminderRoutes from './reminder.routes';
import adminRoutes from './admin.routes.js';
import analyticsRoutes from './analytics.routes.js';

const router = Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/emails', emailRoutes);
router.use('/accounts', accountRoutes);
router.use('/labels', labelRoutes); // All label endpoints including approval
router.use('/reminders', reminderRoutes);
router.use('/admin', adminRoutes);
router.use('/analytics', analyticsRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API v1 is healthy',
    timestamp: new Date().toISOString(),
  });
});

export default router;
