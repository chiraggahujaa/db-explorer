/**
 * Chat Store
 * Zustand store for managing chat state
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useMemo } from 'react';
import type { ChatMessage, TypingIndicator, PresenceStatus, ConnectionStatus } from '@/lib/websocket/types';

interface ChatState {
  // Connection
  connectionStatus: ConnectionStatus;
  reconnectAttempts: number;

  // Messages
  messages: Map<string, ChatMessage>; // messageId -> message
  pendingMessages: Set<string>; // messageIds that are pending

  // Typing indicators
  typingUsers: Map<string, { userId: string; timestamp: number }>; // connectionId -> typing info

  // Presence
  presence: Map<string, PresenceStatus>; // userId:connectionId -> presence

  // Current connection
  currentConnectionId: string | null;

  // Actions
  setConnectionStatus: (status: ConnectionStatus, reconnectAttempts?: number) => void;
  addMessage: (message: ChatMessage) => void;
  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  removeMessage: (messageId: string) => void;
  setPending: (messageId: string, pending: boolean) => void;
  setTyping: (connectionId: string, userId: string, isTyping: boolean) => void;
  setPresence: (userId: string, connectionId: string, status: PresenceStatus['status']) => void;
  setCurrentConnection: (connectionId: string | null) => void;
  clearMessages: (connectionId?: string) => void;
  loadHistory: (messages: ChatMessage[]) => void;
}

export const useChatStore = create<ChatState>()(
  devtools(
    (set) => ({
      // Initial state
      connectionStatus: 'disconnected',
      reconnectAttempts: 0,
      messages: new Map(),
      pendingMessages: new Set(),
      typingUsers: new Map(),
      presence: new Map(),
      currentConnectionId: null,

      // Actions
      setConnectionStatus: (status, reconnectAttempts = 0) =>
        set({ connectionStatus: status, reconnectAttempts }),

      addMessage: (message) =>
        set((state) => {
          const newMessages = new Map(state.messages);
          newMessages.set(message.messageId, message);
          return { messages: newMessages };
        }),

      updateMessage: (messageId, updates) =>
        set((state) => {
          const message = state.messages.get(messageId);
          if (!message) return state;

          const newMessages = new Map(state.messages);
          newMessages.set(messageId, { ...message, ...updates });
          return { messages: newMessages };
        }),

      removeMessage: (messageId) =>
        set((state) => {
          const newMessages = new Map(state.messages);
          newMessages.delete(messageId);
          return { messages: newMessages };
        }),

      setPending: (messageId, pending) =>
        set((state) => {
          const newPending = new Set(state.pendingMessages);
          if (pending) {
            newPending.add(messageId);
          } else {
            newPending.delete(messageId);
          }
          return { pendingMessages: newPending };
        }),

      setTyping: (connectionId, userId, isTyping) =>
        set((state) => {
          const newTyping = new Map(state.typingUsers);
          if (isTyping) {
            newTyping.set(connectionId, { userId, timestamp: Date.now() });
          } else {
            newTyping.delete(connectionId);
          }
          return { typingUsers: newTyping };
        }),

      setPresence: (userId, connectionId, status) =>
        set((state) => {
          const newPresence = new Map(state.presence);
          const key = `${userId}:${connectionId}`;
          newPresence.set(key, {
            userId,
            connectionId,
            status,
            lastSeen: status === 'offline' ? Date.now() : undefined,
          });
          return { presence: newPresence };
        }),

      setCurrentConnection: (connectionId) =>
        set({ currentConnectionId: connectionId }),

      clearMessages: (connectionId) =>
        set((state) => {
          if (!connectionId) {
            return { messages: new Map(), pendingMessages: new Set() };
          }

          const newMessages = new Map(state.messages);
          const newPending = new Set(state.pendingMessages);

          state.messages.forEach((message, messageId) => {
            if (message.connectionId === connectionId) {
              newMessages.delete(messageId);
              newPending.delete(messageId);
            }
          });

          return { messages: newMessages, pendingMessages: newPending };
        }),

      loadHistory: (messages) =>
        set((state) => {
          const newMessages = new Map(state.messages);
          messages.forEach((message) => {
            newMessages.set(message.messageId, message);
          });
          return { messages: newMessages };
        }),
    }),
    { name: 'chat-store' }
  )
);

// Selectors
export const useChatMessages = (connectionId: string | null) => {
  // Track message IDs and their key properties as a stable string dependency
  const messageSnapshot = useChatStore((state) => {
    if (!connectionId) return '';
    const snapshots: string[] = [];
    state.messages.forEach((msg, msgId) => {
      if (msg.connectionId === connectionId) {
        // Include message ID, status, and timestamp to detect changes
        snapshots.push(`${msgId}:${msg.status}:${msg.timestamp}`);
      }
    });
    return snapshots.sort().join('|');
  });
  
  // Memoize the filtered and sorted messages based on the snapshot
  // Use getState() to avoid subscribing to the Map itself
  return useMemo(() => {
    if (!connectionId) return [];
    
    const state = useChatStore.getState();
    const filteredMessages: ChatMessage[] = [];
    state.messages.forEach((msg) => {
      if (msg.connectionId === connectionId) {
        filteredMessages.push(msg);
      }
    });
    
    return filteredMessages.sort((a, b) => a.timestamp - b.timestamp);
  }, [connectionId, messageSnapshot]);
};

export const useTypingUsers = (connectionId: string | null) => {
  const typingData = useChatStore((state) => {
    if (!connectionId) return null;
    return state.typingUsers.get(connectionId);
  });
  
  return useMemo(() => {
    if (!typingData) return [];
    return [typingData.userId];
  }, [typingData?.userId]);
};

export const useConnectionStatus = () => {
  return useChatStore((state) => state.connectionStatus);
};

