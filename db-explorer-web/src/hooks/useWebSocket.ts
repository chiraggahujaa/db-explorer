/**
 * useWebSocket Hook
 * React hook for WebSocket connection management
 */

import { useEffect, useCallback, useRef } from 'react';
import { getWebSocketService } from '@/lib/websocket/service';
import { useChatStore } from '@/stores/useChatStore';
import type {
  ChatMessage,
  TypingIndicator,
  PresenceStatus,
  ConnectionStatusUpdate,
} from '@/lib/websocket/types';
import { v4 as uuidv4 } from 'uuid';

interface UseWebSocketOptions {
  connectionId: string | null;
  autoConnect?: boolean;
}

export const useWebSocket = (options: UseWebSocketOptions) => {
  const { connectionId, autoConnect = true } = options;
  const wsService = getWebSocketService();
  const {
    setConnectionStatus,
    addMessage,
    updateMessage,
    setPending,
    setTyping,
    setPresence,
    setCurrentConnection,
    loadHistory,
  } = useChatStore();

  const connectionIdRef = useRef<string | null>(null);

  // Handle connection status updates
  useEffect(() => {
    const handleStatusUpdate = (data: ConnectionStatusUpdate) => {
      setConnectionStatus(data.status, data.reconnectAttempts);
    };

    wsService.on('connection:status', handleStatusUpdate);

    return () => {
      wsService.off('connection:status', handleStatusUpdate);
    };
  }, [wsService, setConnectionStatus]);

  // Handle incoming messages
  useEffect(() => {
    const handleMessage = (message: ChatMessage) => {
      addMessage(message);
      // Acknowledge receipt
      wsService.emit('chat:ack', { messageId: message.messageId });
    };

    const handleMessageSent = (data: { messageId: string; timestamp: number }) => {
      updateMessage(data.messageId, { status: 'sent', timestamp: data.timestamp });
      setPending(data.messageId, false);
    };

    const handleMessageError = (data: { messageId: string; error: string }) => {
      updateMessage(data.messageId, { status: 'error', error: data.error });
      setPending(data.messageId, false);
    };

    const handleHistory = (data: { messages: ChatMessage[] }) => {
      loadHistory(data.messages);
    };

    wsService.on('chat:message', handleMessage);
    wsService.on('chat:message:sent', handleMessageSent);
    wsService.on('chat:message:error', handleMessageError);
    wsService.on('chat:history', handleHistory);

    return () => {
      wsService.off('chat:message', handleMessage);
      wsService.off('chat:message:sent', handleMessageSent);
      wsService.off('chat:message:error', handleMessageError);
      wsService.off('chat:history', handleHistory);
    };
  }, [wsService, addMessage, updateMessage, setPending, loadHistory]);

  // Handle typing indicators
  useEffect(() => {
    const handleTyping = (data: TypingIndicator) => {
      if (data.connectionId === connectionId) {
        setTyping(data.connectionId, data.userId, data.isTyping);
      }
    };

    wsService.on('chat:typing', handleTyping);

    return () => {
      wsService.off('chat:typing', handleTyping);
    };
  }, [wsService, connectionId, setTyping]);

  // Handle presence updates
  useEffect(() => {
    const handlePresence = (data: PresenceStatus) => {
      if (data.connectionId === connectionId) {
        setPresence(data.userId, data.connectionId, data.status);
      }
    };

    wsService.on('presence:update', handlePresence);

    return () => {
      wsService.off('presence:update', handlePresence);
    };
  }, [wsService, connectionId, setPresence]);

  // Connect/disconnect and join/leave rooms
  useEffect(() => {
    if (!autoConnect) return;

    // Connect if not already connected
    if (!wsService.isSocketConnected()) {
      wsService.connect();
    }

    // Join connection room when connectionId changes
    if (connectionId && connectionId !== connectionIdRef.current) {
      // Leave previous connection
      if (connectionIdRef.current) {
        wsService.emit('connection:leave', { connectionId: connectionIdRef.current });
      }

      // Join new connection
      wsService.emit('connection:join', { connectionId });
      setCurrentConnection(connectionId);
      connectionIdRef.current = connectionId;
    }

    // Cleanup: leave room on unmount or connectionId change
    return () => {
      if (connectionIdRef.current) {
        wsService.emit('connection:leave', { connectionId: connectionIdRef.current });
        connectionIdRef.current = null;
      }
    };
  }, [connectionId, autoConnect, wsService, setCurrentConnection]);

  // Send message
  const sendMessage = useCallback(
    (
      content: string,
      context?: ChatMessage['context']
    ): Promise<string> => {
      return new Promise((resolve, reject) => {
        if (!connectionId) {
          reject(new Error('No connection selected'));
          return;
        }

        if (!wsService.isSocketConnected()) {
          reject(new Error('WebSocket not connected'));
          return;
        }

        const messageId = uuidv4();
        const tempMessage: ChatMessage = {
          messageId,
          userId: '', // Will be set by server
          connectionId,
          content,
          context,
          timestamp: Date.now(),
          status: 'pending',
        };

        // Add optimistic message
        addMessage(tempMessage);
        setPending(messageId, true);

        // Send to server
        wsService.emit('chat:message', {
          messageId,
          content,
          connectionId,
          context,
        });

        resolve(messageId);
      });
    },
    [connectionId, wsService, addMessage, setPending]
  );

  // Send typing indicator
  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!connectionId || !wsService.isSocketConnected()) return;

      if (isTyping) {
        wsService.emit('chat:typing:start', { connectionId });
      } else {
        wsService.emit('chat:typing:stop', { connectionId });
      }
    },
    [connectionId, wsService]
  );

  // Update presence
  const updatePresence = useCallback(
    (status: PresenceStatus['status']) => {
      if (!connectionId || !wsService.isSocketConnected()) return;
      wsService.emit('presence:update', { status, connectionId });
    },
    [connectionId, wsService]
  );

  // Retry failed message
  const retryMessage = useCallback(
    (messageId: string) => {
      const message = useChatStore.getState().messages.get(messageId);
      if (!message) return;

      setPending(messageId, true);
      wsService.emit('chat:message', {
        messageId,
        content: message.content,
        connectionId: message.connectionId,
        context: message.context,
      });
    },
    [wsService, setPending]
  );

  // Reset chat session - creates a new chat by leaving and rejoining the room
  const resetChat = useCallback(() => {
    if (!connectionId || !wsService.isSocketConnected()) return;

    // Clear messages for this connection
    useChatStore.getState().clearMessages(connectionId);

    // Leave current room
    wsService.emit('connection:leave', { connectionId });

    // Small delay to ensure leave is processed, then rejoin with newSession flag
    setTimeout(() => {
      wsService.emit('connection:join', { connectionId, newSession: true });
      setCurrentConnection(connectionId);
    }, 100);
  }, [connectionId, wsService, setCurrentConnection]);

  return {
    sendMessage,
    sendTyping,
    updatePresence,
    retryMessage,
    resetChat,
    isConnected: wsService.isSocketConnected(),
    connectionStatus: useChatStore.getState().connectionStatus,
  };
};

