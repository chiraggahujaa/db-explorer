/**
 * Notification Service
 *
 * Manages in-app notifications and notification delivery across multiple channels
 * Integrates with email service and WebSocket for real-time updates
 */

import { BaseService } from './BaseService.js';
import { supabaseAdmin } from '../utils/database.js';
import { DataMapper } from '../utils/mappers.js';
import {
  Notification,
  NotificationFilters,
  NotificationPreference,
  NotificationChannel,
  NotificationCategory,
  CreateNotificationRequest,
  UpdateNotificationPreferenceRequest,
  NotificationStats,
  NotificationDeliveryOptions,
  buildNotificationFromTemplate,
  getNotificationCategory,
} from '../types/notification.js';
import { PaginatedResponse } from '../types/common.js';
import { EmailService } from './EmailService.js';

export class NotificationService extends BaseService {
  private emailService: EmailService;

  constructor() {
    super('notifications');
    this.emailService = new EmailService();
  }

  /**
   * Create a notification
   */
  async createNotification(data: CreateNotificationRequest): Promise<Notification> {
    try {
      const notificationData = DataMapper.toSnakeCase({
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        data: data.data || {},
        expiresAt: data.expiresAt,
      });

      const { data: notification, error } = await supabaseAdmin
        .from('notifications')
        .insert(notificationData)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create notification: ${error.message}`);
      }

      return DataMapper.toCamelCase(notification) as Notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Send notification across appropriate channels based on user preferences
   */
  async sendNotification(
    userId: string,
    notification: CreateNotificationRequest,
    options?: NotificationDeliveryOptions
  ): Promise<Notification> {
    try {
      // Determine notification category
      const category = getNotificationCategory(notification.type);

      // Get user preferences for this notification type
      const preferences = await this.getUserPreferences(userId);
      const categoryPrefs = preferences.filter((pref) => pref.notificationType === category);

      // Determine which channels to use
      const channels: NotificationChannel[] = options?.channels || ['in_app', 'email'];
      const enabledChannels = options?.ignorePreferences
        ? channels
        : channels.filter((channel) => {
            const pref = categoryPrefs.find((p) => p.channel === channel);
            return pref?.enabled !== false; // Default to enabled if no preference
          });

      // Always create in-app notification
      const inAppNotification = await this.createNotification({
        ...notification,
        userId,
      });

      // Send email notification if enabled
      if (enabledChannels.includes('email')) {
        try {
          await this.sendEmailNotification(userId, notification);
        } catch (error) {
          console.error('Failed to send email notification:', error);
          // Don't fail the whole operation if email fails
        }
      }

      // Future: Send push notification if enabled
      if (enabledChannels.includes('push')) {
        // TODO: Implement push notifications
        console.log('Push notifications not yet implemented');
      }

      return inAppNotification;
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(
    userId: string,
    notification: CreateNotificationRequest
  ): Promise<void> {
    try {
      // Get user email
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);

      if (error || !data?.user?.email) {
        console.warn('Could not find user email for notification:', userId);
        return;
      }

      // Send email using email service
      await this.emailService.sendNotificationEmail(
        data.user.email,
        notification.title,
        notification.message,
        notification.data
      );
    } catch (error) {
      console.error('Error sending email notification:', error);
      throw error;
    }
  }

  /**
   * Get user's notifications with filtering and pagination
   */
  async getUserNotifications(
    userId: string,
    filters: NotificationFilters = {}
  ): Promise<PaginatedResponse<Notification>> {
    try {
      const { page = 1, limit = 20, read, type, startDate, endDate } = filters;
      const offset = (page - 1) * limit;

      let query = supabaseAdmin
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);

      // Apply filters
      if (read !== undefined) {
        query = query.eq('read', read);
      }

      if (type) {
        if (Array.isArray(type)) {
          query = query.in('type', type);
        } else {
          query = query.eq('type', type);
        }
      }

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }

      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }

      // Order by created_at desc and apply pagination
      query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        throw new Error(`Failed to fetch notifications: ${error.message}`);
      }

      const totalPages = Math.ceil((count || 0) / limit);

      return {
        success: true,
        data: DataMapper.toCamelCase(data || []) as Notification[],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      console.error('Error getting user notifications:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<Notification> {
    try {
      const { data, error } = await supabaseAdmin
        .from('notifications')
        .update({
          read: true,
          read_at: new Date().toISOString(),
        })
        .eq('id', notificationId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to mark notification as read: ${error.message}`);
      }

