import { Response } from 'express';
import { labelModel, emailLabelModel } from '../models';
import { AuthRequest } from '../types';
import { asyncHandler, successResponse, createdResponse } from '../utils';
import { NotFoundError, UnauthorizedError, ValidationError } from '../middlewares';

class LabelController {
  /**
   * Get all labels
   */
  getAll = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const labels = await labelModel.findByUserId(req.user.id);
    return successResponse(res, labels);
  });

  /**
   * Get system labels
   */
  getSystemLabels = asyncHandler(async (req: AuthRequest, res: Response) => {
    const labels = await labelModel.findSystemLabels();
    return successResponse(res, labels);
  });

  /**
   * Get label by ID
   */
  getById = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const label = await labelModel.findById(parseInt(id));

    if (!label) {
      throw new NotFoundError('Label');
    }

    return successResponse(res, label);
  });

  /**
   * Create new label
   */
  create = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    // Check if label already exists
    const existingLabel = await labelModel.findByName(req.body.name);
    if (existingLabel) {
      throw new ValidationError('Label with this name already exists');
    }

    const label = await labelModel.createLabel({
      ...req.body,
      created_by_user_id: req.user.id,
    });

    // Assign label to user
    await labelModel.assignToUser(req.user.id, label.id);

    return createdResponse(res, label, 'Label created successfully');
  });

  /**
   * Update label
   */
  update = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const label = await labelModel.findById(parseInt(id));
    if (!label) {
      throw new NotFoundError('Label');
    }

    // Prevent updating system labels
    if (label.is_system) {
      throw new ValidationError('Cannot update system labels');
    }

    const updatedLabel = await labelModel.update(parseInt(id), req.body);
    return successResponse(res, updatedLabel, 'Label updated successfully');
  });

  /**
   * Delete label
   */
  delete = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const label = await labelModel.findById(parseInt(id));
    if (!label) {
      throw new NotFoundError('Label');
    }

    // Prevent deleting system labels
    if (label.is_system) {
      throw new ValidationError('Cannot delete system labels');
    }

    await labelModel.delete(parseInt(id));
    return successResponse(res, null, 'Label deleted successfully');
  });

  /**
   * Assign label to email
   */
  assignToEmail = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { email_id, label_id, confidence_score } = req.body;

    const emailLabel = await emailLabelModel.assignLabel({
      email_id,
      label_id,
      assigned_by: req.user ? 'user' : 'ai',
      confidence_score,
    });

    return successResponse(res, emailLabel, 'Label assigned to email successfully');
  });

  /**
   * Get labels for email
   */
  getEmailLabels = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { emailId } = req.params;
    const labels = await emailLabelModel.findByEmailId(parseInt(emailId));
    return successResponse(res, labels);
  });

  /**
   * Remove label from email
   */
  removeFromEmail = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { emailId, labelId } = req.params;

    const removed = await emailLabelModel.removeLabel(
      parseInt(emailId),
      parseInt(labelId)
    );

    if (!removed) {
      throw new NotFoundError('Email label assignment');
    }

    return successResponse(res, null, 'Label removed from email successfully');
  });
}

export const labelController = new LabelController();
