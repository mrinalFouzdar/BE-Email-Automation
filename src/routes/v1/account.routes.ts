import { Router } from 'express';
import { accountController } from '../../controllers';
import { validate, authenticate } from '../../middlewares';
import {
  createAccountSchema,
  updateAccountSchema,
  accountIdParamSchema,
} from '../../validators';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/accounts
 * @desc    Get all accounts for current user
 * @access  Private
 */
router.get('/', accountController.getAll);

/**
 * @route   GET /api/v1/accounts/active
 * @desc    Get active accounts
 * @access  Private
 */
router.get('/active', accountController.getActive);

/**
 * @route   GET /api/v1/accounts/:id
 * @desc    Get account by ID
 * @access  Private
 */
router.get('/:id', validate(accountIdParamSchema), accountController.getById);

/**
 * @route   POST /api/v1/accounts
 * @desc    Create new email account
 * @access  Private
 */
router.post('/', validate(createAccountSchema), accountController.create);

/**
 * @route   PUT /api/v1/accounts/:id
 * @desc    Update account
 * @access  Private
 */
router.put('/:id', validate(updateAccountSchema), accountController.update);

/**
 * @route   PATCH /api/v1/accounts/:id/toggle
 * @desc    Toggle account active status
 * @access  Private
 */
router.patch('/:id/toggle', validate(accountIdParamSchema), accountController.toggleActive);

/**
 * @route   DELETE /api/v1/accounts/:id
 * @desc    Delete account
 * @access  Private
 */
router.delete('/:id', validate(accountIdParamSchema), accountController.delete);

export default router;
