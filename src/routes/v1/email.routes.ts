import { Router } from 'express';
import { emailController } from '../../controllers';
import { validate, authenticate, optionalAuth } from '../../middlewares';
import {
  createEmailSchema,
  getEmailsSchema,
  emailIdParamSchema,
  markAsReadSchema,
} from '../../validators';

const router = Router();

/**
 * @route   GET /api/v1/emails
 * @desc    Get all emails with filters
 * @access  Public (optionally authenticated)
 */
router.get('/', optionalAuth, validate(getEmailsSchema), emailController.getAll);

/**
 * @route   GET /api/v1/emails/unread-count
 * @desc    Get unread email count
 * @access  Public
 */
router.get('/unread-count', emailController.getUnreadCount);

/**
 * @route   GET /api/v1/emails/:id
 * @desc    Get email by ID
 * @access  Public
 */
router.get('/:id', validate(emailIdParamSchema), emailController.getById);

/**
 * @route   POST /api/v1/emails
 * @desc    Create new email
 * @access  Private
 */
router.post('/', authenticate, validate(createEmailSchema), emailController.create);

/**
 * @route   PATCH /api/v1/emails/:id/read
 * @desc    Mark email as read/unread
 * @access  Private
 */
router.patch('/:id/read', authenticate, validate(markAsReadSchema), emailController.markAsRead);

/**
 * @route   DELETE /api/v1/emails/:id
 * @desc    Delete email
 * @access  Private
 */
router.delete('/:id', authenticate, validate(emailIdParamSchema), emailController.delete);

export default router;
