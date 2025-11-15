/**
 * MCP Store
 * Zustand store for managing MCP state (streaming, permissions, results)
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useMemo } from 'react';

export interface MCPStreamingMessage {
  messageId: string;
  connectionId: string;
  tool: string;
  arguments: Record<string, any>;
  timestamp: number;
  status: 'streaming' | 'completed' | 'error';
  chunks: string[]; // Accumulated text chunks
  fullText: string; // Combined text
  result?: any; // Final result
  error?: string;
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
  
  // Actions
  addStreamingMessage: (message: MCPStreamingMessage) => void;
  addChunk: (messageId: string, chunk: string) => void;
  completeStreaming: (messageId: string, result: any) => void;
  setStreamingError: (messageId: string, error: string) => void;
  removeStreamingMessage: (messageId: string) => void;
  
  addPermissionRequest: (request: MCPPermissionRequest) => void;
  removePermissionRequest: (messageId: string) => void;
  
  cachePermission: (operation: string, resource: string) => void;
  checkPermissionCache: (operation: string, resource: string) => boolean;
  clearPermissionCache: () => void;
  
  clearMCPState: (connectionId?: string) => void;
}

export const useMCPStore = create<MCPState>()(
  devtools(
    (set, get) => ({
      // Initial state
      streamingMessages: new Map(),
      pendingPermissions: new Map(),
      permissionCache: new Map(),

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




