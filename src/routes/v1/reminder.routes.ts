import { Router } from 'express';
import { reminderController } from '../../controllers';
import { validate, authenticate, optionalAuth } from '../../middlewares';
import {
  createReminderSchema,
  updateReminderSchema,
  reminderIdParamSchema,
  getReminderQuerySchema,
} from '../../validators';

const router = Router();

/**
 * @route   GET /api/v1/reminders
 * @desc    Get all reminders with filters
 * @access  Public (optionally authenticated)
 */
router.get('/', optionalAuth, validate(getReminderQuerySchema), reminderController.getAll);

/**
 * @route   GET /api/v1/reminders/high-priority
 * @desc    Get high priority reminders
 * @access  Public
 */
router.get('/high-priority', reminderController.getHighPriority);

/**
 * @route   GET /api/v1/reminders/email/:emailId
 * @desc    Get reminders for specific email
 * @access  Public
 */
router.get('/email/:emailId', reminderController.getByEmailId);

/**
 * @route   GET /api/v1/reminders/:id
 * @desc    Get reminder by ID
 * @access  Public
 */
router.get('/:id', validate(reminderIdParamSchema), reminderController.getById);

/**
 * @route   POST /api/v1/reminders
 * @desc    Create new reminder
 * @access  Private (or AI)
 */
router.post('/', optionalAuth, validate(createReminderSchema), reminderController.create);

/**
 * @route   PUT /api/v1/reminders/:id
 * @desc    Update reminder
 * @access  Private
 */
router.put('/:id', authenticate, validate(updateReminderSchema), reminderController.update);

/**
 * @route   PATCH /api/v1/reminders/:id/resolve
 * @desc    Mark reminder as resolved
 * @access  Private
 */
router.patch('/:id/resolve', authenticate, validate(reminderIdParamSchema), reminderController.resolve);

/**
 * @route   PATCH /api/v1/reminders/:id/unresolve
 * @desc    Mark reminder as unresolved
 * @access  Private
 */
router.patch('/:id/unresolve', authenticate, validate(reminderIdParamSchema), reminderController.unresolve);

/**
 * @route   DELETE /api/v1/reminders/:id
 * @desc    Delete reminder
 * @access  Private
 */
router.delete('/:id', authenticate, validate(reminderIdParamSchema), reminderController.delete);

export default router;
