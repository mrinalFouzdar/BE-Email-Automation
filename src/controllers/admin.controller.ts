import { Response } from 'express';
import { AuthRequest } from '../types/api.types.js';
import { asyncHandler } from '../utils/asyncHandler.util.js';
import { successResponse, paginatedResponse, createdResponse } from '../utils/response.util.js';
import { UnauthorizedError, NotFoundError, ValidationError } from '../middlewares/error.middleware.js';
import { userModel } from '../models/user.model.js';
import { accountModel } from '../models/account.model.js';
import { labelApprovalService } from '../services/label-approval.service.js';
import { db } from '../config/database.config.js';
import { syncSingleImapAccount } from '../jobs/imap-sync-single.job.js';
import { encryptPassword } from '../services/encryption.service.js';

export class AdminController {
  /**
   * Get all users (admin only)
   * GET /api/v1/admin/users
   */
  getAllUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    // Get all users (excluding passwords)
    const users = await db.query(
      `SELECT id, email, name, role, created_at, updated_at
       FROM users
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    // Get total count
    const countResult = await db.query('SELECT COUNT(*) FROM users');
    const total = parseInt(countResult.rows[0].count);

    return paginatedResponse(res, users.rows, page, limit, total, 'Users retrieved successfully');
  });

  /**
   * Get user by ID with their accounts and stats (admin only)
   * GET /api/v1/admin/users/:id
   */
  getUserById = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = parseInt(req.params.id);

    // Get user details
    const user = await userModel.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Get user's email accounts
    const accountsResult = await db.query(
      'SELECT id, email, provider_type, status, created_at FROM email_accounts WHERE user_id = $1',
      [userId]
    );

    // Get email statistics
    const statsResult = await db.query(
      `SELECT
         COUNT(*) as total_emails,
         COUNT(*) FILTER (WHERE is_unread = true) as unread_count,
         COUNT(DISTINCT account_id) as account_count
       FROM emails
       WHERE account_id IN (SELECT id FROM email_accounts WHERE user_id = $1)`,
      [userId]
    );

    // Get label count
    const labelCountResult = await db.query(
      'SELECT COUNT(*) FROM user_labels WHERE user_id = $1',
      [userId]
    );

    const userWithDetails = {
      ...user,
      password_hash: undefined, // Remove password
      accounts: accountsResult.rows,
      stats: {
        total_emails: parseInt(statsResult.rows[0].total_emails) || 0,
        unread_count: parseInt(statsResult.rows[0].unread_count) || 0,
        account_count: parseInt(statsResult.rows[0].account_count) || 0,
        label_count: parseInt(labelCountResult.rows[0].count) || 0,
      },
    };

    return successResponse(res, userWithDetails, 'User details retrieved successfully');
  });

  /**
   * Create new user (admin only)
   * POST /api/v1/admin/users
   * Optionally creates IMAP account if IMAP credentials are provided
   */
  createUser = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { email, password, name, role, imapHost, imapPort, imapPassword } = req.body;

    // Validate required fields
    if (!email || !password || !name) {
      throw new ValidationError('Email, password, and name are required');
    }

    // Validate role
    if (role && !['user', 'admin'].includes(role)) {
      throw new ValidationError('Invalid role. Must be "user" or "admin"');
    }

    // Validate IMAP fields are mandatory ONLY for regular users (not admins)
    const isAdmin = role === 'admin';
    if (!isAdmin && (!imapHost || !imapPort || !imapPassword)) {
      throw new ValidationError('IMAP configuration is required for regular users: host, port, and password must be provided');
    }

    // Check if user already exists
    const existingUser = await userModel.findByEmail(email);
    if (existingUser) {
      throw new ValidationError('User with this email already exists');
    }

    // Create user
    const newUser = await userModel.createUser({
      email,
      password,
      name,
      role: role || 'user',
      is_active: true,
    });

    // Create IMAP account only for regular users (not admins)
    let imapAccount = null;
    if (!isAdmin && imapHost && imapPort && imapPassword) {
      try {
        // Encrypt IMAP password before storing
        const encryptedPassword = encryptPassword(imapPassword);

        imapAccount = await accountModel.create({
          user_id: newUser.id,
          email: email, // Use same email for IMAP
          account_name: `${name}'s Email`,
          provider_type: 'imap',
          imap_host: imapHost,
          imap_port: imapPort,
          imap_username: email,
          imap_password_encrypted: encryptedPassword,
          auto_fetch: true,
          fetch_interval: 15,
          enable_ai_labeling: true,
          monitored_labels: ['INBOX'], // PostgreSQL array - no JSON.stringify needed
          status: 'connected', // Set as connected so sync can run
          is_active: true,
        } as any);

        // Automatically trigger email sync in background (don't wait for it)
        console.log(`🔄 Triggering automatic email sync for account ID: ${imapAccount.id}`);
        syncSingleImapAccount(imapAccount.id)
          .then((result) => {
            if (result.success) {
              console.log(`✅ Automatic sync completed for ${email}: ${result.stats?.new} new emails`);
            } else {
              console.error(`❌ Automatic sync failed for ${email}:`, result.error);
            }
          })
          .catch((error) => {
            console.error(`❌ Automatic sync error for ${email}:`, error.message);
          });
      } catch (error: any) {
        // If IMAP account creation fails, delete the user and throw error
        await userModel.delete(newUser.id);
        throw new ValidationError(`Failed to create IMAP account: ${error.message}`);
      }
    }

    // Remove password from response
    const { password_hash, ...userWithoutPassword } = newUser as any;

    const message = isAdmin
      ? 'Admin user created successfully'
      : 'User and IMAP account created successfully. Email sync started automatically.';

    return createdResponse(res, {
      user: userWithoutPassword,
      imapAccount: imapAccount,
    }, message);
  });

  /**
   * Update user role (admin only)
   * PATCH /api/v1/admin/users/:id/role
   */
  updateUserRole = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = parseInt(req.params.id);
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
      throw new UnauthorizedError('Invalid role. Must be "user" or "admin"');
    }

    // Prevent self-demotion
    if (req.user?.userId === userId && role === 'user') {
      throw new UnauthorizedError('Cannot demote yourself from admin');
    }

    await db.query('UPDATE users SET role = $1 WHERE id = $2', [role, userId]);

    return successResponse(res, { userId, role }, 'User role updated successfully');
  });

  /**
   * Get all pending label suggestions (admin only)
   * GET /api/v1/admin/labels/pending
   */
  getAllPendingSuggestions = asyncHandler(async (req: AuthRequest, res: Response) => {
    const suggestions = await labelApprovalService.getAllPendingSuggestions();

    return successResponse(res, suggestions, 'Pending suggestions retrieved successfully');
  });

  /**
   * Approve or reject a label suggestion (admin only)
   * POST /api/v1/admin/labels/suggestions/:id/process
   */
  processLabelSuggestion = asyncHandler(async (req: AuthRequest, res: Response) => {
    const suggestionId = parseInt(req.params.id);
    const { action } = req.body; // 'approve' or 'reject'

    if (!['approve', 'reject'].includes(action)) {
      throw new UnauthorizedError('Invalid action. Must be "approve" or "reject"');
    }

    const result = await labelApprovalService.processSuggestion({
      suggestion_id: suggestionId,
      action,
      approved_by: req.user!.userId,
    });

    if (!result.success) {
      return successResponse(res, result, result.message, 400);
    }

    // If approved, auto-apply to similar emails
    if (action === 'approve' && result.label_id) {
      try {
        const suggestion = await db.query(
          'SELECT email_id, user_id FROM pending_label_suggestions WHERE id = $1',
          [suggestionId]
        );

        if (suggestion.rows.length > 0) {
          const appliedCount = await labelApprovalService.autoApplyToSimilarEmails(
            result.label_id,
            suggestion.rows[0].user_id,
            suggestion.rows[0].email_id
          );

          return successResponse(
            res,
            { ...result, similar_emails_labeled: appliedCount },
            `Label approved and applied to ${appliedCount} similar emails`
          );
        }
      } catch (error) {
        // Continue even if auto-apply fails
        console.error('Error auto-applying to similar emails:', error);
      }
    }

    return successResponse(res, result, result.message);
  });

  /**
   * Get system statistics (admin only)
   * GET /api/v1/admin/stats
   */
  getSystemStats = asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const stats = await db.query(`
        SELECT
          (SELECT COUNT(*) FROM users) as total_users,
          (SELECT COUNT(*) FROM users WHERE role = 'admin') as admin_count,
          (SELECT COUNT(*) FROM email_accounts) as total_accounts,
          (SELECT COUNT(*) FROM email_accounts WHERE status = 'connected') as active_accounts,
          (SELECT COUNT(*) FROM emails) as total_emails,
          (SELECT COUNT(*) FROM emails WHERE is_unread = true) as unread_emails,
          (SELECT COUNT(*) FROM labels) as total_labels,
          (SELECT COUNT(*) FROM labels WHERE is_system = true) as system_labels,
          (SELECT COUNT(*) FROM pending_label_suggestions WHERE status = 'pending') as pending_suggestions
      `);

      return successResponse(res, stats.rows[0], 'System statistics retrieved successfully');
    } catch (error: any) {
      // If tables don't exist, return zeros
      if (error.message?.includes('does not exist')) {
        const defaultStats = {
          total_users: 0,
          admin_count: 0,
          total_accounts: 0,
          active_accounts: 0,
          total_emails: 0,
          unread_emails: 0,
          total_labels: 0,
          system_labels: 0,
          pending_suggestions: 0
        };
        return successResponse(res, defaultStats, 'System statistics retrieved successfully (some tables not initialized)');
      }
      throw error;
    }
  });

  /**
   * Get all email accounts for a specific user (admin only)
   * GET /api/v1/admin/users/:id/accounts
   */
  getUserAccounts = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = parseInt(req.params.id);

    // Verify user exists
    const user = await userModel.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Get user's email accounts
    try {
      const accounts = await accountModel.findByUserId(userId);
      return successResponse(res, accounts, 'User email accounts retrieved successfully');
    } catch (error: any) {
      // If user_id column doesn't exist, return empty array
      if (error.message?.includes('user_id') && error.message?.includes('does not exist')) {
        return successResponse(res, [], 'User email accounts retrieved successfully (database not fully migrated)');
      }
      throw error;
    }
  });

  /**
   * Create email account for a specific user (admin only)
   * POST /api/v1/admin/users/:id/accounts
   */
  createUserAccount = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = parseInt(req.params.id);

    // Verify user exists
    const user = await userModel.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Check if account already exists
    const existingAccount = await accountModel.findByEmail(req.body.email);
    if (existingAccount) {
      throw new ValidationError('Email account already exists');
    }

    // Create account for the user
    const account = await accountModel.createAccount({
      ...req.body,
      user_id: userId,
    });

    return createdResponse(res, account, 'Email account created successfully for user');
  });

  /**
   * Update email account for a specific user (admin only)
   * PUT /api/v1/admin/users/:id/accounts/:accountId
   */
  updateUserAccount = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = parseInt(req.params.id);
    const accountId = parseInt(req.params.accountId);

    // Verify user exists
    const user = await userModel.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify account exists and belongs to user
    const account = await accountModel.findById(accountId);
    if (!account) {
      throw new NotFoundError('Account not found');
    }

    if (account.user_id !== userId) {
      throw new ValidationError('Account does not belong to this user');
    }

    // Update account
    const updatedAccount = await accountModel.update(accountId, req.body);

    return successResponse(res, updatedAccount, 'Email account updated successfully');
  });

  /**
   * Delete email account for a specific user (admin only)
   * DELETE /api/v1/admin/users/:id/accounts/:accountId
   */
  deleteUserAccount = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = parseInt(req.params.id);
    const accountId = parseInt(req.params.accountId);

    // Verify user exists
    const user = await userModel.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify account exists and belongs to user
    const account = await accountModel.findById(accountId);
    if (!account) {
      throw new NotFoundError('Account not found');
    }

    if (account.user_id !== userId) {
      throw new ValidationError('Account does not belong to this user');
    }

    // Delete account
    await accountModel.delete(accountId);

    return successResponse(res, null, 'Email account deleted successfully');
  });
}

export const adminController = new AdminController();
