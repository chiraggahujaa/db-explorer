/**
 * Frontend MCP Service
 * Direct connection to MCP server using MCP SDK
 * Handles streaming responses and permission requests
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

export interface MCPDatabaseConfig {
  type: 'mysql' | 'postgresql' | 'sqlite' | 'supabase' | 'planetscale' | 'mongodb';
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  file?: string; // For SQLite
  projectUrl?: string; // For Supabase
  anonKey?: string; // For Supabase
  serviceKey?: string; // For Supabase
  authSource?: string; // For MongoDB
  ssl?: boolean;
  connectionString?: string;
}

export interface MCPQueryRequest {
  tool: string;
  arguments: Record<string, any>;
}

export interface MCPStreamEvent {
  type: 'start' | 'progress' | 'permission_request' | 'chunk' | 'result' | 'error';
  data: any;
}

export interface MCPPermissionRequest {
  permissionType: string;
  message: string;
  resource?: string;
  action?: string;
  query?: string;
}

export type MCPStreamCallback = (event: MCPStreamEvent) => void;

export class MCPService {
  private client: Client | null = null;
  private connectionId: string | null = null;
  private mcpServerUrl: string;
  private isConnected: boolean = false;

  constructor() {
    // Get MCP server URL from environment or use default
    this.mcpServerUrl = process.env.NEXT_PUBLIC_MCP_SERVER_URL || 'http://localhost:3002';
  }

  /**
   * Initialize MCP client and configure database connection
   */
  async initialize(connectionId: string, config: MCPDatabaseConfig): Promise<void> {
    try {
      // If already connected to a different connection, disconnect first
      if (this.isConnected && this.connectionId !== connectionId) {
        await this.disconnect();
      }

      // Create SSE transport
      const transport = new SSEClientTransport(
        new URL(`${this.mcpServerUrl}/sse`)
      );

      // Create MCP client
      this.client = new Client(
        {
          name: 'db-explorer-frontend',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        }
      );

      // Connect to MCP server
      await this.client.connect(transport);

      // Configure database connection on MCP server
      try {
        await this.client.callTool({
          name: 'configure_connection',
          arguments: {
            connectionId,
            config,
          },
        });
      } catch (error) {
        console.warn(`Could not configure connection ${connectionId} in MCP server:`, error);
        // Continue even if configuration fails - server might already have the connection
      }

      this.connectionId = connectionId;
      this.isConnected = true;
      console.log(`[MCP] Connected to MCP server for connection ${connectionId}`);
    } catch (error) {
      console.error(`[MCP] Failed to initialize client for ${connectionId}:`, error);
      throw error;
    }
  }

  /**
   * Execute a query/tool call with streaming support
   */
  async executeQuery(
    query: MCPQueryRequest,
    onStream?: MCPStreamCallback
  ): Promise<any> {
    if (!this.client || !this.isConnected) {
      throw new Error('MCP client not connected. Call initialize() first.');
    }

    try {
      // Emit start event
      onStream?.({
        type: 'start',
        data: { tool: query.tool, arguments: query.arguments },
      });

      // Call the tool
      const result = await this.client.callTool({
        name: query.tool,
        arguments: query.arguments,
      });

      // Process the result
      if (result.content && Array.isArray(result.content)) {
        for (const content of result.content) {
          if (content.type === 'text') {
            const text = content.text || '';

            // Check if this is a permission request
            if (text.includes('permission') || text.includes('allow')) {
              const permissionData: MCPPermissionRequest = {
                permissionType: 'query_execution',
                message: text,
                action: query.tool,
              };

              onStream?.({
                type: 'permission_request',
                data: permissionData,
              });

              // Return early - waiting for user permission response
              return { type: 'permission_pending', data: permissionData };
            }

            // Stream text chunks (simulate character-by-character streaming)
            // In a real implementation, the MCP server would send chunks via SSE
            const chunks = this.splitIntoChunks(text, 50); // Split into ~50 char chunks
            for (const chunk of chunks) {
              onStream?.({
                type: 'chunk',
                data: { text: chunk },
              });

              // Small delay to simulate streaming
              await this.delay(10);
            }
          }
        }

        // Emit complete result
        onStream?.({
          type: 'result',
          data: result,
        });

        return result;
      }

      return result;
    } catch (error: any) {
      const errorMessage = error.message || String(error);
      
      onStream?.({
        type: 'error',
        data: { message: errorMessage },
      });

      throw error;
    }
  }

  /**
   * List available tools from MCP server
   */
  async listTools(): Promise<any> {
    if (!this.client || !this.isConnected) {
      throw new Error('MCP client not connected. Call initialize() first.');
    }

    try {
      const result = await this.client.listTools();
      return result.tools;
    } catch (error) {
      console.error('[MCP] Failed to list tools:', error);
      throw error;
    }
  }

  /**
   * List available resources from MCP server
   */
  async listResources(): Promise<any> {
    if (!this.client || !this.isConnected) {
      throw new Error('MCP client not connected. Call initialize() first.');
    }

    try {
      const result = await this.client.listResources();
      return result.resources;
    } catch (error) {
      console.error('[MCP] Failed to list resources:', error);
      throw error;
    }
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch (error) {
        console.error('[MCP] Error disconnecting:', error);
      }
      this.client = null;
      this.connectionId = null;
      this.isConnected = false;
      console.log('[MCP] Disconnected from MCP server');
    }
  }

  /**
   * Check if client is connected
   */
  isClientConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get current connection ID
   */
  getCurrentConnectionId(): string | null {
    return this.connectionId;
  }

  // Helper methods

  private splitIntoChunks(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.substring(i, i + chunkSize));
    }
    return chunks;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
let mcpServiceInstance: MCPService | null = null;

export const getMCPService = (): MCPService => {
  if (!mcpServiceInstance) {
    mcpServiceInstance = new MCPService();
  }
  return mcpServiceInstance;
};




