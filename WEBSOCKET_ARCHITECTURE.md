# WebSocket Chat System Architecture

## Overview
Production-grade real-time chat system connecting Next.js frontend with Express backend using Socket.IO for database exploration queries.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐      ┌──────────────────────────────┐    │
│  │ ChatInterface.tsx│──────│ useWebSocket Hook            │    │
│  │  (UI Component)  │      │  - Connection Management     │    │
│  └──────────────────┘      │  - Message Queue            │    │
│                            │  - State Management         │    │
│                            └──────────────────────────────┘    │
│                                      │                          │
│                            ┌──────────────────────────────┐    │
│                            │ WebSocketService              │    │
│                            │  - Socket.IO Client          │    │
│                            │  - Reconnection Logic        │    │
│                            │  - Message Queue             │    │
│                            └──────────────────────────────┘    │
│                                      │                          │
└──────────────────────────────────────┼──────────────────────────┘
                                       │ WebSocket (WSS/WS)
┌──────────────────────────────────────┼──────────────────────────┐
│                                      │                          │
│                            ┌──────────────────────────────┐    │
│                            │ Socket.IO Server              │    │
│                            │  - Connection Handler        │    │
│                            │  - Authentication Middleware │    │
│                            └──────────────────────────────┘    │
│                                      │                          │
│  ┌──────────────────┐      ┌──────────────────────────────┐    │
│  │ ChatController   │──────│ ChatService                  │    │
│  │  - Event Handlers│      │  - Message Processing        │    │
│  └──────────────────┘      │  - Typing Indicators         │    │
│                            │  - Presence Management       │    │
│                            └──────────────────────────────┘    │
│                                      │                          │
│                            ┌──────────────────────────────┐    │
│                            │ MessageQueue                  │    │
│                            │  - Offline Message Storage   │    │
│                            └──────────────────────────────┘    │
│                                                                   │
│                         Backend (Express)                        │
└─────────────────────────────────────────────────────────────────┘
```

## Folder Structure

### Backend (`db-explorer-api/src/`)

```
src/
├── websocket/
│   ├── server.ts              # Socket.IO server setup
│   ├── middleware/
│   │   ├── auth.ts            # WebSocket authentication
│   │   ├── rateLimit.ts       # Rate limiting for WebSocket
│   │   └── validation.ts      # Message validation
│   ├── handlers/
│   │   ├── chat.ts            # Chat event handlers
│   │   ├── typing.ts          # Typing indicator handlers
│   │   └── presence.ts        # Presence status handlers
│   ├── services/
│   │   ├── ChatService.ts     # Core chat business logic
│   │   ├── MessageQueue.ts    # Offline message queue
│   │   └── PresenceService.ts # User presence management
│   └── types/
│       └── socket.ts          # WebSocket type definitions
```

### Frontend (`db-explorer-web/src/`)

```
src/
├── lib/
│   └── websocket/
│       ├── client.ts          # Socket.IO client setup
│       ├── service.ts         # WebSocket service class
│       └── types.ts           # WebSocket type definitions
├── hooks/
│   └── useWebSocket.ts        # React hook for WebSocket
├── stores/
│   └── useChatStore.ts        # Zustand store for chat state
└── components/
    └── connections/
        └── ChatInterface.tsx  # Updated chat UI component
```

## Event Protocol

### Client → Server Events

| Event Name | Payload | Description |
|------------|---------|-------------|
| `chat:message` | `{ messageId, content, connectionId, context? }` | Send a chat message |
| `chat:typing:start` | `{ connectionId }` | User started typing |
| `chat:typing:stop` | `{ connectionId }` | User stopped typing |
| `presence:update` | `{ status, connectionId }` | Update user presence |
| `chat:ack` | `{ messageId }` | Acknowledge message receipt |

### Server → Client Events

| Event Name | Payload | Description |
|------------|---------|-------------|
| `chat:message` | `{ messageId, content, userId, timestamp, status }` | New message received |
| `chat:message:sent` | `{ messageId, timestamp }` | Message sent confirmation |
| `chat:message:error` | `{ messageId, error }` | Message send error |
| `chat:typing` | `{ userId, connectionId, isTyping }` | Typing indicator update |
| `presence:update` | `{ userId, status, connectionId }` | User presence update |
| `connection:status` | `{ status, reconnectAttempts? }` | Connection status update |
| `chat:history` | `{ messages: Message[] }` | Message history on connect |

## Message Schema

### Chat Message

```typescript
interface ChatMessage {
  messageId: string;           // UUID
  userId: string;              // User ID
  connectionId: string;        // Database connection ID
  content: string;             // Message content
  context?: {                   // Optional context
    schema?: string;
    tables?: string[];
    config?: {
      readOnly?: boolean;
      dryRun?: boolean;
    };
  };
  timestamp: number;           // Unix timestamp
  status: 'pending' | 'sending' | 'sent' | 'delivered' | 'error';
  error?: string;              // Error message if status is 'error'
}
```

## Connection Lifecycle

### 1. Connection Establishment

```
Client                    Server
  │                         │
  │─── connect ────────────>│
  │                         │─── authenticate(token)
  │                         │─── validate connection
  │<── authenticated ───────│
  │<── chat:history ────────│
  │                         │
