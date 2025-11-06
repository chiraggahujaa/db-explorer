// User controller for profile management
// Clean auth-focused implementation

import { Request, Response } from 'express';
import { UserService } from '../services/UserService.js';
import { updateUserSchema } from '../validations/user.js';
import { UpdateUserDto } from '../types/user.js';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  /**
   * Get current user profile
   * GET /api/users/me
   */
  async getProfile(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const result = await this.userService.getUserById(userId);

      if (!result.success) {
        return res.status(404).json(result);
      }

      res.json(result);
    } catch (error: any) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Update current user profile
   * PATCH /api/users/me
   */
  async updateProfile(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      // Validate request body
      const validation = updateUserSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.format(),
        });
      }

      const result = await this.userService.updateUser(userId, validation.data as UpdateUserDto);

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error: any) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get user by ID (public)
   * GET /api/users/:id
   */
  async getUserById(req: Request, res: Response) {
    try {
      // Validate ID parameter
      const userId = req.params.id;
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'Invalid user ID',
        });
      }

      const result = await this.userService.getUserById(userId);

      if (!result.success) {
        return res.status(404).json(result);
      }

      res.json(result);
    } catch (error: any) {
      console.error('Get user by ID error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
}
