/**
 * WebSocket Server Setup
 * Initializes Socket.IO server with authentication, middleware, and handlers
 */

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from './types/socket.js';
import { authenticateSocket } from './middleware/auth.js';
import { rateLimitMessages, rateLimitTyping } from './middleware/rateLimit.js';
import { registerChatHandlers } from './handlers/chat.js';
import { registerTypingHandlers } from './handlers/typing.js';
import { registerPresenceHandlers } from './handlers/presence.js';
import { getFrontendUrl } from '../utils/environment.js';
import type { AuthenticatedSocket } from './middleware/auth.js';

type SocketServer = SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

let io: SocketServer | null = null;

/**
 * Initialize WebSocket server
 */
export const initializeWebSocket = (httpServer: HTTPServer): SocketServer => {
  if (io) {
    return io;
  }

  const frontendUrl = getFrontendUrl();
  const isProduction = process.env.NODE_ENV === 'production';

  io = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: isProduction
        ? [frontendUrl, process.env.RAILWAY_PUBLIC_DOMAIN].filter((url): url is string => Boolean(url))
        : ['http://localhost:3000', 'http://localhost:3001'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication middleware
  io.use(authenticateSocket);

  // Connection handler
  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.data.user.userId;
    console.log(`[WebSocket] User ${userId} connected (socket: ${socket.id})`);

    // Send connection status
    socket.emit('connection:status', {
      status: 'connected',
    });

    // Register event handlers
    registerChatHandlers(io!, socket);
    registerTypingHandlers(io!, socket);
    registerPresenceHandlers(io!, socket);

    // Apply rate limiting to specific events
    socket.use((event, next) => {
      if (event[0] === 'chat:message') {
        rateLimitMessages(socket, next);
      } else if (event[0] === 'chat:typing:start' || event[0] === 'chat:typing:stop') {
        rateLimitTyping(socket, next);
      } else {
        next();
      }
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      console.log(`[WebSocket] User ${userId} disconnected: ${reason}`);
      socket.emit('connection:status', {
        status: 'disconnected',
      });
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`[WebSocket] Error for user ${userId}:`, error);
    });
  });

  console.log('✅ WebSocket server initialized');
  return io;
};

/**
 * Get WebSocket server instance
 */
export const getWebSocketServer = (): SocketServer | null => {
  return io;
};

/**
 * Gracefully shutdown WebSocket server
 */
export const shutdownWebSocket = () => {
  if (io) {
    io.close(() => {
      console.log('✅ WebSocket server closed');
    });
    io = null;
  }
};

