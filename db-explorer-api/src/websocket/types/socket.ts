/**
 * WebSocket Type Definitions
 * Defines all types used for Socket.IO communication
 */

export interface ChatMessage {
  messageId: string;
  userId: string;
  connectionId: string;
  content: string;
  context?: {
    schema?: string;
    tables?: string[];
    config?: {
      readOnly?: boolean;
      dryRun?: boolean;
    };
  };
  timestamp: number;
  status: 'pending' | 'sending' | 'sent' | 'delivered' | 'error';
  error?: string;
}

export interface TypingIndicator {
  userId: string;
  connectionId: string;
  isTyping: boolean;
  timestamp: number;
}

export interface PresenceStatus {
  userId: string;
  connectionId: string;
  status: 'online' | 'away' | 'offline';
  lastSeen?: number;
}

export interface SocketUser {
  userId: string;
  email?: string;
  socketId: string;
  connectedAt: number;
}

// Client → Server Events
export interface ClientToServerEvents {
  'chat:message': (data: {
    messageId: string;
    content: string;
    connectionId: string;
    context?: ChatMessage['context'];
  }) => void;
  
  'chat:typing:start': (data: { connectionId: string }) => void;
  'chat:typing:stop': (data: { connectionId: string }) => void;
  'presence:update': (data: { status: PresenceStatus['status']; connectionId: string }) => void;
  'chat:ack': (data: { messageId: string }) => void;
  'connection:join': (data: { connectionId: string; newSession?: boolean }) => void;
  'connection:leave': (data: { connectionId: string }) => void;
}

// Server → Client Events
export interface ServerToClientEvents {
  'chat:message': (data: ChatMessage) => void;
  'chat:message:sent': (data: { messageId: string; timestamp: number }) => void;
  'chat:message:error': (data: { messageId: string; error: string }) => void;
  'chat:typing': (data: TypingIndicator) => void;
  'presence:update': (data: PresenceStatus) => void;
  'connection:status': (data: {
    status: 'connected' | 'disconnected' | 'reconnecting';
    reconnectAttempts?: number;
  }) => void;
  'chat:history': (data: { messages: ChatMessage[] }) => void;
}

// Inter-server events (for future scaling)
export interface InterServerEvents {
  ping: () => void;
  pong: (payload: number) => void;
}

// Socket data attached to each socket instance
export interface SocketData {
  user: SocketUser;
  authenticated: boolean;
  connectionId?: string | undefined;
}

