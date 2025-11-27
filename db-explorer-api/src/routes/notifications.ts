/**
 * Notification Routes
 *
 * API routes for notification management
 */

import { Router } from 'express';
import { NotificationController } from '../controllers/NotificationController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// All notification routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/notifications
 * @desc    Get user's notifications
 * @access  Private
 */
router.get('/', NotificationController.getNotifications);

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get unread notification count
 * @access  Private
 */
router.get('/unread-count', NotificationController.getUnreadCount);

/**
 * @route   GET /api/notifications/stats
 * @desc    Get notification statistics
 * @access  Private
 */
router.get('/stats', NotificationController.getStats);

/**
 * @route   GET /api/notifications/preferences
 * @desc    Get user's notification preferences
 * @access  Private
 */
router.get('/preferences', NotificationController.getPreferences);

/**
 * @route   PATCH /api/notifications/preferences/:id
 * @desc    Update notification preference
 * @access  Private
 */
router.patch('/preferences/:id', NotificationController.updatePreference);

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.patch('/read-all', NotificationController.markAllAsRead);

/**
 * @route   GET /api/notifications/:id
 * @desc    Get notification by ID
 * @access  Private
 */
router.get('/:id', NotificationController.getNotification);

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.patch('/:id/read', NotificationController.markAsRead);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete notification
 * @access  Private
 */
router.delete('/:id', NotificationController.deleteNotification);

export default router;
