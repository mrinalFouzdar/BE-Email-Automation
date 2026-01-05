import { Router } from 'express';
import { labelController } from '../../controllers';
import { labelApprovalController } from '../../controllers/label-approval.controller.js';
import { validate, authenticate, optionalAuth } from '../../middlewares';
import {
  createLabelSchema,
  assignLabelSchema,
  labelIdParamSchema,
} from '../../validators';

const router = Router();

/**
 * @route   GET /api/v1/labels
 * @desc    Get all labels for current user
 * @access  Private
 */
router.get('/', authenticate, labelController.getAll);

/**
 * @route   GET /api/v1/labels/system
 * @desc    Get system labels
 * @access  Public
 */
router.get('/system', labelController.getSystemLabels);

/**
 * @route   GET /api/v1/labels/pending
 * @desc    Get pending label suggestions for current user
 * @access  Private
 */
router.get('/pending', authenticate, labelApprovalController.getMyPendingSuggestions);

/**
 * @route   GET /api/v1/labels/pending/count
 * @desc    Get count of pending suggestions
 * @access  Private
 */
router.get('/pending/count', authenticate, labelApprovalController.getPendingCount);

/**
 * @route   GET /api/v1/labels/pending-suggestions
 * @desc    Get ALL pending label suggestions (Admin only - all users)
 * @access  Admin
 */
router.get('/pending-suggestions', authenticate, labelApprovalController.getAllPendingSuggestions);

/**
 * @route   GET /api/v1/labels/:id
 * @desc    Get label by ID
 * @access  Public
 */
router.get('/:id', validate(labelIdParamSchema), labelController.getById);

/**
 * @route   POST /api/v1/labels
 * @desc    Create new label
 * @access  Private
 */
router.post('/', authenticate, validate(createLabelSchema), labelController.create);

/**
 * @route   PUT /api/v1/labels/:id
 * @desc    Update label
 * @access  Private
 */
router.put(
  '/:id',
  authenticate,
  validate(labelIdParamSchema),
  labelController.update
);

/**
 * @route   DELETE /api/v1/labels/:id
 * @desc    Delete label
 * @access  Private
 */
router.delete(
  '/:id',
  authenticate,
  validate(labelIdParamSchema),
  labelController.delete
);

/**
 * @route   POST /api/v1/labels/assign
 * @desc    Assign label to email
 * @access  Private (or AI)
 */
router.post('/assign', optionalAuth, validate(assignLabelSchema), labelController.assignToEmail);

/**
 * @route   GET /api/v1/labels/email/:emailId
 * @desc    Get labels for email
 * @access  Public
 */
router.get('/email/:emailId', labelController.getEmailLabels);

/**
 * @route   DELETE /api/v1/labels/email/:emailId/:labelId
 * @desc    Remove label from email
 * @access  Private
 */
router.delete('/email/:emailId/:labelId', authenticate, labelController.removeFromEmail);

/**
 * @route   POST /api/v1/labels/suggestions/:id/process
 * @desc    Approve or reject a label suggestion (user's own only)
 * @access  Private
 */
router.post('/suggestions/:id/process', authenticate, labelApprovalController.processLabelSuggestion);

export default router;
