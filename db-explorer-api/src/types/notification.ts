/**
 * Notification System Types
 *
 * Types for in-app notifications and notification preferences
 */

// Notification types
export type NotificationType =
  | 'job_queued'
  | 'job_started'
  | 'job_progress'
  | 'job_completed'
  | 'job_failed'
  | 'job_cancelled'
  | 'invitation_received'
  | 'invitation_accepted'
  | 'invitation_declined'
  | 'connection_shared'
  | 'connection_removed'
  | 'member_added'
  | 'member_removed'
  | 'role_changed'
  | 'system'
  | 'chat_mention'
  | 'chat_message';

// Notification channels
export type NotificationChannel = 'in_app' | 'email' | 'push';

// Notification category (for preferences grouping)
export type NotificationCategory =
  | 'job_status'
  | 'invitations'
  | 'connections'
  | 'system'
  | 'chat';

/**
 * Base notification structure
 */
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: NotificationData;
  read: boolean;
  readAt?: Date | string;
  createdAt: Date | string;
  expiresAt?: Date | string;
}

/**
 * Notification data payload (flexible structure)
 */
export interface NotificationData {
  jobId?: string;
  connectionId?: string;
  invitationId?: string;
  userId?: string;
  chatSessionId?: string;
  link?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

/**
 * Job notification data
 */
export interface JobNotificationData extends NotificationData {
  jobId: string;
  jobType: string;
  progress?: {
    percentage: number;
    message?: string;
  };
  result?: any;
  error?: string;
}

/**
 * Invitation notification data
 */
export interface InvitationNotificationData extends NotificationData {
  invitationId: string;
  connectionId: string;
  connectionName: string;
  inviterName: string;
  role: string;
  expiresAt: string;
}

/**
 * Create notification request
 */
export interface CreateNotificationRequest {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: NotificationData;
  expiresAt?: Date | string;
}

/**
 * Notification preference structure
 */
export interface NotificationPreference {
  id: string;
  userId: string;
  notificationType: NotificationCategory;
  channel: NotificationChannel;
  enabled: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Notification filters for listing
 */
export interface NotificationFilters {
  read?: boolean;
  type?: NotificationType | NotificationType[];
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

/**
 * Notification update request
 */
export interface UpdateNotificationRequest {
  read?: boolean;
}

/**
 * Bulk notification update
 */
export interface BulkNotificationUpdate {
  notificationIds: string[];
  read: boolean;
}

/**
 * Mark all as read request
 */
export interface MarkAllAsReadRequest {
  userId: string;
}

/**
 * Notification statistics
 */
export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<NotificationType, number>;
}

/**
 * Notification preference update request
 */
export interface UpdateNotificationPreferenceRequest {
  enabled: boolean;
}

/**
 * Notification delivery options
 */
export interface NotificationDeliveryOptions {
  channels?: NotificationChannel[];
  ignorePreferences?: boolean; // Force delivery even if disabled in preferences
  priority?: 'low' | 'normal' | 'high';
}

/**
 * Notification template data
 */
export interface NotificationTemplateData {
  type: NotificationType;
  title: string;
  message: string;
  emailSubject?: string;
  emailTemplate?: string;
}

/**
 * Helper function to map notification type to category
 */
export function getNotificationCategory(type: NotificationType): NotificationCategory {
  if (type.startsWith('job_')) return 'job_status';
  if (type.startsWith('invitation_')) return 'invitations';
  if (type.startsWith('connection_') || type.startsWith('member_') || type.startsWith('role_')) {
    return 'connections';
  }
  if (type.startsWith('chat_')) return 'chat';
  return 'system';
}

/**
 * Notification templates for common types
 */
export const NOTIFICATION_TEMPLATES: Record<NotificationType, Partial<NotificationTemplateData>> = {
  // Job notifications
  job_queued: {
    title: 'Job Queued',
    message: 'Your {jobType} job has been queued and will start shortly.',
  },
  job_started: {
    title: 'Job Started',
    message: 'Your {jobType} job has started processing.',
  },
  job_progress: {
    title: 'Job Progress',
    message: 'Your {jobType} job is {percentage}% complete.',
  },
  job_completed: {
    title: 'Job Completed',
    message: 'Your {jobType} job has completed successfully.',
  },
  job_failed: {
    title: 'Job Failed',
    message: 'Your {jobType} job has failed: {error}',
  },
  job_cancelled: {
    title: 'Job Cancelled',
    message: 'Your {jobType} job has been cancelled.',
  },

  // Invitation notifications
  invitation_received: {
    title: 'Invitation Received',
    message: '{inviterName} has invited you to access {connectionName} as {role}.',
  },
  invitation_accepted: {
    title: 'Invitation Accepted',
    message: '{userName} has accepted your invitation to {connectionName}.',
  },
  invitation_declined: {
    title: 'Invitation Declined',
    message: '{userName} has declined your invitation to {connectionName}.',
  },

  // Connection notifications
  connection_shared: {
    title: 'Connection Shared',
    message: '{connectionName} has been shared with you.',
  },
  connection_removed: {
    title: 'Access Removed',
    message: 'Your access to {connectionName} has been removed.',
  },
  member_added: {
    title: 'Member Added',
    message: '{userName} has been added to {connectionName}.',
  },
  member_removed: {
    title: 'Member Removed',
    message: '{userName} has been removed from {connectionName}.',
  },
  role_changed: {
    title: 'Role Changed',
    message: 'Your role in {connectionName} has been changed to {role}.',
  },

  // System notifications
  system: {
    title: 'System Notification',
    message: '{message}',
  },

  // Chat notifications
  chat_mention: {
    title: 'You were mentioned',
    message: '{userName} mentioned you in {chatName}.',
  },
  chat_message: {
    title: 'New Message',
    message: '{userName} sent a message in {chatName}.',
  },
};

/**
 * Helper to build notification from template
 */
export function buildNotificationFromTemplate(
  type: NotificationType,
  data: Record<string, any>
): { title: string; message: string } {
  const template = NOTIFICATION_TEMPLATES[type];
  if (!template) {
    return {
      title: 'Notification',
      message: 'You have a new notification',
    };
  }

  let title = template.title || 'Notification';
  let message = template.message || '';

  // Replace placeholders with actual data
  Object.keys(data).forEach((key) => {
    const placeholder = `{${key}}`;
    title = title.replace(placeholder, data[key]);
    message = message.replace(placeholder, data[key]);
  });

  return { title, message };
}
