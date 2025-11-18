/**
 * Notification Service
 *
 * Industry-level notification service using Server-Sent Events (SSE).
 * This service provides real-time notifications to users about async job status.
 *
 * Features:
 * - Server-Sent Events for one-way server-to-client communication
 * - User-specific notification channels
 * - Connection management and cleanup
 * - Heartbeat mechanism to keep connections alive
 * - Automatic reconnection support
 *
 * Usage:
 * ```typescript
 * const notificationService = NotificationService.getInstance();
 * notificationService.sendNotification(userId, payload);
 * ```
 */

import { Response } from 'express';
import { NotificationPayload } from '../types/jobs.js';

/**
 * SSE client connection
 */
interface SSEClient {
  userId: string;
  response: Response;
  connectedAt: Date;
}

/**
 * NotificationService - Singleton service for managing real-time notifications
 */
export class NotificationService {
  private static instance: NotificationService;
  private clients: Map<string, SSEClient[]>;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds

  private constructor() {
    this.clients = new Map();
    this.startHeartbeat();
  }

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
   * Register a new SSE client connection
   */
  public registerClient(userId: string, response: Response): void {
    // Set SSE headers
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Enable compression
    response.flushHeaders();

    const client: SSEClient = {
      userId,
      response,
      connectedAt: new Date(),
    };

    // Add client to the map
    if (!this.clients.has(userId)) {
      this.clients.set(userId, []);
    }
    this.clients.get(userId)!.push(client);

    console.log(
      `SSE client registered for user ${userId}. Total clients: ${this.getTotalClientCount()}`
    );

    // Send initial connection event
    this.sendEvent(response, {
      event: 'connected',
      data: {
        message: 'Connected to notification service',
        timestamp: new Date().toISOString(),
      },
    });

    // Handle client disconnect
    response.on('close', () => {
      this.unregisterClient(userId, response);
    });
  }

  /**
   * Unregister a client connection
   */
  private unregisterClient(userId: string, response: Response): void {
    const userClients = this.clients.get(userId);
    if (userClients) {
      const index = userClients.findIndex((client) => client.response === response);
      if (index !== -1) {
        userClients.splice(index, 1);
      }

      // Remove user entry if no more clients
      if (userClients.length === 0) {
        this.clients.delete(userId);
      }
    }

    console.log(
      `SSE client disconnected for user ${userId}. Total clients: ${this.getTotalClientCount()}`
    );
  }

  /**
   * Send notification to a specific user
   */
  public async sendNotification(
    userId: string,
    payload: NotificationPayload
  ): Promise<void> {
    const userClients = this.clients.get(userId);

    if (!userClients || userClients.length === 0) {
      console.log(`No active SSE clients for user ${userId}. Notification not sent.`);
      return;
    }

    console.log(`Sending notification to user ${userId}: ${payload.eventType}`);

    const deadClients: Response[] = [];

    for (const client of userClients) {
      try {
        this.sendEvent(client.response, {
          event: 'notification',
          data: payload,
        });
      } catch (error) {
        console.error(`Error sending notification to user ${userId}:`, error);
        deadClients.push(client.response);
      }
    }

    // Clean up dead clients
    for (const deadClient of deadClients) {
      this.unregisterClient(userId, deadClient);
    }
  }

  /**
   * Broadcast notification to all connected clients
   */
  public async broadcastNotification(payload: NotificationPayload): Promise<void> {
    console.log(`Broadcasting notification to all clients: ${payload.eventType}`);

    for (const [userId, userClients] of this.clients) {
      const deadClients: Response[] = [];

      for (const client of userClients) {
        try {
          this.sendEvent(client.response, {
            event: 'notification',
            data: payload,
          });
        } catch (error) {
          console.error(`Error broadcasting to user ${userId}:`, error);
          deadClients.push(client.response);
        }
      }

      // Clean up dead clients
      for (const deadClient of deadClients) {
        this.unregisterClient(userId, deadClient);
      }
    }
  }

  /**
   * Send an SSE event
   */
  private sendEvent(
    response: Response,
    event: { event: string; data: any; id?: string; retry?: number }
  ): void {
    if (response.writableEnded) {
      throw new Error('Response already ended');
    }

    // Format SSE message
    let message = '';

    if (event.id) {
      message += `id: ${event.id}\n`;
    }

    if (event.event) {
      message += `event: ${event.event}\n`;
    }

    if (event.retry) {
      message += `retry: ${event.retry}\n`;
    }

    // Data field (must be last)
    const dataString =
      typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
    message += `data: ${dataString}\n\n`;

    response.write(message);
  }

  /**
   * Start heartbeat to keep connections alive
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      return;
    }

    this.heartbeatInterval = setInterval(() => {
      const deadClients: Array<{ userId: string; response: Response }> = [];

      for (const [userId, userClients] of this.clients) {
        for (const client of userClients) {
          try {
            this.sendEvent(client.response, {
              event: 'heartbeat',
              data: { timestamp: new Date().toISOString() },
            });
          } catch (error) {
            console.error(`Heartbeat failed for user ${userId}:`, error);
            deadClients.push({ userId, response: client.response });
          }
        }
      }

      // Clean up dead clients
      for (const { userId, response } of deadClients) {
        this.unregisterClient(userId, response);
      }
    }, this.HEARTBEAT_INTERVAL);

    console.log('SSE heartbeat started');
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('SSE heartbeat stopped');
    }
  }

  /**
   * Get total number of connected clients
   */
  private getTotalClientCount(): number {
    let count = 0;
    for (const clients of this.clients.values()) {
      count += clients.length;
    }
    return count;
  }

  /**
   * Get number of clients for a specific user
   */
  public getUserClientCount(userId: string): number {
    return this.clients.get(userId)?.length || 0;
  }

  /**
   * Get all connected user IDs
   */
  public getConnectedUserIds(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Close all connections for a user
   */
  public closeUserConnections(userId: string): void {
    const userClients = this.clients.get(userId);
    if (userClients) {
      for (const client of userClients) {
        try {
          this.sendEvent(client.response, {
            event: 'close',
            data: { message: 'Connection closed by server' },
          });
          client.response.end();
        } catch (error) {
          console.error(`Error closing connection for user ${userId}:`, error);
        }
      }
      this.clients.delete(userId);
    }
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    console.log('Shutting down NotificationService...');

    this.stopHeartbeat();

    // Close all client connections
    for (const [userId, userClients] of this.clients) {
      for (const client of userClients) {
        try {
          this.sendEvent(client.response, {
            event: 'close',
            data: { message: 'Server shutting down' },
          });
          client.response.end();
        } catch (error) {
          console.error(`Error closing connection for user ${userId}:`, error);
        }
      }
    }

    this.clients.clear();
    console.log('NotificationService shut down successfully');
  }
}

export default NotificationService;
