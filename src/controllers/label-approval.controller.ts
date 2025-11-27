import { Response } from 'express';
import { AuthRequest } from '../types/api.types.js';
import { asyncHandler } from '../utils/asyncHandler.util.js';
import { successResponse } from '../utils/response.util.js';
import { UnauthorizedError } from '../middlewares/error.middleware.js';
import { labelApprovalService } from '../services/label-approval.service.js';
import { db } from '../config/database.config.js';

export class LabelApprovalController {
  /**
   * Get pending label suggestions for the authenticated user
   * GET /api/v1/labels/pending
   */
  getMyPendingSuggestions = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const suggestions = await labelApprovalService.getPendingSuggestionsByUser(userId);

    return successResponse(res, suggestions, 'Pending suggestions retrieved successfully');
  });

  /**
   * Approve or reject a label suggestion (user can only process their own)
   * POST /api/v1/labels/suggestions/:id/process
   */
  processLabelSuggestion = asyncHandler(async (req: AuthRequest, res: Response) => {
    const suggestionId = parseInt(req.params.id);
    const { action } = req.body; // 'approve' or 'reject'
    const userId = req.user!.userId;

    if (!['approve', 'reject'].includes(action)) {
      throw new UnauthorizedError('Invalid action. Must be "approve" or "reject"');
    }

    // Check if suggestion belongs to the user
    const suggestionCheck = await db.query(
      'SELECT user_id, email_id FROM pending_label_suggestions WHERE id = $1',
      [suggestionId]
    );

    if (suggestionCheck.rows.length === 0) {
      throw new UnauthorizedError('Suggestion not found');
    }

    if (suggestionCheck.rows[0].user_id !== userId) {
      throw new UnauthorizedError('You can only process your own label suggestions');
    }

    // Process the suggestion
    const result = await labelApprovalService.processSuggestion({
      suggestion_id: suggestionId,
      action,
      approved_by: userId,
    });

    if (!result.success) {
      return successResponse(res, result, result.message, 400);
    }

    // If approved, auto-apply to similar emails
    if (action === 'approve' && result.label_id) {
      try {
        const appliedCount = await labelApprovalService.autoApplyToSimilarEmails(
          result.label_id,
          userId,
          suggestionCheck.rows[0].email_id
        );

        return successResponse(
          res,
          { ...result, similar_emails_labeled: appliedCount },
          `Label approved and applied to ${appliedCount} similar emails`
        );
      } catch (error) {
        // Continue even if auto-apply fails
        console.error('Error auto-applying to similar emails:', error);
      }
    }

    return successResponse(res, result, result.message);
  });

  /**
   * Get count of pending suggestions for badge display
   * GET /api/v1/labels/pending/count
   */
  getPendingCount = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;

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
