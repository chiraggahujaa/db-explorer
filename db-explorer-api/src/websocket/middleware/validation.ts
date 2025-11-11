/**
 * WebSocket Message Validation Middleware
 * Validates message content and structure
 */

import { Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';
import type { AuthenticatedSocket } from './auth.js';
import type { ChatMessage } from '../types/socket.js';

const MAX_MESSAGE_LENGTH = 10000;
const MIN_MESSAGE_LENGTH = 1;

/**
 * Sanitize message content to prevent XSS
 */
function sanitizeMessage(content: string): string {
  return content
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}

/**
 * Validate message payload
 */
export const validateMessage = (
  socket: AuthenticatedSocket,
  next: (err?: ExtendedError) => void
) => {
  socket.on('chat:message', (data: any) => {
    // Validate required fields
    if (!data.messageId || typeof data.messageId !== 'string') {
      return socket.emit('chat:message:error', {
        messageId: data.messageId || 'unknown',
        error: 'Invalid messageId',
      });
    }

    if (!data.content || typeof data.content !== 'string') {
      return socket.emit('chat:message:error', {
        messageId: data.messageId,
        error: 'Message content is required',
      });
    }

    if (!data.connectionId || typeof data.connectionId !== 'string') {
      return socket.emit('chat:message:error', {
        messageId: data.messageId,
        error: 'Connection ID is required',
      });
    }

    // Validate length
    if (data.content.length < MIN_MESSAGE_LENGTH) {
      return socket.emit('chat:message:error', {
        messageId: data.messageId,
        error: 'Message is too short',
      });
    }

    if (data.content.length > MAX_MESSAGE_LENGTH) {
      return socket.emit('chat:message:error', {
        messageId: data.messageId,
        error: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`,
      });
    }

    // Sanitize content
    data.content = sanitizeMessage(data.content);

    // Validate context if provided
    if (data.context) {
      if (data.context.schema && typeof data.context.schema !== 'string') {
        return socket.emit('chat:message:error', {
          messageId: data.messageId,
          error: 'Invalid schema in context',
        });
      }

      if (data.context.tables && !Array.isArray(data.context.tables)) {
        return socket.emit('chat:message:error', {
          messageId: data.messageId,
          error: 'Invalid tables in context',
        });
      }
    }

    // Continue to handler
    next();
  });
};

/**
 * Validate typing event payload
 */
export const validateTyping = (
  socket: AuthenticatedSocket,
  next: (err?: ExtendedError) => void
) => {
  socket.on('chat:typing:start', (data: any) => {
    if (!data.connectionId || typeof data.connectionId !== 'string') {
      return; // Silently ignore invalid typing events
    }
    next();
  });

  socket.on('chat:typing:stop', (data: any) => {
    if (!data.connectionId || typeof data.connectionId !== 'string') {
      return; // Silently ignore invalid typing events
    }
    next();
  });
};

/**
 * Validate presence update payload
 */
export const validatePresence = (
  socket: AuthenticatedSocket,
  next: (err?: ExtendedError) => void
) => {
  socket.on('presence:update', (data: any) => {
    if (!data.connectionId || typeof data.connectionId !== 'string') {
      return; // Silently ignore invalid presence updates
    }

    if (!['online', 'away', 'offline'].includes(data.status)) {
      return; // Silently ignore invalid status
    }

    next();
  });
};

