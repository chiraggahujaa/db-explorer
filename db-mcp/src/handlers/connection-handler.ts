/**
 * Connection management and message processing for SSE connections
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { SSETransport } from '../transports/sse-transport.js';

export interface Connection {
  server: Server;
  transport: SSETransport;
  controller: ReadableStreamDefaultController;
  encoder: TextEncoder;
  requestId: number;
}

// Store active SSE connections
export const connections = new Map<string, Connection>();

/**
 * Process incoming JSON-RPC message by feeding it to the transport
 * The transport will pass it to the server which processes and sends responses
 */
export async function processMessage(
  conn: Connection,
  message: JSONRPCMessage,
  sessionId: string
): Promise<void> {
  try {
    // Feed the message to the transport, which will trigger the server's handlers
    conn.transport.receiveMessage(message);
  } catch (error) {
    console.error('[processMessage] Error processing message:', error);
    // Send error response via SSE if message had an id
    if ('id' in message && message.id !== undefined) {
      const errorResponse = {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
        },
      };
      const data = `data: ${JSON.stringify(errorResponse)}\n\n`;
      conn.controller.enqueue(conn.encoder.encode(data));
    }
  }
}

