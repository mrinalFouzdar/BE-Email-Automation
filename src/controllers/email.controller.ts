import { Response } from 'express';
import { emailModel } from '../models';
import { AuthRequest, EmailFilters } from '../types';
import { asyncHandler, successResponse, createdResponse, paginatedResponse } from '../utils';
import { NotFoundError } from '../middlewares';
import { PAGINATION } from '../config/constants';

class EmailController {
  /**
   * Get all emails with filters
   */
  getAll = asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = parseInt(req.query.page as string) || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(
      parseInt(req.query.limit as string) || PAGINATION.DEFAULT_LIMIT,
      PAGINATION.MAX_LIMIT
    );
    const offset = (page - 1) * limit;

    const filters: EmailFilters = {
      is_unread: req.query.is_unread === 'true' ? true : req.query.is_unread === 'false' ? false : undefined,
      sender: req.query.sender as string,
      search: req.query.search as string,
    };

    // Handle user scoping
    if (req.user?.role === 'admin' && req.query.userId) {
      filters.userId = parseInt(req.query.userId as string);
    } else {
      filters.userId = req.user?.id;
    }

    const emails = await emailModel.findWithFilters(filters, limit, offset);
    const total = await emailModel.countWithFilters(filters);

    return paginatedResponse(res, emails, page, limit, total);
  });

  /**
   * Get email by ID
   */
  getById = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    console.log("🚀 ~ EmailController ~ id:", id)
    const email = await emailModel.findById(parseInt(id));
    console.log("🚀 ~ EmailController ~ email:", email)

    if (!email) {
      throw new NotFoundError('Email');
    }

    return successResponse(res, email);
  });

  /**
   * Create new email
   */
  create = asyncHandler(async (req: AuthRequest, res: Response) => {
    const email = await emailModel.createEmail(req.body);
    return createdResponse(res, email, 'Email created successfully');
  });

  /**
   * Mark email as read/unread
   */
  markAsRead = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { is_read } = req.body;

    const email = await emailModel.markAsRead(parseInt(id), is_read);

    if (!email) {
      throw new NotFoundError('Email');
    }

    return successResponse(res, email, `Email marked as ${is_read ? 'read' : 'unread'}`);
  });

  /**
   * Get unread count
   */
  getUnreadCount = asyncHandler(async (req: AuthRequest, res: Response) => {
    const accountId = req.query.account_id ? parseInt(req.query.account_id as string) : undefined;
    const count = await emailModel.getUnreadCount(accountId);

    return successResponse(res, { count });
  });

  /**
   * Delete email
   */
  delete = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const deleted = await emailModel.delete(parseInt(id));

    if (!deleted) {
      throw new NotFoundError('Email');
    }

    return successResponse(res, null, 'Email deleted successfully');
  });

  /**
   * Get email meta
   */
  getMeta = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const meta = await emailModel.getMeta(parseInt(id));
    return successResponse(res, meta);
  });
}

export const emailController = new EmailController();
