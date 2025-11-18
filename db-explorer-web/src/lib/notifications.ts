/**
 * Notification Service - SSE Client
 *
 * This service connects to the backend SSE endpoint to receive real-time
 * notifications about async job status updates.
 *
 * Usage:
 * ```typescript
 * const notificationService = NotificationService.getInstance();
 * notificationService.connect(token);
 *
 * notificationService.on('notification', (notification) => {
 *   console.log('Received notification:', notification);
 * });
 * ```
 */

export interface NotificationPayload {
  eventType: string;
  jobId: string;
  jobType: string;
  userId: string;
  data?: any;
  timestamp: string;
}

type NotificationCallback = (notification: NotificationPayload) => void;
type ConnectedCallback = () => void;
type ErrorCallback = (error: Error) => void;

export class NotificationService {
  private static instance: NotificationService;
  private eventSource: EventSource | null = null;
  private listeners: Map<string, Set<NotificationCallback>> = new Map();
  private connectedListeners: Set<ConnectedCallback> = new Set();
  private errorListeners: Set<ErrorCallback> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private isConnected = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Connect to SSE endpoint
   */
  public connect(token: string): void {
    if (this.eventSource) {
      console.log('Already connected to notification service');
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const url = `${apiUrl}/api/jobs/notifications/stream`;

    console.log('Connecting to notification service...');

    // Create EventSource with auth token
    this.eventSource = new EventSource(url, {
      withCredentials: true,
    });

    // Handle connection open
    this.eventSource.onopen = () => {
      console.log('Connected to notification service');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;

      // Notify connected listeners
      for (const callback of this.connectedListeners) {
        callback();
      }
    };

    // Handle incoming notifications
    this.eventSource.addEventListener('notification', (event: MessageEvent) => {
      try {
        const notification: NotificationPayload = JSON.parse(event.data);
        console.log('Received notification:', notification);

        // Emit to listeners
        this.emit('notification', notification);

        // Emit to event-specific listeners
        this.emit(notification.eventType, notification);
      } catch (error) {
        console.error('Error parsing notification:', error);
      }
    });

    // Handle connection established
    this.eventSource.addEventListener('connected', (event: MessageEvent) => {
      console.log('SSE connection established:', event.data);
    });

    // Handle heartbeat
    this.eventSource.addEventListener('heartbeat', () => {
      // Silent heartbeat
    });

    // Handle connection close
    this.eventSource.addEventListener('close', () => {
      console.log('Server closed connection');
      this.handleDisconnect();
    });

    // Handle errors
    this.eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      this.isConnected = false;

      // Notify error listeners
      const errorObj = new Error('SSE connection error');
      for (const callback of this.errorListeners) {
        callback(errorObj);
      }

      // Attempt to reconnect
      this.handleReconnect();
    };
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect(): void {
    this.isConnected = false;
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  /**
   * Handle reconnection logic
   */
  private handleReconnect(): void {
    this.handleDisconnect();

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(
      `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
    );

    setTimeout(() => {
      // Get token from localStorage or cookie
      const token = this.getStoredToken();
      if (token) {
        this.connect(token);
      }
    }, delay);
  }

  /**
   * Get stored authentication token
   */
  private getStoredToken(): string | null {
    // Try to get token from localStorage
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token');
    }
    return null;
  }

  /**
   * Disconnect from SSE endpoint
   */
  public disconnect(): void {
    console.log('Disconnecting from notification service...');
    this.handleDisconnect();
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection
  }

  /**
   * Register event listener
   */
  public on(event: string, callback: NotificationCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.off(event, callback);
    };
  }

  /**
   * Register connected event listener
   */
  public onConnected(callback: ConnectedCallback): () => void {
    this.connectedListeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.connectedListeners.delete(callback);
    };
  }

  /**
   * Register error event listener
   */
  public onError(callback: ErrorCallback): () => void {
    this.errorListeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.errorListeners.delete(callback);
    };
  }

  /**
   * Unregister event listener
   */
  public off(event: string, callback: NotificationCallback): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, notification: NotificationPayload): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const callback of listeners) {
        try {
          callback(notification);
        } catch (error) {
          console.error(`Error in notification listener for ${event}:`, error);
        }
      }
    }
  }

  /**
   * Check if connected
   */
  public getIsConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Remove all listeners
   */
  public removeAllListeners(): void {
    this.listeners.clear();
    this.connectedListeners.clear();
    this.errorListeners.clear();
  }
}

export default NotificationService;
