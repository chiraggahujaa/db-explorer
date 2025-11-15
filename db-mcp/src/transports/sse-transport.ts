/**
 * Custom SSE Transport for bridging SSE stream with MCP Server
 */

import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

export class SSETransport implements Transport {
  private _onmessage?: (message: JSONRPCMessage) => void;
  private _onerror?: (error: Error) => void;
  private _onclose?: () => void;
  
  public controller: ReadableStreamDefaultController;
  public encoder: TextEncoder;

  constructor(controller: ReadableStreamDefaultController, encoder: TextEncoder) {
    this.controller = controller;
    this.encoder = encoder;
  }

  async start(): Promise<void> {
    // Transport is already started when stream is created
  }

  async send(message: JSONRPCMessage): Promise<void> {
    try {
      const data = `data: ${JSON.stringify(message)}\n\n`;
      this.controller.enqueue(this.encoder.encode(data));
    } catch (error) {
      this._onerror?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async close(): Promise<void> {
    try {
      this.controller.close();
    } catch {
      // Ignore errors on close
    }
    this._onclose?.();
  }

  set onmessage(handler: (message: JSONRPCMessage) => void) {
    this._onmessage = handler;
  }

  set onerror(handler: (error: Error) => void) {
    this._onerror = handler;
  }

  set onclose(handler: () => void) {
    this._onclose = handler;
  }

  // Method to receive messages from client (called by our message endpoint)
  receiveMessage(message: JSONRPCMessage): void {
    this._onmessage?.(message);
  }
}

