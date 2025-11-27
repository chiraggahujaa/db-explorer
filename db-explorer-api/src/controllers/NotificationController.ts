/**
 * Notification Controller
 *
 * Handles HTTP requests for notification management operations
 */

import { Request, Response } from 'express';
import { notificationService } from '../services/NotificationService.js';
import { NotificationFilters } from '../types/notification.js';

export class NotificationController {
  /**
   * Get user's notifications
   * GET /api/notifications
   */
  static async getNotifications(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      const filters: NotificationFilters = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        read: req.query.read === 'true' ? true : req.query.read === 'false' ? false : undefined,
        type: req.query.type as any,
      };

      const result = await notificationService.getUserNotifications(userId, filters);

      // Also include unread count
      const unreadCount = await notificationService.getUnreadCount(userId);

      res.status(200).json({
        ...result,
        unreadCount,
      });
    } catch (error: any) {
      console.error('Error getting notifications:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get notifications',
      });
    }
  }

  /**
   * Get notification by ID
   * GET /api/notifications/:id
   */
  static async getNotification(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      const result = await notificationService.findById(id);

      if (!result.success || !result.data) {
        res.status(404).json({
          success: false,
          error: 'Notification not found',
        });
        return;
      }

      // Check ownership
      if (result.data.userId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Forbidden',
        });
        return;
      }

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Error getting notification:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get notification',
      });
    }
  }

  /**
   * Mark notification as read
   * PATCH /api/notifications/:id/read
   */
  static async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      const notification = await notificationService.markAsRead(id, userId);

      res.status(200).json({
        success: true,
        data: notification,
      });
    } catch (error: any) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to mark notification as read',
      });
    }
  }

  /**
   * Mark all notifications as read
   * PATCH /api/notifications/read-all
   */
  static async markAllAsRead(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      const count = await notificationService.markAllAsRead(userId);

      res.status(200).json({
        success: true,
        data: { count },
        message: `${count} notifications marked as read`,
      });
    } catch (error: any) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to mark all notifications as read',
      });
    }
  }

  /**
   * Delete notification
   * DELETE /api/notifications/:id
   */
  static async deleteNotification(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      await notificationService.deleteNotification(id, userId);

      res.status(200).json({
        success: true,
        message: 'Notification deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting notification:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete notification',
      });
    }
  }

  /**
   * Get unread notification count
   * GET /api/notifications/unread-count
   */
  static async getUnreadCount(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      const count = await notificationService.getUnreadCount(userId);

      res.status(200).json({
        success: true,
        data: { count },
      });
    } catch (error: any) {
      console.error('Error getting unread count:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get unread count',
      });
    }
  }

  /**
   * Get notification statistics
   * GET /api/notifications/stats
   */
  static async getStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      const stats = await notificationService.getStats(userId);

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      console.error('Error getting notification stats:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get notification stats',
      });
    }
  }

  /**
   * Get user's notification preferences
   * GET /api/notifications/preferences
   */
  static async getPreferences(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      const preferences = await notificationService.getUserPreferences(userId);

      res.status(200).json({
        success: true,
        data: preferences,
      });
    } catch (error: any) {
      console.error('Error getting notification preferences:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get notification preferences',
      });
    }
  }

  /**
   * Update notification preference
   * PATCH /api/notifications/preferences/:id
   */
  static async updatePreference(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      const { enabled } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      if (typeof enabled !== 'boolean') {
        res.status(400).json({
          success: false,
          error: 'Invalid request: enabled must be a boolean',
        });
        return;
      }

      const preference = await notificationService.updatePreference(id, userId, { enabled });

      res.status(200).json({
        success: true,
        data: preference,
      });
    } catch (error: any) {
      console.error('Error updating notification preference:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update notification preference',
      });
    }
  }
}
