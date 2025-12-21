import { Response } from 'express';
import { accountModel } from '../models';
import { AuthRequest } from '../types';
import { asyncHandler, successResponse, createdResponse } from '../utils';
import { NotFoundError, UnauthorizedError, ValidationError } from '../middlewares';
import { initializeSystemLabelsInMailbox } from '../services/label/imap-label.service';

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

    // Validate IMAP credentials are provided
    const { email, provider, imap_host, imap_port, imap_user, imap_password } = req.body;
    
    if (!email) {
      throw new ValidationError('Email address is required');
    }

    // For IMAP accounts, ensure all required fields are provided
    if (provider === 'imap' || imap_host) {
      if (!imap_host || !imap_user || !imap_password) {
        throw new ValidationError(
          'IMAP accounts require: imap_host, imap_user, and imap_password'
        );
      }

      // Validate IMAP host format
      if (!imap_host.includes('.')) {
        throw new ValidationError('Invalid IMAP host format (e.g., imap.gmail.com)');
      }

      // Validate port if provided
      if (imap_port && (imap_port < 1 || imap_port > 65535)) {
        throw new ValidationError('IMAP port must be between 1 and 65535');
      }
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

    // Initialize system labels in Gmail/Outlook mailbox (for IMAP accounts)
    if (account.imap_host && account.imap_user) {
      try {
        console.log('🏷️ Initializing system labels in mailbox...');
        const result = await initializeSystemLabelsInMailbox({
          imap_host: account.imap_host,
          imap_port: account.imap_port || 993,
          imap_username: account.imap_user,
          imap_password_encrypted: account.imap_password || '',
        });
        
        if (result.success) {
          console.log(`✓ Created ${result.created.length} system labels in mailbox: ${result.created.join(', ')}`);
        } else {
          console.warn(`⚠️ Some labels failed to create: ${result.errors?.join(', ')}`);
        }
      } catch (error: any) {
        // Don't fail account creation if label initialization fails
        console.error('Failed to initialize system labels in mailbox:', error.message);
      }
    }

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
