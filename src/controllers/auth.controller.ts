import { Response } from 'express';
import jwt from 'jsonwebtoken';
import { userModel } from '../models';
import { AuthRequest } from '../types';
import { asyncHandler, successResponse, createdResponse } from '../utils';
import { UnauthorizedError, ValidationError } from '../middlewares';
import { JWT_CONFIG } from '../config/constants';

class AuthController {
  /**
   * Register new user
   * Note: Users can only self-register as 'user' role.
   * Admin accounts must be created via seed script or by existing admins.
   */
  register = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { email, password, name } = req.body;

    // Check if user already exists
    const existingUser = await userModel.findByEmail(email);
    if (existingUser) {
      throw new ValidationError('Email already registered');
    }

    // Create user with 'user' role (prevent admin self-registration)
    const user = await userModel.createUser({
      email,
      password,
      name,
      role: 'user'  // Force user role for self-registration
    });

    // Generate token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_CONFIG.SECRET,
      { expiresIn: JWT_CONFIG.EXPIRES_IN }
    );

    return createdResponse(res, {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    }, 'User registered successfully');
  });

  /**
   * Login user
   */
  login = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { email, password } = req.body;

    // Find user
    const user = await userModel.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await userModel.verifyPassword(user, password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Check if user is active
    if (!user.is_active) {
      throw new UnauthorizedError('Account is deactivated');
    }

    // Generate token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_CONFIG.SECRET,
      { expiresIn: JWT_CONFIG.EXPIRES_IN }
    );

    return successResponse(res, {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    }, 'Login successful');
  });

  /**
   * Get current user profile
   */
  getProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const user = await userModel.findById(req.user.id);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    return successResponse(res, {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      is_active: user.is_active,
      created_at: user.created_at,
    });
  });

  /**
   * Update user profile
   */
  updateProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const { name } = req.body;
    const updatedUser = await userModel.update(req.user.id, { name } as any);

    return successResponse(res, {
      id: updatedUser?.id,
      email: updatedUser?.email,
      name: updatedUser?.name,
    }, 'Profile updated successfully');
  });
}

export const authController = new AuthController();