      return DataMapper.toCamelCase(data) as Notification;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<number> {
    try {
      const { data, error } = await supabaseAdmin
        .from('notifications')
        .update({
          read: true,
          read_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('read', false)
        .select('id');

      if (error) {
        throw new Error(`Failed to mark all notifications as read: ${error.message}`);
      }

      return data?.length || 0;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to delete notification: ${error.message}`);
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const { count, error } = await supabaseAdmin
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) {
        throw new Error(`Failed to get unread count: ${error.message}`);
      }

      return count || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  /**
   * Get notification statistics for a user
   */
  async getStats(userId: string): Promise<NotificationStats> {
    try {
      const { data, error } = await supabaseAdmin
        .from('notifications')
        .select('type, read')
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to get notification stats: ${error.message}`);
      }

      const stats: NotificationStats = {
        total: data?.length || 0,
        unread: data?.filter((n: any) => !n.read).length || 0,
        byType: {} as any,
      };

      // Count by type
      data?.forEach((notification: any) => {
        const type = notification.type;
        if (type && typeof type === 'string') {
          stats.byType[type as keyof typeof stats.byType] = (stats.byType[type as keyof typeof stats.byType] || 0) + 1;
        }
      });

      return stats;
    } catch (error) {
      console.error('Error getting notification stats:', error);
      throw error;
    }
  }

  /**
   * Get user's notification preferences
   */
  async getUserPreferences(userId: string): Promise<NotificationPreference[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to get notification preferences: ${error.message}`);
      }

      return DataMapper.toCamelCase(data || []) as NotificationPreference[];
    } catch (error) {
      console.error('Error getting notification preferences:', error);
      throw error;
    }
  }

  /**
   * Update notification preference
   */
  async updatePreference(
    preferenceId: string,
    userId: string,
    update: UpdateNotificationPreferenceRequest
  ): Promise<NotificationPreference> {
    try {
      const { data, error } = await supabaseAdmin
        .from('notification_preferences')
        .update(DataMapper.toSnakeCase(update))
        .eq('id', preferenceId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update notification preference: ${error.message}`);
      }

      return DataMapper.toCamelCase(data) as NotificationPreference;
    } catch (error) {
      console.error('Error updating notification preference:', error);
      throw error;
    }
  }

  /**
   * Check if notification should be sent based on preferences
   */
  async shouldSendNotification(
    userId: string,
    category: NotificationCategory,
    channel: NotificationChannel
  ): Promise<boolean> {
    try {
      const { data, error } = await supabaseAdmin
        .from('notification_preferences')
        .select('enabled')
        .eq('user_id', userId)
        .eq('notification_type', category)
        .eq('channel', channel)
        .single();

      if (error || !data) {
        // Default to enabled if no preference found
        return true;
      }

      return data.enabled;
    } catch (error) {
      console.error('Error checking notification preference:', error);
      return true; // Default to enabled on error
    }
  }

  /**
   * Delete expired notifications (cleanup job)
   */
  async deleteExpiredNotifications(): Promise<number> {
    try {
      const { data, error } = await supabaseAdmin
        .from('notifications')
        .delete()
        .lte('expires_at', new Date().toISOString())
        .select('id');

      if (error) {
        throw new Error(`Failed to delete expired notifications: ${error.message}`);
      }

      const deletedCount = data?.length || 0;
      console.log(`Deleted ${deletedCount} expired notifications`);

      return deletedCount;
    } catch (error) {
      console.error('Error deleting expired notifications:', error);
      return 0;
    }
  }

  /**
   * Send job-related notification with template
   */
  async sendJobNotification(
    userId: string,
    type: 'job_queued' | 'job_started' | 'job_completed' | 'job_failed',
    jobData: {
      jobId: string;
      jobType: string;
      connectionId?: string;
      error?: string;
      result?: any;
    }
  ): Promise<Notification> {
    const { title, message } = buildNotificationFromTemplate(type, jobData);

    return this.sendNotification(userId, {
      userId,
      type,
      title,
      message,
      data: jobData,
    });
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
