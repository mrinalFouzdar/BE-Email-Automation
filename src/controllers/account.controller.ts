import { Response } from 'express';
import { accountModel } from '../models';
import { AuthRequest } from '../types';
import { asyncHandler, successResponse, createdResponse } from '../utils';
import { NotFoundError, UnauthorizedError, ValidationError } from '../middlewares';

class AccountController {
  /**
   * Get all accounts for current user
   */
  getAll = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const accounts = await accountModel.findByUserId(req.user.id);
    return successResponse(res, accounts);
  });

  /**
   * Get account by ID
   */
  getById = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const account = await accountModel.findById(parseInt(id));

    if (!account) {
      throw new NotFoundError('Account');
    }

    // Check ownership
    if (req.user && account.user_id !== req.user.id) {
      throw new UnauthorizedError('Access denied');
    }

    return successResponse(res, account);
  });

  /**
   * Create new email account
   */
  create = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    // Check if account already exists
    const existingAccount = await accountModel.findByEmail(req.body.email);
    if (existingAccount) {
      throw new ValidationError('Email account already exists');
    }

    const account = await accountModel.createAccount({
      ...req.body,
      user_id: req.user.id,
    });

    return createdResponse(res, account, 'Account created successfully');
  });

  /**
   * Update account
   */
  update = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    // Verify ownership
    const account = await accountModel.findById(parseInt(id));
    if (!account) {
      throw new NotFoundError('Account');
    }

    if (req.user && account.user_id !== req.user.id) {
      throw new UnauthorizedError('Access denied');
    }

    const updatedAccount = await accountModel.update(parseInt(id), req.body);
    return successResponse(res, updatedAccount, 'Account updated successfully');
  });

  /**
   * Delete account
   */
  delete = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    // Verify ownership
    const account = await accountModel.findById(parseInt(id));
    if (!account) {
      throw new NotFoundError('Account');
    }

    if (req.user && account.user_id !== req.user.id) {
      throw new UnauthorizedError('Access denied');
    }

    await accountModel.delete(parseInt(id));
    return successResponse(res, null, 'Account deleted successfully');
  });

  /**
   * Get active accounts
   */
  getActive = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const accounts = await accountModel.findActiveAccounts(userId);
    return successResponse(res, accounts);
  });

  /**
   * Toggle account active status
   */
  toggleActive = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { is_active } = req.body;

    const account = await accountModel.findById(parseInt(id));
    if (!account) {
      throw new NotFoundError('Account');
    }

    if (req.user && account.user_id !== req.user.id) {
      throw new UnauthorizedError('Access denied');
    }

    const updatedAccount = await accountModel.setActive(parseInt(id), is_active);
    return successResponse(
      res,
      updatedAccount,
      `Account ${is_active ? 'activated' : 'deactivated'} successfully`
    );
  });
}

export const accountController = new AccountController();
