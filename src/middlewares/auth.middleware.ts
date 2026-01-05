import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest, AuthTokenPayload } from '../types';
import { UnauthorizedError } from './error.middleware';
import { JWT_CONFIG } from '../config/constants';

/**
 * JWT Authentication Middleware
 */
export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(token, JWT_CONFIG.SECRET) as AuthTokenPayload;

    // Attach user to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid token'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Token expired'));
    } else {
      next(error);
    }
  }
};

/**
 * Optional authentication - doesn't fail if no token
 */
export const optionalAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_CONFIG.SECRET) as AuthTokenPayload;

      req.user = {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      };
    }

    next();
  } catch (error) {
    // Silently fail, user will be undefined
    next();
  }
};

/**
 * Role-based authorization middleware
 */
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    if (roles.length > 0 && (!req.user.role || !roles.includes(req.user.role))) {
      throw new UnauthorizedError('Insufficient permissions');
    }

    next();
  };
};

/**
 * Alias for authenticate (for backward compatibility)
 */
export const authenticateJWT = authenticate;
