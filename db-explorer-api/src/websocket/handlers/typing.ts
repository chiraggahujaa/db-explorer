/**
 * Typing Indicator Handlers
 * Handles typing indicator events
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

// Store typing timeouts to automatically stop typing indicators
const typingTimeouts = new Map<string, NodeJS.Timeout>();

export const registerTypingHandlers = (
  io: SocketServer,
  socket: AuthenticatedSocket
) => {
  const chatService = getChatService();
  const userId = socket.data.user.userId;

  /**
   * Handle typing start
   */
  socket.on('chat:typing:start', (data) => {
    const { connectionId } = data;

    // Clear existing timeout
    const timeoutKey = `${userId}:${connectionId}`;
    const existingTimeout = typingTimeouts.get(timeoutKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Create typing indicator
    const typingIndicator = chatService.createTypingIndicator(
      userId,
      connectionId,
      true
    );

    // Broadcast to others in the connection room (excluding sender)
    socket.to(`connection:${connectionId}`).emit('chat:typing', typingIndicator);

    // Auto-stop typing after 3 seconds if no stop event received
    const timeout = setTimeout(() => {
      typingTimeouts.delete(timeoutKey);
      const stopIndicator = chatService.createTypingIndicator(
        userId,
        connectionId,
        false
      );
      socket.to(`connection:${connectionId}`).emit('chat:typing', stopIndicator);
    }, 3000);

    typingTimeouts.set(timeoutKey, timeout);
  });

  /**
   * Handle typing stop
   */
  socket.on('chat:typing:stop', (data) => {
    const { connectionId } = data;

    // Clear timeout
    const timeoutKey = `${userId}:${connectionId}`;
    const existingTimeout = typingTimeouts.get(timeoutKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      typingTimeouts.delete(timeoutKey);
    }

    // Create stop typing indicator
    const typingIndicator = chatService.createTypingIndicator(
      userId,
      connectionId,
      false
    );

    // Broadcast to others in the connection room
    socket.to(`connection:${connectionId}`).emit('chat:typing', typingIndicator);
  });

  /**
   * Clean up timeouts on disconnect
   */
  socket.on('disconnect', () => {
    // Clear all timeouts for this user
    const keysToDelete: string[] = [];
    typingTimeouts.forEach((timeout, key) => {
      if (key.startsWith(`${userId}:`)) {
        clearTimeout(timeout);
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => typingTimeouts.delete(key));
  });
};

