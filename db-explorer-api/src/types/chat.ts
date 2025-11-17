import { BaseEntity } from './common.js';

export type ChatMessageRole = 'user' | 'assistant' | 'system';
export type ChatMessageStatus = 'pending' | 'streaming' | 'completed' | 'error';
export type AIProvider = 'gemini' | 'openai' | 'anthropic';

export interface ChatSession extends BaseEntity {
  id: string;
  userId: string;
  connectionId: string;
  title?: string;
  selectedSchema?: string;
  selectedTables?: string[];
  aiProvider: AIProvider;
  lastMessageAt: string;
}

export interface ChatMessage {
  id: string;
  chatSessionId: string;
  role: ChatMessageRole;
  content: string;
  toolCalls?: any; // JSONB field
  status: ChatMessageStatus;
  errorMessage?: string;
  createdAt: string;
}

export interface ChatContextSnapshot extends BaseEntity {
  id: string;
  chatSessionId: string;
  schemaName?: string;
  tablesInfo?: any; // JSONB field
  recentCommands?: string[];
  commandCount: number;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
  result?: any;
  status: 'pending' | 'completed' | 'error';
  error?: string;
}