```

### 2. Message Flow

```
Client                    Server
  │                         │
  │─── chat:message ───────>│
  │                         │─── validate & process
  │<── chat:message:sent ───│
  │                         │─── process with db-mcp
  │<── chat:message ────────│ (response)
  │                         │
  │─── chat:ack ───────────>│
  │                         │
```

### 3. Reconnection Flow

```
Client                    Server
  │                         │
  │─── disconnect ─────────>│
  │                         │
  │ (exponential backoff)    │
  │                         │
  │─── reconnect ───────────>│
  │                         │─── authenticate(token)
  │<── authenticated ───────│
  │<── chat:history ────────│
  │                         │
```

## Security Implementation

### Authentication
- JWT token passed via `auth` query parameter or handshake auth
- Token validated using existing Supabase auth middleware
- Unauthenticated connections rejected immediately

### Rate Limiting
- Per-user rate limiting: 30 messages/minute
- Per-connection rate limiting: 60 messages/minute
- Typing events: 10 events/minute
- Exponential backoff on rate limit violations

### Message Validation
- Content length: max 10,000 characters
- Sanitize HTML/script tags
- Validate connectionId belongs to user
- Validate messageId uniqueness

## State Management

### Frontend State (Zustand)

```typescript
interface ChatState {
  // Connection
  isConnected: boolean;
  reconnectAttempts: number;
  
  // Messages
  messages: Map<string, ChatMessage>;
  pendingMessages: Set<string>;
  
  // Typing
  typingUsers: Map<string, { userId: string; timestamp: number }>;
  
  // Presence
  presence: Map<string, 'online' | 'away' | 'offline'>;
  
  // Actions
  sendMessage: (content: string) => Promise<void>;
  retryMessage: (messageId: string) => Promise<void>;
  markAsRead: (messageId: string) => void;
}
```

### Message Queue (Offline Support)

- Messages stored in IndexedDB when offline
- Automatic retry on reconnection
- Queue processed in order
- Max queue size: 100 messages

## Error Handling

### Connection Errors
- Network failures: Exponential backoff retry (1s, 2s, 4s, 8s, 16s, max 30s)
- Authentication failures: Clear token, redirect to login
- Server errors: Retry with backoff, show user notification

### Message Errors
- Failed sends: Store in queue, retry automatically
- Invalid messages: Show error, allow user to edit
- Timeout errors: Retry up to 3 times, then mark as failed

## Monitoring & Logging

### Backend Logging
- Connection events (connect, disconnect, reconnect)
- Message events (sent, received, errors)
- Rate limit violations
- Authentication failures

### Frontend Logging
- Connection state changes
- Message send/receive events
- Error events
- Performance metrics (latency, throughput)

## Health Check

### WebSocket Health Endpoint
- `GET /api/websocket/health`
- Returns: `{ status: 'ok', connectedClients: number, uptime: number }`

## Performance Considerations

### Backend
- Connection pooling for database queries
- Message batching for history retrieval
- In-memory presence cache (Redis-ready for scale)

### Frontend
- Message pagination (load 50 messages at a time)
- Virtual scrolling for large message lists
- Debounced typing indicators (300ms)
- Optimistic UI updates with rollback

## Future Integration Points

### db-mcp Integration
- ChatService will call db-mcp tools for database queries
- Response streaming support for long-running queries
- Query result caching

### Database Persistence
- Store messages in Supabase for history
- Message search and filtering
- Conversation threads

## Testing Strategy

### Unit Tests
- Message validation
- Queue management
- State management

### Integration Tests
- End-to-end message flow
- Reconnection scenarios
- Rate limiting

### Load Tests
- Concurrent connections
- Message throughput
- Memory usage

