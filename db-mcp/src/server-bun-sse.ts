/**
 * Bun-Compatible MCP SSE Server
 * Implements MCP JSON-RPC protocol over SSE without using SSEServerTransport
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

import { logger } from './utils/logger.js';
import { getDatabaseManager } from './database.js';
import { SSETransport } from './transports/sse-transport.js';
import { connections, processMessage } from './handlers/connection-handler.js';
import { setupToolHandlers } from './handlers/tool-handlers.js';

async function startServer(port: number = 3002) {
  const serverLogger = logger.child('MCPServerSSE');

  try {
    // Initialize database manager
    serverLogger.info('Initializing database manager...');
    await getDatabaseManager();
    serverLogger.success('Database manager initialized');

    let actualPort = port;
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      try {
        const httpServer = Bun.serve({
          port: actualPort,
          idleTimeout: 255,
          async fetch(req) {
            const url = new URL(req.url);
            const requestLogger = serverLogger.child('Request');

            // CORS preflight
            if (req.method === 'OPTIONS') {
              return new Response(null, {
                status: 204,
                headers: {
                  'Access-Control-Allow-Origin': '*',
                  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                  'Access-Control-Allow-Headers': 'Content-Type, mcp-protocol-version',
                  'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
                },
              });
            }

            // SSE endpoint
            if (url.pathname === '/sse' && req.method === 'GET') {
              requestLogger.info('SSE connection request received');

              const sessionId = crypto.randomUUID();
              const encoder = new TextEncoder();

              // Create MCP Server instance for this connection
              const mcpServer = new Server(
                {
                  name: 'multi-database-mcp-server',
                  version: '2.0.0',
                },
                {
                  capabilities: {
                    resources: {},
                    tools: {},
                  },
                }
              );

              // Setup all tool handlers
              setupToolHandlers(mcpServer);

              // Create SSE stream
              const stream = new ReadableStream({
                async start(controller) {
                  try {
                    // Create custom transport
                    const transport = new SSETransport(controller, encoder);

                    // Store connection
                    connections.set(sessionId, {
                      server: mcpServer,
                      transport,
                      controller,
                      encoder,
                      requestId: 0,
                    });

                    requestLogger.info(`SSE connection established: ${sessionId}`);

                    // Connect server to transport
                    await mcpServer.connect(transport);

                    // Send endpoint event with session ID
                    const endpointUrl = new URL(url);
                    endpointUrl.pathname = '/message';
                    endpointUrl.searchParams.set('sessionId', sessionId);
                    const endpointEvent = `event: endpoint\ndata: ${endpointUrl.pathname}${endpointUrl.search}\n\n`;
                    controller.enqueue(encoder.encode(endpointEvent));
                  } catch (error) {
                    requestLogger.error(`Failed to establish SSE connection ${sessionId}:`, error);
                    controller.error(error);
                  }
                },
                cancel() {
                  requestLogger.info(`SSE connection closed: ${sessionId}`);
                  const conn = connections.get(sessionId);
                  if (conn) {
                    conn.transport.close().catch(() => {});
                  }
                  connections.delete(sessionId);
                },
              });

              return new Response(stream, {
                status: 200,
                headers: {
                  'Content-Type': 'text/event-stream',
                  'Cache-Control': 'no-cache',
                  'Connection': 'keep-alive',
                  'Access-Control-Allow-Origin': '*',
                  'X-Accel-Buffering': 'no',
                },
              });
            }

            // Message endpoint (client -> server)
            if (url.pathname === '/message' && req.method === 'POST') {
              try {
                const sessionId = url.searchParams.get('sessionId');
                if (!sessionId) {
                  return new Response('Missing sessionId', {
                    status: 400,
                    headers: { 'Access-Control-Allow-Origin': '*' },
                  });
                }

                const conn = connections.get(sessionId);
                if (!conn) {
                  return new Response('Session not found', {
                    status: 404,
                    headers: { 'Access-Control-Allow-Origin': '*' },
                  });
                }

                const message = (await req.json()) as JSONRPCMessage;
                requestLogger.debug(`Received message for session ${sessionId}:`, {
                  method: 'method' in message ? message.method : undefined,
                  id: 'id' in message ? message.id : undefined,
                });

                // Process message and send response via SSE
                await processMessage(conn, message, sessionId);

                return new Response('OK', {
                  status: 200,
                  headers: { 'Access-Control-Allow-Origin': '*' },
                });
              } catch (error) {
                requestLogger.error('Error handling message:', error);
                return new Response('Internal Server Error', {
                  status: 500,
                  headers: { 'Access-Control-Allow-Origin': '*' },
                });
              }
            }

            return new Response('Not Found', { status: 404 });
          },
        });

        serverLogger.success(`Multi-Database MCP Server running on SSE`, {
          url: `http://localhost:${actualPort}/sse`,
          port: actualPort,
        });

        return httpServer;
      } catch (error: any) {
        if (error?.code === 'EADDRINUSE' && attempts < maxAttempts - 1) {
          attempts++;
          actualPort = port + attempts;
          serverLogger.warn(`Port ${port + attempts - 1} is in use, trying port ${actualPort}`);
        } else {
          throw error;
        }
      }
    }
  } catch (error) {
    serverLogger.error('Failed to start server', error);
    throw error;
  }
}

if (import.meta.main) {
  const port = parseInt(process.env.MCP_SERVER_PORT || '3002');
  const startupLogger = logger.child('Startup');

  startupLogger.info('Starting Bun-compatible MCP SSE Server', {
    port,
    logLevel: process.env.LOG_LEVEL || 'info',
    nodeEnv: process.env.NODE_ENV || 'development',
  });

  startServer(port).catch((error) => {
    startupLogger.error('Failed to start MCP SSE server', error, { port });
    process.exit(1);
  });
}

export { startServer };
