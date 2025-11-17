/**
 * MCP Store
 * Zustand store for managing MCP state (streaming, permissions, results)
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useMemo } from 'react';
import type { ToolCallData } from '@/utils/sqlExtractor';
import { chatSessionsAPI, type ChatSession, type ChatMessage } from '@/lib/api/chatSessions';

export interface MCPStreamingMessage {
  messageId: string;
  connectionId: string;
  tool: string;
  arguments: Record<string, any>;
  timestamp: number;
  status: 'streaming' | 'completed' | 'error' | 'cancelled';
  chunks: string[]; // Accumulated text chunks
  fullText: string; // Combined text
  result?: any; // Final result
  error?: string;
  toolCalls: ToolCallData[]; // Array of tool calls made during this message
}

export interface MCPPermissionRequest {
  messageId: string;
  connectionId: string;
  tool: string;
  arguments: Record<string, any>;
  permissionType: string;
  message: string;
  resource?: string;
  action?: string;
  timestamp: number;
}

interface MCPState {
  // Streaming messages
  streamingMessages: Map<string, MCPStreamingMessage>;

  // Permission requests
  pendingPermissions: Map<string, MCPPermissionRequest>;

  // Permission cache (Always Allow)
  permissionCache: Map<string, boolean>; // key: "operation:resource"

  // Chat session state
  currentChatSessionId: string | null;
  currentChatSession: ChatSession | null;
  chatHistory: ChatMessage[];

  // Actions
  addStreamingMessage: (message: MCPStreamingMessage) => void;
  addChunk: (messageId: string, chunk: string) => void;
  addToolCall: (messageId: string, toolCall: ToolCallData) => void;
  updateToolCallResult: (messageId: string, toolCallId: string, result: any) => void;
  completeStreaming: (messageId: string, result: any) => void;
  setStreamingError: (messageId: string, error: string) => void;
  cancelStreaming: (messageId: string) => void;
  removeStreamingMessage: (messageId: string) => void;

  addPermissionRequest: (request: MCPPermissionRequest) => void;
  removePermissionRequest: (messageId: string) => void;

  cachePermission: (operation: string, resource: string) => void;
  checkPermissionCache: (operation: string, resource: string) => boolean;
  clearPermissionCache: () => void;

  clearMCPState: (connectionId?: string) => void;

  // Chat session actions
  createNewChat: (connectionId: string, schema?: string, tables?: string[]) => Promise<ChatSession | null>;
  loadChatHistory: (chatSessionId: string) => Promise<void>;
  saveChatMessages: (userMessage: string, assistantMessage: string, toolCalls?: any) => Promise<void>;
  updateChatTitle: (title: string) => Promise<void>;
  generateChatTitle: (userMessage: string) => Promise<void>;
  clearCurrentChat: () => void;
}

export const useMCPStore = create<MCPState>()(
  devtools(
    (set, get) => ({
      // Initial state
      streamingMessages: new Map(),
      pendingPermissions: new Map(),
      permissionCache: new Map(),
      currentChatSessionId: null,
      currentChatSession: null,
      chatHistory: [],

      // Actions
      addStreamingMessage: (message) =>
        set((state) => {
          const newMessages = new Map(state.streamingMessages);
          newMessages.set(message.messageId, message);
          return { streamingMessages: newMessages };
        }),

      addChunk: (messageId, chunk) =>
        set((state) => {
          const message = state.streamingMessages.get(messageId);
          if (!message) return state;

          const newMessages = new Map(state.streamingMessages);
          const updatedMessage = {
            ...message,
            chunks: [...message.chunks, chunk],
            fullText: message.fullText + chunk,
          };
          newMessages.set(messageId, updatedMessage);
          return { streamingMessages: newMessages };
        }),

      addToolCall: (messageId, toolCall) =>
        set((state) => {
          const message = state.streamingMessages.get(messageId);
          if (!message) return state;

          const newMessages = new Map(state.streamingMessages);
          const updatedMessage = {
            ...message,
            toolCalls: [...message.toolCalls, toolCall],
          };
          newMessages.set(messageId, updatedMessage);
          return { streamingMessages: newMessages };
        }),

      updateToolCallResult: (messageId, toolCallId, result) =>
        set((state) => {
          const message = state.streamingMessages.get(messageId);
          if (!message) return state;

          const newMessages = new Map(state.streamingMessages);
          const updatedToolCalls = message.toolCalls.map((tc) =>
            tc.id === toolCallId ? { ...tc, result } : tc
          );
          const updatedMessage = {
            ...message,
            toolCalls: updatedToolCalls,
          };
          newMessages.set(messageId, updatedMessage);
          return { streamingMessages: newMessages };
        }),

      completeStreaming: (messageId, result) =>
        set((state) => {
          const message = state.streamingMessages.get(messageId);
          if (!message) return state;

          const newMessages = new Map(state.streamingMessages);
          newMessages.set(messageId, {
            ...message,
            status: 'completed',
            result,
          });
          return { streamingMessages: newMessages };
        }),

      setStreamingError: (messageId, error) =>
        set((state) => {
          const message = state.streamingMessages.get(messageId);
          if (!message) return state;

          const newMessages = new Map(state.streamingMessages);
          newMessages.set(messageId, {
            ...message,
            status: 'error',
            error,
          });
          return { streamingMessages: newMessages };
        }),

      cancelStreaming: (messageId) =>
        set((state) => {
          const message = state.streamingMessages.get(messageId);
          if (!message) return state;

          const newMessages = new Map(state.streamingMessages);
          newMessages.set(messageId, {
            ...message,
            status: 'cancelled',
          });
          return { streamingMessages: newMessages };
        }),

      removeStreamingMessage: (messageId) =>
        set((state) => {
          const newMessages = new Map(state.streamingMessages);
          newMessages.delete(messageId);
          return { streamingMessages: newMessages };
        }),

      addPermissionRequest: (request) =>
        set((state) => {
          const newPermissions = new Map(state.pendingPermissions);
          newPermissions.set(request.messageId, request);
          return { pendingPermissions: newPermissions };
        }),

      removePermissionRequest: (messageId) =>
        set((state) => {
          const newPermissions = new Map(state.pendingPermissions);
          newPermissions.delete(messageId);
          return { pendingPermissions: newPermissions };
        }),

      cachePermission: (operation, resource) =>
        set((state) => {
          const newCache = new Map(state.permissionCache);
          newCache.set(`${operation}:${resource}`, true);
          
          // Also store in localStorage
          try {
            const cacheArray = Array.from(newCache.entries());
            localStorage.setItem('mcp_permission_cache', JSON.stringify(cacheArray));
          } catch (error) {
            console.error('Failed to save permission cache to localStorage:', error);
          }
          
          return { permissionCache: newCache };
        }),

      checkPermissionCache: (operation, resource) => {
        const cache = get().permissionCache;
        return cache.has(`${operation}:${resource}`);
      },

      clearPermissionCache: () =>
        set(() => {
          try {
            localStorage.removeItem('mcp_permission_cache');
          } catch (error) {
            console.error('Failed to clear permission cache from localStorage:', error);
          }
          return { permissionCache: new Map() };
        }),

      clearMCPState: (connectionId) =>
        set((state) => {
          if (!connectionId) {
            return {
              streamingMessages: new Map(),
              pendingPermissions: new Map(),
            };
          }

          const newMessages = new Map(state.streamingMessages);
          const newPermissions = new Map(state.pendingPermissions);

          // Filter by connectionId
          state.streamingMessages.forEach((msg, msgId) => {
            if (msg.connectionId === connectionId) {
              newMessages.delete(msgId);
            }
          });

          state.pendingPermissions.forEach((perm, permId) => {
            if (perm.connectionId === connectionId) {
              newPermissions.delete(permId);
            }
          });

          return {
            streamingMessages: newMessages,
            pendingPermissions: newPermissions,
          };
        }),

      // Chat session methods
      createNewChat: async (connectionId, schema, tables) => {
        try {
          const response = await chatSessionsAPI.createChatSession({
            connectionId,
            selectedSchema: schema,
            selectedTables: tables,
          });

          if (response.success && response.data) {
            set({
              currentChatSessionId: response.data.id,
              currentChatSession: response.data,
              chatHistory: [],
            });
            return response.data;
          }
          return null;
        } catch (error) {
          console.error('Failed to create new chat:', error);
          return null;
        }
      },

      loadChatHistory: async (chatSessionId) => {
        try {
          const response = await chatSessionsAPI.getChatSession(chatSessionId);

          if (response.success && response.data) {
            set({
              currentChatSessionId: chatSessionId,
              currentChatSession: response.data,
              chatHistory: response.data.chatMessages || [],
            });
          } else {
            // If loading fails, clear the chat state
            console.error('Failed to load chat history');
            set({
              currentChatSessionId: null,
              currentChatSession: null,
              chatHistory: [],
            });
          }
        } catch (error) {
          console.error('Failed to load chat history:', error);
          // Clear chat state on error
          set({
            currentChatSessionId: null,
            currentChatSession: null,
            chatHistory: [],
          });
        }
      },

      saveChatMessages: async (userMessage, assistantMessage, toolCalls) => {
        const { currentChatSessionId } = get();

        if (!currentChatSessionId) {
          console.warn('No active chat session to save messages to');
          return;
        }

        try {
          // Save user message
          await chatSessionsAPI.addMessage(currentChatSessionId, {
            role: 'user',
            content: userMessage,
          });

          // Save assistant message with tool calls
          await chatSessionsAPI.addMessage(currentChatSessionId, {
            role: 'assistant',
            content: assistantMessage,
            toolCalls: toolCalls,
          });

          // Don't append to chatHistory - for new chats, we show streaming messages
          // For resumed chats, messages are already in chatHistory from initial load
          // This prevents duplicate display of messages
        } catch (error) {
          console.error('Failed to save chat messages:', error);
        }
      },

      updateChatTitle: async (title) => {
        const { currentChatSessionId, currentChatSession } = get();

        if (!currentChatSessionId) {
          console.warn('No active chat session to update');
          return;
        }

        try {
          const response = await chatSessionsAPI.updateChatSession(currentChatSessionId, {
            title,
          });

          if (response.success && response.data) {
            set({
              currentChatSession: response.data,
            });
          }
        } catch (error) {
          console.error('Failed to update chat title:', error);
        }
      },

      generateChatTitle: async (userMessage) => {
        const { currentChatSessionId } = get();

        if (!currentChatSessionId) {
          console.warn('[useMCPStore] No active chat session to generate title for');
          return;
        }

        try {
          console.log('[useMCPStore] Requesting title generation for session:', currentChatSessionId);
          const response = await chatSessionsAPI.generateTitle(currentChatSessionId);

          if (response.success && response.data) {
            console.log('[useMCPStore] Title generated successfully:', response.data.title);
            // Update the local state with the new title
            const session = get().currentChatSession;
            if (session) {
              set({
                currentChatSession: { ...session, title: response.data.title },
              });
            }
          } else {
            console.warn('[useMCPStore] Title generation failed:', response);
          }
        } catch (error) {
          console.error('[useMCPStore] Failed to generate chat title:', error);
        }
      },

      clearCurrentChat: () => {
        set({
          currentChatSessionId: null,
          currentChatSession: null,
          chatHistory: [],
        });
      },
    }),
    { name: 'mcp-store' }
  )
);

// Load permission cache from localStorage on initialization
if (typeof window !== 'undefined') {
  try {
    const cached = localStorage.getItem('mcp_permission_cache');
    if (cached) {
      const cacheArray = JSON.parse(cached) as [string, boolean][];
      const cacheMap = new Map(cacheArray);
      useMCPStore.setState({ permissionCache: cacheMap });
    }
  } catch (error) {
    console.error('Failed to load permission cache from localStorage:', error);
  }
}

// Selectors
export const useStreamingMessages = (connectionId: string | null) => {
  const messageSnapshot = useMCPStore((state) => {
    if (!connectionId) return '';
    const snapshots: string[] = [];
    state.streamingMessages.forEach((msg, msgId) => {
      if (msg.connectionId === connectionId) {
        snapshots.push(`${msgId}:${msg.status}:${msg.chunks.length}`);
      }
    });
    return snapshots.sort().join('|');
  });

  return useMemo(() => {
    if (!connectionId) return [];
    
    const state = useMCPStore.getState();
    const messages: MCPStreamingMessage[] = [];
    state.streamingMessages.forEach((msg) => {
      if (msg.connectionId === connectionId) {
        messages.push(msg);
      }
    });
    
    return messages.sort((a, b) => a.timestamp - b.timestamp);
  }, [connectionId, messageSnapshot]);
};

export const usePendingPermissions = (connectionId: string | null) => {
  const permissionSnapshot = useMCPStore((state) => {
    if (!connectionId) return '';
    const snapshots: string[] = [];
    state.pendingPermissions.forEach((perm, permId) => {
      if (perm.connectionId === connectionId) {
        snapshots.push(`${permId}:${perm.timestamp}`);
      }
    });
    return snapshots.sort().join('|');
  });

  return useMemo(() => {
    if (!connectionId) return [];
    
    const state = useMCPStore.getState();
    const permissions: MCPPermissionRequest[] = [];
    state.pendingPermissions.forEach((perm) => {
      if (perm.connectionId === connectionId) {
        permissions.push(perm);
      }
    });
    
    return permissions.sort((a, b) => a.timestamp - b.timestamp);
  }, [connectionId, permissionSnapshot]);
};




