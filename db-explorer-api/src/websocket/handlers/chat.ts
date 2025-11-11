/**
 * Chat Event Handlers
 * Handles chat-related Socket.IO events
 */

import { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '../types/socket.js';
import { getChatService } from '../services/ChatService.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import type { AuthenticatedSocket } from '../middleware/auth.js';

type SocketServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

type SocketInstance = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export const registerChatHandlers = (
  io: SocketServer,
  socket: AuthenticatedSocket
) => {
  const chatService = getChatService();
  const userId = socket.data.user.userId;

  /**
   * Handle incoming chat message
   */
  socket.on('chat:message', async (data) => {
    try {
      const { messageId, content, connectionId, context } = data;

      // Process message
      const message = await chatService.processMessage(
        userId,
        messageId,
        content,
        connectionId,
        context
      );

      // Send confirmation to sender
      socket.emit('chat:message:sent', {
        messageId: message.messageId,
        timestamp: message.timestamp,
      });

      // Broadcast message to all users connected to this connection
      // In a multi-user scenario, you'd want to emit to a room
      io.to(`connection:${connectionId}`).emit('chat:message', message);

      console.log(`[Chat] Message ${messageId} sent by user ${userId} for connection ${connectionId}`);
    } catch (error: any) {
      console.error('[Chat] Error processing message:', error);
      socket.emit('chat:message:error', {
        messageId: data.messageId,
        error: error.message || 'Failed to process message',
      });
    }
  });

  /**
   * Handle message acknowledgment
   */
  socket.on('chat:ack', (data) => {
    const { messageId } = data;
    console.log(`[Chat] Message ${messageId} acknowledged by user ${userId}`);
    // Could update message status in database here
  });

  /**
   * Join connection room when user connects to a specific connection
   */
  socket.on('connection:join', async (data: { connectionId: string; newSession?: boolean }) => {
    try {
      const { connectionId, newSession = false } = data;

      // Validate connection belongs to user (check both created_by and connection_members)
      const { data: memberCheck } = await supabaseAdmin
        .from('connection_members')
        .select('connection_id')
        .eq('connection_id', connectionId)
        .eq('user_id', userId)
        .maybeSingle();

      // Also check if user is the creator
      const { data: creatorCheck } = await supabaseAdmin
        .from('database_connections')
        .select('id, created_by')
        .eq('id', connectionId)
        .eq('created_by', userId)
        .maybeSingle();

      // User must be either a member or the creator
      if (!memberCheck && !creatorCheck) {
        socket.emit('connection:status', {
          status: 'disconnected',
        });
        return;
      }

      // Clear history if this is a new session
      if (newSession) {
        chatService.clearMessageHistory(connectionId);
      }

      // Join room for this connection
      socket.join(`connection:${connectionId}`);
      socket.data.connectionId = connectionId;

      // Send message history (will be empty if newSession is true)
      const history = chatService.getMessageHistory(connectionId);
      socket.emit('chat:history', { messages: history });

      // Update presence
      const presenceService = chatService.getPresenceService();
      presenceService.updatePresence(userId, connectionId, 'online');

      console.log(`[Chat] User ${userId} joined connection ${connectionId}${newSession ? ' (new session)' : ''}`);
    } catch (error: any) {
      console.error('[Chat] Error joining connection:', error);
    }
  });

  /**
   * Leave connection room
   */
  socket.on('connection:leave', (data: { connectionId: string }) => {
    const { connectionId } = data;
    socket.leave(`connection:${connectionId}`);
    
    if (socket.data.connectionId === connectionId) {
      socket.data.connectionId = undefined;
    }

    // Update presence
    const presenceService = chatService.getPresenceService();
    presenceService.updatePresence(userId, connectionId, 'offline');

    console.log(`[Chat] User ${userId} left connection ${connectionId}`);
  });
};

