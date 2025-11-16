/**
 * useMCP Hook
 * React hook for MCP integration - handles queries, streaming, and permissions
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { getMCPService, type MCPStreamEvent, type MCPQueryRequest } from '@/services/MCPService';
import { useMCPStore } from '@/stores/useMCPStore';
import { mapConnectionConfigToMCP } from '@/utils/mcpMapper';
import type { ConnectionWithRole } from '@/types/connection';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';

interface UseMCPOptions {
  connection: ConnectionWithRole | null;
  autoConnect?: boolean;
}

export const useMCP = (options: UseMCPOptions) => {
  const { connection, autoConnect = true } = options;
  const mcpService = getMCPService();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const {
    addStreamingMessage,
    addChunk,
    completeStreaming,
    setStreamingError,
    addPermissionRequest,
    removePermissionRequest,
    checkPermissionCache,
    cachePermission,
  } = useMCPStore();

  const initializeCompletedRef = useRef(false);
  const currentConnectionIdRef = useRef<string | null>(null);

  // Initialize MCP connection
  useEffect(() => {
    if (!autoConnect || !connection) return;
    
    // If already initialized for this connection, just update state
    if (currentConnectionIdRef.current === connection.id && initializeCompletedRef.current) {
      setIsConnected(mcpService.isClientConnected());
      return;
    }

    const initialize = async () => {
      try {
        setIsConnecting(true);
        setIsConnected(false);
        console.log(`[useMCP] Initializing for connection ${connection.id}`);
        
        // Fetch full connection config with credentials from backend
        console.log('[useMCP] Fetching connection credentials...');
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
        
        if (!token) {
          throw new Error('No authentication token found. Please log in again.');
        }
        
        const response = await fetch(`${apiUrl}/api/connections/${connection.id}/credentials`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch credentials: ${response.statusText}`);
        }
        
        const result = await response.json();
        if (!result.success || !result.data) {
          throw new Error('Failed to get connection credentials');
        }
        
        console.log('[useMCP] Credentials fetched, hasPassword:', !!(result.data.config as any).password);
        
        const mcpConfig = mapConnectionConfigToMCP(result.data.config);
        console.log('[useMCP] MCP Config prepared with credentials');
        
        // Set timeout for initialization
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('MCP initialization timeout')), 10000);
        });
        
        await Promise.race([
          mcpService.initialize(connection.id, mcpConfig),
          timeoutPromise
        ]);
        
        initializeCompletedRef.current = true;
        currentConnectionIdRef.current = connection.id;
        setIsConnected(true);
        setIsConnecting(false);
        console.log(`[useMCP] Successfully initialized for connection ${connection.id}`);
      } catch (error) {
        console.error('[useMCP] Failed to initialize:', error);
        // Show error but allow user to see it's trying
        toast.error('Database Connection Failed', {
          description: `${error instanceof Error ? error.message : 'Unknown error'}. The MCP server might not be running or configured correctly.`,
          duration: 6000,
        });
        setIsConnected(false);
        setIsConnecting(false);
        initializeCompletedRef.current = false;
      }
    };

    initialize();

    return () => {
      // Cleanup on unmount or connection change
      if (initializeCompletedRef.current && currentConnectionIdRef.current !== connection.id) {
        console.log(`[useMCP] Cleaning up connection ${currentConnectionIdRef.current}`);
        mcpService.disconnect();
        initializeCompletedRef.current = false;
        currentConnectionIdRef.current = null;
        setIsConnected(false);
      }
    };
  }, [connection?.id, autoConnect, mcpService]);

  // Execute MCP query
  const executeQuery = useCallback(
    async (tool: string, args: Record<string, any>): Promise<string> => {
      if (!connection) {
        throw new Error('No connection selected');
      }

      if (!mcpService.isClientConnected()) {
        throw new Error('MCP client not connected');
      }

      const messageId = uuidv4();
      const query: MCPQueryRequest = { tool, arguments: args };

      // Add streaming message
      addStreamingMessage({
        messageId,
        connectionId: connection.id,
        tool,
        arguments: args,
        timestamp: Date.now(),
        status: 'streaming',
        chunks: [],
        fullText: '',
        toolCalls: [],
      });

      try {
        // Execute query with streaming
        await mcpService.executeQuery(query, (event: MCPStreamEvent) => {
          switch (event.type) {
            case 'start':
              // Already added streaming message
              break;

            case 'chunk':
              // Add text chunk
              addChunk(messageId, event.data.text);
              break;

            case 'permission_request':
              // Add permission request (only for actual server-side permission requests)
              addPermissionRequest({
                messageId,
                connectionId: connection.id,
                tool,
                arguments: args,
                permissionType: event.data.permissionType,
                message: event.data.message,
                resource: event.data.resource,
                action: event.data.action,
                timestamp: Date.now(),
              });
              break;

            case 'result':
              // Complete streaming
              completeStreaming(messageId, event.data);
              break;

            case 'error':
              // Set error
              setStreamingError(messageId, event.data.message);
              break;
          }
        });

        return messageId;
      } catch (error: any) {
        setStreamingError(messageId, error.message || 'Unknown error');
        throw error;
      }
    },
    [
      connection,
      mcpService,
      addStreamingMessage,
      addChunk,
      completeStreaming,
      setStreamingError,
      addPermissionRequest,
    ]
  );

  // Respond to permission request
  const respondToPermission = useCallback(
    async (messageId: string, approved: boolean, alwaysAllow: boolean = false) => {
      if (!connection) return;

      // Get permission request
      const state = useMCPStore.getState();
      const permissionRequest = state.pendingPermissions.get(messageId);
      if (!permissionRequest) {
        console.error('[useMCP] Permission request not found:', messageId);
        return;
      }

      // Remove permission request from state
      removePermissionRequest(messageId);

      if (!approved) {
        // User denied - set error
        setStreamingError(messageId, 'Permission denied by user');
        return;
      }

      // Cache permission if always allow
      if (alwaysAllow && permissionRequest.resource) {
        cachePermission(permissionRequest.tool, permissionRequest.resource);
      }

      // Re-execute the query with permission granted
      try {
        await executeQuery(permissionRequest.tool, permissionRequest.arguments);
      } catch (error) {
        console.error('[useMCP] Failed to re-execute query after permission:', error);
      }
    },
    [connection, removePermissionRequest, setStreamingError, cachePermission, executeQuery]
  );

  // List available tools
  const listTools = useCallback(async () => {
    if (!mcpService.isClientConnected()) {
      throw new Error('MCP client not connected');
    }

    try {
      return await mcpService.listTools();
    } catch (error) {
      console.error('[useMCP] Failed to list tools:', error);
      throw error;
    }
  }, [mcpService]);

  // List available resources
  const listResources = useCallback(async () => {
    if (!mcpService.isClientConnected()) {
      throw new Error('MCP client not connected');
    }

    try {
      return await mcpService.listResources();
    } catch (error) {
      console.error('[useMCP] Failed to list resources:', error);
      throw error;
    }
  }, [mcpService]);

  return {
    executeQuery,
    respondToPermission,
    listTools,
    listResources,
    isConnected,
    isConnecting,
  };
};

