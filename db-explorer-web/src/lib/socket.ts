/**
 * WebSocket Service
 *
 * Manages Socket.IO client connection for real-time updates
 * Handles job notifications, progress updates, and system events
 */

import { io, Socket } from 'socket.io-client';

export interface JobEventPayload {
  jobId: string;
  type: string;
  event: 'created' | 'started' | 'progress' | 'completed' | 'failed' | 'cancelled';
  userId: string;
  progress?: {
    current: number;
    total: number;
    percentage: number;
    message?: string;
  };
  result?: any;
  error?: string;
  timestamp: Date;
}

export type JobEventHandler = (payload: JobEventPayload) => void;

class WebSocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private eventHandlers: Map<string, Set<Function>> = new Map();

  /**
   * Initialize WebSocket connection
   */
  connect(token?: string): void {
    if (this.socket && this.isConnected) {
      console.log('WebSocket already connected');
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    this.socket = io(apiUrl, {
      auth: {
        token: token || this.getStoredToken(),
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.setupEventListeners();
  }

  /**
   * Setup Socket.IO event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('WebSocket connected:', this.socket?.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connect', {});
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('WebSocket disconnected:', reason);
      this.isConnected = false;
      this.emit('disconnect', { reason });
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('WebSocket connection error:', error);
      this.reconnectAttempts++;
      this.emit('error', { error: error.message });

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        this.disconnect();
      }
    });

    // Job-related events
    this.socket.on('job:created', (payload: JobEventPayload) => {
      console.log('Job created:', payload);
      this.emit('job:created', payload);
      this.emit('job:event', payload);
    });

    this.socket.on('job:started', (payload: JobEventPayload) => {
      console.log('Job started:', payload);
      this.emit('job:started', payload);
      this.emit('job:event', payload);
    });

    this.socket.on('job:progress', (payload: JobEventPayload) => {
      console.log('Job progress:', payload);
      this.emit('job:progress', payload);
      this.emit('job:event', payload);
    });

    this.socket.on('job:completed', (payload: JobEventPayload) => {
      console.log('Job completed:', payload);
      this.emit('job:completed', payload);
      this.emit('job:event', payload);
    });

    this.socket.on('job:failed', (payload: JobEventPayload) => {
      console.log('Job failed:', payload);
      this.emit('job:failed', payload);
      this.emit('job:event', payload);
    });

    this.socket.on('job:cancelled', (payload: JobEventPayload) => {
      console.log('Job cancelled:', payload);
      this.emit('job:cancelled', payload);
      this.emit('job:event', payload);
    });

    // Notification events
    this.socket.on('notification', (notification: any) => {
      console.log('Notification received:', notification);
      this.emit('notification', notification);
    });
  }

  /**
   * Subscribe to a specific job
   */
  subscribeToJob(jobId: string): void {
    if (!this.socket || !this.isConnected) {
      console.warn('Cannot subscribe to job: WebSocket not connected');
      return;
    }

    this.socket.emit('subscribe:job', { jobId });
    console.log('Subscribed to job:', jobId);
  }

  /**
   * Unsubscribe from a specific job
   */
  unsubscribeFromJob(jobId: string): void {
    if (!this.socket || !this.isConnected) {
      return;
    }

    this.socket.emit('unsubscribe:job', { jobId });
    console.log('Unsubscribed from job:', jobId);
  }

  /**
   * Register event handler
   */
  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Unregister event handler
   */
  off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Emit event to registered handlers
   */
  private emit(event: string, payload: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(payload);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      console.log('WebSocket disconnected');
    }
  }

  /**
   * Check if connected
   */
  connected(): boolean {
    return this.isConnected && this.socket !== null;
  }

  /**
   * Get stored JWT token from localStorage
   */
  private getStoredToken(): string | undefined {
    if (typeof window === 'undefined') return undefined;
    return localStorage.getItem('token') || undefined;
  }
}

// Export singleton instance
export const socketService = new WebSocketService();
