/**
 * WebSocket Service
 *
 * Manages real-time communication with clients using Socket.IO
 * Handles user authentication, room management, and event broadcasting
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import http from 'http';
import { supabaseAdmin } from '../utils/database.js';
import { JobEventPayload } from '../types/job.js';
import { Notification } from '../types/notification.js';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userEmail?: string;
}

export class WebSocketService {
  private static instance: WebSocketService;
  private io: SocketIOServer | null = null;
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds
  private isInitialized = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  /**
   * Initialize Socket.IO server
   */
  initialize(server: http.Server): void {
    if (this.isInitialized) {
      console.log('WebSocket service already initialized');
      return;
    }

    try {
      const allowedOrigins = (process.env.WEBSOCKET_CORS_ORIGIN || process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
        .split(',')
        .map((origin) => origin.trim());

      this.io = new SocketIOServer(server, {
        cors: {
          origin: allowedOrigins,
          methods: ['GET', 'POST'],
          credentials: true,
        },
        pingInterval: parseInt(process.env.WEBSOCKET_PING_INTERVAL || '25000', 10), // 25 seconds
        pingTimeout: parseInt(process.env.WEBSOCKET_PING_TIMEOUT || '60000', 10), // 60 seconds
        transports: ['websocket', 'polling'], // WebSocket with polling fallback
      });

      // Set up connection handler
      this.io.on('connection', (socket: AuthenticatedSocket) => {
        this.handleConnection(socket);
      });

      this.isInitialized = true;
      console.log('WebSocket service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize WebSocket service:', error);
      throw error;
    }
  }

  /**
   * Handle new client connection
   */
  private handleConnection(socket: AuthenticatedSocket): void {
    console.log(`Client connected: ${socket.id}`);

    // Handle authentication
    socket.on('authenticate', async (data: { token: string }) => {
      try {
        const user = await this.authenticateSocket(socket, data.token);
        if (user) {
          socket.userId = user.id;
          socket.userEmail = user.email;

          // Track user's socket
          this.addUserSocket(user.id, socket.id);

          // Join user-specific room
          socket.join(`user:${user.id}`);

          // Send authentication success
          socket.emit('authenticated', {
            userId: user.id,
            email: user.email,
          });

          console.log(`User authenticated: ${user.email} (${socket.id})`);
        } else {
          socket.emit('auth_error', { message: 'Authentication failed' });
        }
      } catch (error: any) {
        console.error('Authentication error:', error);
        socket.emit('auth_error', { message: error.message || 'Authentication failed' });
      }
    });

    // Handle job subscription
    socket.on('subscribe:job', (data: { jobId: string }) => {
      if (!socket.userId) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      socket.join(`job:${data.jobId}`);
      console.log(`User ${socket.userId} subscribed to job ${data.jobId}`);
    });

    // Handle job unsubscription
    socket.on('unsubscribe:job', (data: { jobId: string }) => {
      socket.leave(`job:${data.jobId}`);
      console.log(`User ${socket.userId} unsubscribed from job ${data.jobId}`);
    });

    // Handle notification subscription (user-specific room, auto-joined on auth)
    socket.on('subscribe:notifications', () => {
      if (!socket.userId) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      // Already joined in authentication, just confirm
      socket.emit('notifications:subscribed', { userId: socket.userId });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);

      if (socket.userId) {
        this.removeUserSocket(socket.userId, socket.id);
      }
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  /**
   * Authenticate socket connection using JWT token
   */
  private async authenticateSocket(
    socket: AuthenticatedSocket,
    token: string
  ): Promise<{ id: string; email: string } | null> {
    try {
      // Verify JWT token using Supabase
      const {
        data: { user },
        error,
      } = await supabaseAdmin.auth.getUser(token);

      if (error || !user) {
        console.error('Token verification failed:', error);
        return null;
      }

      return {
        id: user.id,
        email: user.email || '',
      };
    } catch (error) {
      console.error('Error authenticating socket:', error);
      return null;
    }
  }

  /**
   * Track user's socket connection
   */
  private addUserSocket(userId: string, socketId: string): void {
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socketId);
  }

  /**
   * Remove user's socket connection
   */
  private removeUserSocket(userId: string, socketId: string): void {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
      }
    }
  }

  /**
   * Send notification to specific user
   */
  sendToUser(userId: string, event: string, data: any): void {
    if (!this.io) {
      console.warn('WebSocket service not initialized');
      return;
    }

    this.io.to(`user:${userId}`).emit(event, data);
    console.log(`Sent ${event} to user ${userId}`);
  }

  /**
   * Send job status update
   */
  sendJobUpdate(jobEvent: JobEventPayload): void {
    if (!this.io) {
      console.warn('WebSocket service not initialized');
      return;
    }

    const { jobId, userId, event, progress, result, error } = jobEvent;

    // Send to job room (for users subscribed to this specific job)
    this.io.to(`job:${jobId}`).emit('job:status', {
      jobId,
      event,
      progress,
      result,
      error,
      timestamp: jobEvent.timestamp,
    });

    // Also send to user room (for user's general job updates)
    this.sendToUser(userId, 'job:update', {
      jobId,
      event,
      progress,
      result,
      error,
      timestamp: jobEvent.timestamp,
    });

    console.log(`Sent job update: ${jobId} (${event})`);
  }

  /**
   * Send notification to user
   */
  sendNotification(userId: string, notification: Notification): void {
    if (!this.io) {
      console.warn('WebSocket service not initialized');
      return;
    }

    this.sendToUser(userId, 'notification', notification);
  }

  /**
   * Broadcast event to all connected clients
   */
  broadcast(event: string, data: any): void {
    if (!this.io) {
      console.warn('WebSocket service not initialized');
      return;
    }

    this.io.emit(event, data);
    console.log(`Broadcasted ${event} to all clients`);
  }

  /**
   * Broadcast to all users in a specific room
   */
  broadcastToRoom(room: string, event: string, data: any): void {
    if (!this.io) {
      console.warn('WebSocket service not initialized');
      return;
    }

    this.io.to(room).emit(event, data);
    console.log(`Broadcasted ${event} to room ${room}`);
  }

  /**
   * Get number of connected clients
   */
  async getConnectedClientsCount(): Promise<number> {
    if (!this.io) {
      return 0;
    }

    const sockets = await this.io.fetchSockets();
    return sockets.length;
  }

  /**
   * Get number of unique connected users
   */
  getConnectedUsersCount(): number {
    return this.userSockets.size;
  }

  /**
   * Check if user is connected
   */
  isUserConnected(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
  }

  /**
   * Get user's active socket count
   */
  getUserSocketCount(userId: string): number {
    return this.userSockets.get(userId)?.size || 0;
  }

  /**
   * Disconnect user's sockets
   */
  async disconnectUser(userId: string): Promise<void> {
    if (!this.io) {
      return;
    }

    const socketIds = this.userSockets.get(userId);
    if (socketIds) {
      const sockets = await this.io.fetchSockets();
      sockets.forEach((socket) => {
        if (socketIds.has(socket.id)) {
          socket.disconnect(true);
        }
      });

      this.userSockets.delete(userId);
      console.log(`Disconnected user: ${userId}`);
    }
  }

  /**
   * Close WebSocket server
   */
  async close(): Promise<void> {
    if (this.io) {
      console.log('Closing WebSocket connections...');

      // Disconnect all clients
      const sockets = await this.io.fetchSockets();
      sockets.forEach((socket) => socket.disconnect(true));

      // Close server
      this.io.close();
      this.io = null;
      this.isInitialized = false;
      this.userSockets.clear();

      console.log('WebSocket service closed');
    }
  }

  /**
   * Get WebSocket server stats
   */
  async getStats(): Promise<{
    connectedClients: number;
    connectedUsers: number;
    rooms: string[];
  }> {
    const connectedClients = await this.getConnectedClientsCount();
    const connectedUsers = this.getConnectedUsersCount();

    let rooms: string[] = [];
    if (this.io) {
      const socketsMap = this.io.sockets.adapter.rooms;
      rooms = Array.from(socketsMap.keys()).filter((room) => {
        // Filter out socket IDs (they're also in rooms map)
        return room.startsWith('user:') || room.startsWith('job:');
      });
    }

    return {
      connectedClients,
      connectedUsers,
      rooms,
    };
  }
}

// Export singleton instance
export const webSocketService = WebSocketService.getInstance();
