import api from './axios';

export interface ChatSession {
  id: string;
  userId: string;
  connectionId: string;
  title?: string;
  selectedSchema?: string;
  selectedTables?: string[];
  aiProvider: 'gemini' | 'openai' | 'anthropic';
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  chatSessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: any;
  status: 'pending' | 'streaming' | 'completed' | 'error';
  errorMessage?: string;
  createdAt: string;
}

export interface ChatSessionWithMessages extends ChatSession {
  chatMessages: ChatMessage[];
}

export interface CreateChatSessionRequest {
  connectionId: string;
  title?: string;
  selectedSchema?: string;
  selectedTables?: string[];
  aiProvider?: 'gemini' | 'openai' | 'anthropic';
}

export interface UpdateChatSessionRequest {
  title?: string;
  selectedSchema?: string;
  selectedTables?: string[];
  connectionId?: string;
  aiProvider?: 'gemini' | 'openai' | 'anthropic';
}

export interface AddMessageRequest {
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: any;
  status?: 'pending' | 'streaming' | 'completed' | 'error';
  errorMessage?: string;
}

export interface ChatSessionsResponse {
  success: boolean;
  data: ChatSession[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ChatSessionResponse {
  success: boolean;
  data: ChatSessionWithMessages;
}

export interface MessageResponse {
  success: boolean;
  data: ChatMessage;
  message?: string;
}

export interface ContextResponse {
  success: boolean;
  data: string;
}

export interface TitleResponse {
  success: boolean;
  data: {
    title: string;
  };
  message?: string;
}

export interface ActionResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export const chatSessionsAPI = {
  // Get all chat sessions for the current user
  getMyChatSessions: async (page = 1, limit = 50): Promise<ChatSessionsResponse> => {
    const res = await api.get('/api/chat-sessions', {
      params: { page, limit },
    });
    return res.data;
  },

  // Get a single chat session with messages
  getChatSession: async (id: string): Promise<ChatSessionResponse> => {
    const res = await api.get(`/api/chat-sessions/${id}`);
    return res.data;
  },

  // Create a new chat session
  createChatSession: async (data: CreateChatSessionRequest): Promise<ChatSessionResponse> => {
    const res = await api.post('/api/chat-sessions', data);
    return res.data;
  },

  // Update a chat session
  updateChatSession: async (
    id: string,
    data: UpdateChatSessionRequest
  ): Promise<ChatSessionResponse> => {
    const res = await api.patch(`/api/chat-sessions/${id}`, data);
    return res.data;
  },

  // Delete a chat session
  deleteChatSession: async (id: string): Promise<ActionResponse> => {
    const res = await api.delete(`/api/chat-sessions/${id}`);
    return res.data;
  },

  // Add a message to a chat session
  addMessage: async (chatSessionId: string, data: AddMessageRequest): Promise<MessageResponse> => {
    const res = await api.post(`/api/chat-sessions/${chatSessionId}/messages`, data);
    return res.data;
  },

  // Get context summary for a chat session
  getContext: async (chatSessionId: string): Promise<ContextResponse> => {
    const res = await api.get(`/api/chat-sessions/${chatSessionId}/context`);
    return res.data;
  },

  // Generate title for a chat session
  generateTitle: async (chatSessionId: string): Promise<TitleResponse> => {
    const res = await api.post(`/api/chat-sessions/${chatSessionId}/generate-title`);
    return res.data;
  },

  // Get chat sessions by connection ID
  getChatSessionsByConnection: async (
    connectionId: string,
    page = 1,
    limit = 50
  ): Promise<ChatSessionsResponse> => {
    const res = await api.get(`/api/connections/${connectionId}/chat-sessions`, {
      params: { page, limit },
    });
    return res.data;
  },
};
