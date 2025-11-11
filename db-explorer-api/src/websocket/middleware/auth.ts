/**
 * WebSocket Authentication Middleware
 * Validates JWT tokens for Socket.IO connections
 */

import { Socket } from 'socket.io';
import { supabaseAdmin } from '../../lib/supabase.js';
import { ExtendedError } from 'socket.io/dist/namespace';
import type { SocketData } from '../types/socket.js';

export interface AuthenticatedSocket extends Socket {
  data: SocketData;
}

/**
 * Authenticate WebSocket connection using JWT token
 * Token can be provided via:
 * 1. auth.token in handshake auth object
 * 2. token query parameter
 */
export const authenticateSocket = async (
  socket: Socket,
  next: (err?: ExtendedError) => void
) => {
  try {
    // Extract token from handshake auth or query
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token ||
      (socket.handshake.headers.authorization?.startsWith('Bearer ')
        ? socket.handshake.headers.authorization.split(' ')[1]
        : null);

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    // Verify token with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return next(new Error('Invalid or expired token'));
    }

    // Attach user data to socket
    socket.data = {
      user: {
        userId: user.id,
        email: user.email,
        socketId: socket.id,
        connectedAt: Date.now(),
      },
      authenticated: true,
    };

    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication failed'));
  }
};

