/**
 * useNotifications Hook
 *
 * React hook for using the notification service with SSE.
 *
 * Usage:
 * ```typescript
 * const { isConnected, notifications } = useNotifications();
 *
 * // Or with event listener
 * useNotifications({
 *   onNotification: (notification) => {
 *     console.log('Received:', notification);
 *   },
 * });
 * ```
 */

import { useEffect, useState, useCallback } from 'react';
import { NotificationService, NotificationPayload } from '@/lib/notifications';

interface UseNotificationsOptions {
  onNotification?: (notification: NotificationPayload) => void;
  onConnected?: () => void;
  onError?: (error: Error) => void;
  autoConnect?: boolean;
}

interface UseNotificationsReturn {
  isConnected: boolean;
  notifications: NotificationPayload[];
  connect: () => void;
  disconnect: () => void;
  clearNotifications: () => void;
}

export function useNotifications(
  options: UseNotificationsOptions = {}
): UseNotificationsReturn {
  const { onNotification, onConnected, onError, autoConnect = true } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);

  const notificationService = NotificationService.getInstance();

  const connect = useCallback(() => {
    // Get token from localStorage
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        notificationService.connect(token);
      }
    }
  }, [notificationService]);

  const disconnect = useCallback(() => {
    notificationService.disconnect();
  }, [notificationService]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  useEffect(() => {
    // Update connection status
    const checkConnection = () => {
      setIsConnected(notificationService.getIsConnected());
    };

    // Set up listeners
    const unsubscribeNotification = notificationService.on('notification', (notification) => {
      setNotifications((prev) => [...prev, notification]);
      onNotification?.(notification);
    });

    const unsubscribeConnected = notificationService.onConnected(() => {
      setIsConnected(true);
      onConnected?.();
    });

    const unsubscribeError = notificationService.onError((error) => {
      setIsConnected(false);
      onError?.(error);
    });

    // Auto-connect if enabled
    if (autoConnect) {
      connect();
    }

    // Check initial connection status
    checkConnection();

    // Cleanup on unmount
    return () => {
      unsubscribeNotification();
      unsubscribeConnected();
      unsubscribeError();
    };
  }, [notificationService, onNotification, onConnected, onError, autoConnect, connect]);

  return {
    isConnected,
    notifications,
    connect,
    disconnect,
    clearNotifications,
  };
}

/**
 * useJobNotifications Hook
 *
 * Specialized hook for listening to job-related notifications.
 *
 * Usage:
 * ```typescript
 * useJobNotifications({
 *   onJobCompleted: (jobId, result) => {
 *     toast.success('Job completed!');
 *   },
 * });
 * ```
 */

interface UseJobNotificationsOptions {
  onJobQueued?: (jobId: string, jobType: string) => void;
  onJobStarted?: (jobId: string, jobType: string) => void;
  onJobProgress?: (jobId: string, jobType: string, progress: number) => void;
  onJobCompleted?: (jobId: string, jobType: string, result: any) => void;
  onJobFailed?: (jobId: string, jobType: string, error: string) => void;
}

export function useJobNotifications(options: UseJobNotificationsOptions = {}): void {
  const {
    onJobQueued,
    onJobStarted,
    onJobProgress,
    onJobCompleted,
    onJobFailed,
  } = options;

  const notificationService = NotificationService.getInstance();

  useEffect(() => {
    const unsubscribeQueued = notificationService.on('job_queued', (notification) => {
      onJobQueued?.(notification.jobId, notification.jobType);
    });

    const unsubscribeStarted = notificationService.on('job_started', (notification) => {
      onJobStarted?.(notification.jobId, notification.jobType);
    });

    const unsubscribeProgress = notificationService.on('job_progress', (notification) => {
      const progress = notification.data?.progress || 0;
      onJobProgress?.(notification.jobId, notification.jobType, progress);
    });

    const unsubscribeCompleted = notificationService.on('job_completed', (notification) => {
      const result = notification.data?.result;
      onJobCompleted?.(notification.jobId, notification.jobType, result);
    });

    const unsubscribeFailed = notificationService.on('job_failed', (notification) => {
      const error = notification.data?.error || 'Unknown error';
      onJobFailed?.(notification.jobId, notification.jobType, error);
    });

    return () => {
      unsubscribeQueued();
      unsubscribeStarted();
      unsubscribeProgress();
      unsubscribeCompleted();
      unsubscribeFailed();
    };
  }, [
    notificationService,
    onJobQueued,
    onJobStarted,
    onJobProgress,
    onJobCompleted,
    onJobFailed,
  ]);
}
