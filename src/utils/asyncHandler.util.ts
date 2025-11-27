import { Request, Response, NextFunction } from 'express';
import { AsyncRequestHandler } from '../types';

/**
 * Wraps async route handlers to catch errors and pass to error middleware
 */
export const asyncHandler = (fn: AsyncRequestHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
