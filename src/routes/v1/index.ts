import { Router } from 'express';
import authRoutes from './auth.routes';
import emailRoutes from './email.routes';
import accountRoutes from './account.routes';
import labelRoutes from './label.routes';
import reminderRoutes from './reminder.routes';
import adminRoutes from './admin.routes.js';
import labelApprovalRoutes from '../label-approval.routes';

const router = Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/emails', emailRoutes);
router.use('/accounts', accountRoutes);
router.use('/labels', labelRoutes);
router.use('/labels', labelApprovalRoutes); // Label approval endpoints
router.use('/reminders', reminderRoutes);
router.use('/admin', adminRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API v1 is healthy',
    timestamp: new Date().toISOString(),
  });
});

export default router;
