import { Response } from 'express';
import { AuthRequest } from '../types/api.types.js';
import { asyncHandler } from '../utils/asyncHandler.util.js';
import { successResponse } from '../utils/response.util.js';
import { UnauthorizedError } from '../middlewares/error.middleware.js';
import { labelApprovalService } from '../services/label/label-approval.service.js';
import { db } from '../config/database.config.js';

export class LabelApprovalController {
  /**
   * Get pending label suggestions for the authenticated user
   * GET /api/v1/labels/pending
   */
  getMyPendingSuggestions = asyncHandler(async (req: AuthRequest, res: Response) => {
    let userId = req.user!.id;
    
    // Admin can view other users' suggestions
    if (req.user?.role === 'admin' && req.query.userId) {
      userId = parseInt(req.query.userId as string);
    }

    const suggestions = await labelApprovalService.getPendingSuggestionsByUser(userId);

    return successResponse(res, suggestions, 'Pending suggestions retrieved successfully');
  });

  /**
   * Approve or reject a label suggestion
   * POST /api/v1/labels/suggestions/:id/process
   *
   * - Users can only process their own suggestions
   * - Admins can process suggestions for any user
   */
  processLabelSuggestion = asyncHandler(async (req: AuthRequest, res: Response) => {
    const suggestionId = parseInt(req.params.id);
    const { action } = req.body; // 'approve' or 'reject'
    const currentUserId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';

    if (!['approve', 'reject'].includes(action)) {
      throw new UnauthorizedError('Invalid action. Must be "approve" or "reject"');
    }

    // Check if suggestion exists
    const suggestionCheck = await db.query(
      'SELECT user_id, email_id FROM pending_label_suggestions WHERE id = $1',
      [suggestionId]
    );

    if (suggestionCheck.rows.length === 0) {
      throw new UnauthorizedError('Suggestion not found');
    }

    const suggestionUserId = suggestionCheck.rows[0].user_id;

    // Authorization check: User can only process their own, admin can process any
    if (!isAdmin && suggestionUserId !== currentUserId) {
      throw new UnauthorizedError('You can only process your own label suggestions');
    }

    // Log admin approval for audit trail
    if (isAdmin && suggestionUserId !== currentUserId) {
      console.log(`👨‍💼 Admin ${currentUserId} processing suggestion for user ${suggestionUserId} (${action})`);
    }

    // Process the suggestion (approved_by is the current user/admin)
    const result = await labelApprovalService.processSuggestion({
      suggestion_id: suggestionId,
      action,
      approved_by: currentUserId,
    });

    if (!result.success) {
      return successResponse(res, result, result.message, 400);
    }

    // If approved, auto-apply to similar emails (for the suggestion owner, not admin)
    if (action === 'approve' && result.label_id) {
      try {
        const appliedCount = await labelApprovalService.autoApplyToSimilarEmails(
          result.label_id,
          suggestionUserId, // Use suggestion owner's ID for auto-apply
          suggestionCheck.rows[0].email_id
        );

        const message = isAdmin && suggestionUserId !== currentUserId
          ? `Admin approved: Label applied to ${appliedCount} similar emails for user ${suggestionUserId}`
          : `Label approved and applied to ${appliedCount} similar emails`;

        return successResponse(
          res,
          {
            ...result,
            similar_emails_labeled: appliedCount,
            approved_by_admin: isAdmin && suggestionUserId !== currentUserId,
            suggestion_user_id: suggestionUserId,
          },
          message
        );
      } catch (error) {
        // Continue even if auto-apply fails
        console.error('Error auto-applying to similar emails:', error);
      }
    }

    const message = isAdmin && suggestionUserId !== currentUserId
      ? `Admin ${action}ed suggestion for user ${suggestionUserId}`
      : result.message;

    return successResponse(res, result, message);
  });

  /**
   * Get count of pending suggestions for badge display
   * GET /api/v1/labels/pending/count
   */
  getPendingCount = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;

    const result = await db.query(
      'SELECT COUNT(*) FROM pending_label_suggestions WHERE user_id = $1 AND status = $2',
      [userId, 'pending']
    );

    return successResponse(
      res,
      { count: parseInt(result.rows[0].count) },
      'Pending count retrieved successfully'
    );
  });
}

export const labelApprovalController = new LabelApprovalController();
