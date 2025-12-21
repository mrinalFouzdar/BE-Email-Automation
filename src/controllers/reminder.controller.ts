import { Response } from 'express';
import { reminderModel } from '../models';
import { AuthRequest } from '../types';
import { asyncHandler, successResponse, createdResponse } from '../utils';
import { NotFoundError } from '../middlewares';

class ReminderController {
  /**
   * Get all reminders
   */
  getAll = asyncHandler(async (req: AuthRequest, res: Response) => {
    const resolved = req.query.resolved === 'true' ? true : req.query.resolved === 'false' ? false : undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;

    let reminders;
    
    // Handle Admin override
    if (req.user?.role === 'admin' && userId) {
      reminders = await reminderModel.findByUserId(userId, limit, resolved !== false); // Default to resolving=false (unresolved) if not specified? 
      // Actually findByUserId logic needs to handle 'resolved' being undefined aka BOTH.
      // My model implementation `WHERE r.resolved = $2` forces a choice.
      // Let's stick to simple logic: if admin requests user, they usually want unresolved or all.
      // The current UI sends NOTHING for resolved, which means `undefined`.
      // Let's adjust logic to be robust. 
      if (resolved !== undefined) {
          reminders = await reminderModel.findByUserId(userId, limit, resolved);
      } else {
          // If not specified, maybe show unresolved? existing findUnresolved does that.
          // Let's default to unresolved for consistency with "Active Reminders" view
          reminders = await reminderModel.findByUserId(userId, limit, false);
      }
    } else if (resolved === false) {
      reminders = await reminderModel.findUnresolved(limit);
    } else if (resolved !== undefined) {
      reminders = await reminderModel.findAll({ where: { resolved } as any, limit });
    } else {
      reminders = await reminderModel.findAll({ limit });
    }

    return successResponse(res, reminders);
  });

  /**
   * Get reminder by ID
   */
  getById = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const reminder = await reminderModel.findById(parseInt(id));

    if (!reminder) {
      throw new NotFoundError('Reminder');
    }

    return successResponse(res, reminder);
  });

  /**
   * Get reminders for email
   */
  getByEmailId = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { emailId } = req.params;
    const reminders = await reminderModel.findByEmailId(parseInt(emailId));
    return successResponse(res, reminders);
  });

  /**
   * Get high priority reminders
   */
  getHighPriority = asyncHandler(async (req: AuthRequest, res: Response) => {
    const minPriority = parseInt(req.query.min_priority as string) || 3;
    const reminders = await reminderModel.findHighPriority(minPriority);
    return successResponse(res, reminders);
  });

  /**
   * Create reminder
   */
  create = asyncHandler(async (req: AuthRequest, res: Response) => {
    const reminder = await reminderModel.createReminder(req.body);
    return createdResponse(res, reminder, 'Reminder created successfully');
  });

  /**
   * Update reminder
   */
  update = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const existing = await reminderModel.findById(parseInt(id));
    if (!existing) {
      throw new NotFoundError('Reminder');
    }

    const updatedReminder = await reminderModel.update(parseInt(id), req.body);
    return successResponse(res, updatedReminder, 'Reminder updated successfully');
  });

  /**
   * Mark reminder as resolved
   */
  resolve = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const reminder = await reminderModel.resolve(parseInt(id));
    if (!reminder) {
      throw new NotFoundError('Reminder');
    }

    return successResponse(res, reminder, 'Reminder marked as resolved');
  });

  /**
   * Mark reminder as unresolved
   */
  unresolve = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const reminder = await reminderModel.unresolve(parseInt(id));
    if (!reminder) {
      throw new NotFoundError('Reminder');
    }

    return successResponse(res, reminder, 'Reminder marked as unresolved');
  });

  /**
   * Delete reminder
   */
  delete = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const deleted = await reminderModel.delete(parseInt(id));
    if (!deleted) {
      throw new NotFoundError('Reminder');
    }

    return successResponse(res, null, 'Reminder deleted successfully');
  });
}

export const reminderController = new ReminderController();
