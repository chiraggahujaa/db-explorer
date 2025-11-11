/**
 * WebSocket Client Service
 * Manages Socket.IO client connection with reconnection logic
 */

import { io, Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  ConnectionStatus,
} from './types.js';

const getApiUrl = (): string => {
  const env = process.env.NEXT_PUBLIC_API_URL;
  if (!env) return 'http://localhost:5000';
  return env.replace(/\/$/, '');
};

const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
};

export class WebSocketService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();
  private isConnecting = false;
  private isConnected = false;

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.socket?.connected || this.isConnecting) {
      return;
    }

    const token = getAuthToken();
    if (!token) {
      console.warn('[WebSocket] No auth token available, cannot connect');
      return;
    }

    this.isConnecting = true;
    const apiUrl = getApiUrl();

    this.socket = io(apiUrl, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      reconnection: false, // We'll handle reconnection manually
      autoConnect: true,
    });

    this.setupEventHandlers();
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[WebSocket] Connected');
      this.isConnected = true;
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      // Notify listeners of connection status
      this.notifyListeners('connection:status', { status: 'connected' });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected:', reason);
      this.isConnected = false;
      this.isConnecting = false;
      this.notifyListeners('connection:status', { status: 'disconnected' });

      // Attempt reconnection if not a manual disconnect
      if (reason === 'io server disconnect') {
        // Server disconnected, reconnect immediately
        this.scheduleReconnect();
      } else if (reason === 'io client disconnect') {
        // Client disconnected, don't reconnect
        return;
      } else {
        // Network error, reconnect with backoff
        this.scheduleReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    });

    // Forward all server events to registered listeners
    const serverEvents: (keyof ServerToClientEvents)[] = [
      'chat:message',
      'chat:message:sent',
      'chat:message:error',
      'chat:typing',
      'presence:update',
      'connection:status',
      'chat:history',
    ];

    serverEvents.forEach((event) => {
      this.socket?.on(event, ((...args: any[]) => {
        // Type-safe forwarding to listeners
        this.notifyListeners(event, ...(args as Parameters<ServerToClientEvents[typeof event]>));
      }) as any);
    });
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnection attempts reached');
      this.notifyListeners('connection:status', {
        status: 'disconnected',
        reconnectAttempts: this.reconnectAttempts,
      });
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.notifyListeners('connection:status', {
      status: 'reconnecting',
      reconnectAttempts: this.reconnectAttempts,
    });

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.listeners.clear();
  }

  /**
   * Emit event to server
   */
  emit<K extends keyof ClientToServerEvents>(
    event: K,
    ...args: Parameters<ClientToServerEvents[K]>
  ): void {
    if (!this.socket?.connected) {
      console.warn(`[WebSocket] Cannot emit ${event}: not connected`);
      return;
    }

    this.socket.emit(event, ...args);
  }

  /**
   * Register event listener
   */
  on<K extends keyof ServerToClientEvents>(
    event: K,
    handler: ServerToClientEvents[K]
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  /**
   * Remove event listener
   */
  off<K extends keyof ServerToClientEvents>(
    event: K,
    handler: ServerToClientEvents[K]
  ): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Notify all listeners of an event
   */
  private notifyListeners<K extends keyof ServerToClientEvents>(
    event: K,
    ...args: Parameters<ServerToClientEvents[K]>
  ): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          // Type assertion needed because handler signature matches
          (handler as (...args: Parameters<ServerToClientEvents[K]>) => void)(...args);
        } catch (error) {
          console.error(`[WebSocket] Error in listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): ConnectionStatus {
    if (this.isConnecting) return 'connecting';
    if (this.isConnected) return 'connected';
    if (this.reconnectAttempts > 0) return 'reconnecting';
    return 'disconnected';
  }

  /**
   * Check if connected
   */
  isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }
}

// Singleton instance
let wsServiceInstance: WebSocketService | null = null;

export const getWebSocketService = (): WebSocketService => {
  if (!wsServiceInstance) {
    wsServiceInstance = new WebSocketService();
  }
  return wsServiceInstance;
};

