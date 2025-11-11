/**
 * Presence Event Handlers
 * Handles user presence status events
 */

import { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '../types/socket.js';
import { getChatService } from '../services/ChatService.js';
import type { AuthenticatedSocket } from '../middleware/auth.js';

type SocketServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export const registerPresenceHandlers = (
  io: SocketServer,
  socket: AuthenticatedSocket
) => {
  const chatService = getChatService();
  const presenceService = chatService.getPresenceService();
  const userId = socket.data.user.userId;

  /**
   * Handle presence update
   */
  socket.on('presence:update', (data) => {
    const { status, connectionId } = data;

    // Update presence
    const presence = presenceService.updatePresence(userId, connectionId, status);

    // Broadcast to others in the connection room
    socket.to(`connection:${connectionId}`).emit('presence:update', presence);

    console.log(`[Presence] User ${userId} status updated to ${status} for connection ${connectionId}`);
  });

  /**
   * Handle disconnect - mark as offline
   */
  socket.on('disconnect', () => {
    if (socket.data.connectionId) {
      const connectionId = socket.data.connectionId;
      presenceService.updatePresence(userId, connectionId, 'offline');

      // Broadcast to others
      const presenceUpdate = {
        userId,
        connectionId,
        status: 'offline' as const,
        lastSeen: Date.now(),
      };
      socket.to(`connection:${connectionId}`).emit('presence:update', presenceUpdate);

      console.log(`[Presence] User ${userId} disconnected from connection ${connectionId}`);
    }
  });
};

