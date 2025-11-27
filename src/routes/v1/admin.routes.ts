import { Router } from 'express';
import { adminController } from '../../controllers/admin.controller.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';

const router = Router();

// All admin routes require authentication AND admin role
router.use(authenticate);
router.use(authorize('admin'));

/**
 * @route   GET /api/v1/admin/users
 * @desc    Get all users (paginated)
 * @access  Admin only
 */
router.get('/users', adminController.getAllUsers);

/**
 * @route   GET /api/v1/admin/users/:id
 * @desc    Get user by ID with details
 * @access  Admin only
 */
router.get('/users/:id', adminController.getUserById);

/**
 * @route   POST /api/v1/admin/users
 * @desc    Create new user (admin only)
 * @access  Admin only
 */
router.post('/users', adminController.createUser);

/**
 * @route   PATCH /api/v1/admin/users/:id/role
 * @desc    Update user role
 * @access  Admin only
 */
router.patch('/users/:id/role', adminController.updateUserRole);

/**
 * @route   GET /api/v1/admin/labels/pending
 * @desc    Get all pending label suggestions
 * @access  Admin only
 */
router.get('/labels/pending', adminController.getAllPendingSuggestions);

/**
 * @route   POST /api/v1/admin/labels/suggestions/:id/process
 * @desc    Approve or reject a label suggestion
 * @access  Admin only
 */
router.post('/labels/suggestions/:id/process', adminController.processLabelSuggestion);

/**
 * @route   GET /api/v1/admin/stats
 * @desc    Get system statistics
 * @access  Admin only
 */
router.get('/stats', adminController.getSystemStats);

/**
 * @route   GET /api/v1/admin/users/:id/accounts
 * @desc    Get all email accounts for a specific user
 * @access  Admin only
 */
router.get('/users/:id/accounts', adminController.getUserAccounts);

/**
 * @route   POST /api/v1/admin/users/:id/accounts
 * @desc    Create email account for a specific user
 * @access  Admin only
 */
router.post('/users/:id/accounts', adminController.createUserAccount);

/**
 * @route   PUT /api/v1/admin/users/:id/accounts/:accountId
 * @desc    Update email account for a specific user
 * @access  Admin only
 */
router.put('/users/:id/accounts/:accountId', adminController.updateUserAccount);

/**
 * @route   DELETE /api/v1/admin/users/:id/accounts/:accountId
 * @desc    Delete email account for a specific user
 * @access  Admin only
 */
router.delete('/users/:id/accounts/:accountId', adminController.deleteUserAccount);

export default router;
