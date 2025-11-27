import { Response } from 'express';
import { ApiResponse, PaginatedResponse } from '../types';

/**
 * Send success response
 */
export const successResponse = <T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200
): Response<ApiResponse<T>> => {
  return res.status(statusCode).json({
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Send paginated response
 */
export const paginatedResponse = <T>(
  res: Response,
  data: T[],
  page: number,
  limit: number,
  total: number,
  message?: string
): Response<PaginatedResponse<T[]>> => {
  const totalPages = Math.ceil(total / limit);

  return res.status(200).json({
    success: true,
    data,
    message,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
    timestamp: new Date().toISOString(),
  });
};

/**
 * Send error response
 */
export const errorResponse = (
  res: Response,
  error: string,
  statusCode = 500,
  message?: string
): Response<ApiResponse> => {
  return res.status(statusCode).json({
    success: false,
    error,
    message,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Send created response
 */
export const createdResponse = <T>(
  res: Response,
  data: T,
  message = 'Resource created successfully'
): Response<ApiResponse<T>> => {
  return successResponse(res, data, message, 201);
};

/**
 * Send no content response
 */
export const noContentResponse = (res: Response): Response => {
  return res.status(204).send();
};
