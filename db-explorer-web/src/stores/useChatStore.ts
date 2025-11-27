/**
 * Chat Store
 * Zustand store for managing chat session state
 * Manages chat sessions, messages, and AI interactions
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { chatSessionsAPI, type ChatSession, type ChatMessage } from '@/lib/api/chatSessions';

interface ChatState {
  // Chat session state
  currentChatSessionId: string | null;
  currentChatSession: ChatSession | null;
  chatHistory: ChatMessage[];

  // Chat session actions
  createNewChat: (connectionId: string, schema?: string, tables?: string[], chatConfig?: any) => Promise<ChatSession | null>;
  loadChatHistory: (chatSessionId: string) => Promise<void>;
  saveChatMessages: (userMessage: string, assistantMessage: string, toolCalls?: any) => Promise<void>;
  updateChatTitle: (title: string) => Promise<void>;
  generateChatTitle: (userMessage: string) => Promise<void>;
  clearCurrentChat: () => void;
}

export const useChatStore = create<ChatState>()(
  devtools(
    (set, get) => ({
      // Initial state
      currentChatSessionId: null,
      currentChatSession: null,
      chatHistory: [],

      // Chat session methods
      createNewChat: async (connectionId, schema, tables, chatConfig) => {
        try {
          const response = await chatSessionsAPI.createChatSession({
            connectionId,
            selectedSchema: schema,
            selectedTables: tables,
            chatConfig: chatConfig,
          });

          if (response.success && response.data) {
            set({
              currentChatSessionId: response.data.id,
              currentChatSession: response.data,
              chatHistory: [],
            });
            return response.data;
          }
          return null;
        } catch (error) {
          console.error('Failed to create new chat:', error);
          return null;
        }
      },

      loadChatHistory: async (chatSessionId) => {
        try {
          const response = await chatSessionsAPI.getChatSession(chatSessionId);

          if (response.success && response.data) {
            set({
              currentChatSessionId: chatSessionId,
              currentChatSession: response.data,
              chatHistory: response.data.chatMessages || [],
            });
          } else {
            // If loading fails, clear the chat state
            console.error('Failed to load chat history');
            set({
              currentChatSessionId: null,
              currentChatSession: null,
              chatHistory: [],
            });
          }
        } catch (error) {
          console.error('Failed to load chat history:', error);
          // Clear chat state on error
          set({
            currentChatSessionId: null,
            currentChatSession: null,
            chatHistory: [],
          });
        }
      },

      saveChatMessages: async (userMessage, assistantMessage, toolCalls) => {
        const { currentChatSessionId } = get();

        if (!currentChatSessionId) {
          console.warn('No active chat session to save messages to');
          return;
        }

        try {
          // Save user message
          await chatSessionsAPI.addMessage(currentChatSessionId, {
            role: 'user',
            content: userMessage,
          });

          // Save assistant message with tool calls
          await chatSessionsAPI.addMessage(currentChatSessionId, {
            role: 'assistant',
            content: assistantMessage,
            toolCalls: toolCalls,
          });

          // Don't append to chatHistory - for new chats, we show streaming messages
          // For resumed chats, messages are already in chatHistory from initial load
          // This prevents duplicate display of messages
        } catch (error) {
          console.error('Failed to save chat messages:', error);
        }
      },

      updateChatTitle: async (title) => {
        const { currentChatSessionId, currentChatSession } = get();

        if (!currentChatSessionId) {
          console.warn('No active chat session to update');
          return;
        }

        try {
          const response = await chatSessionsAPI.updateChatSession(currentChatSessionId, {
            title,
          });

          if (response.success && response.data) {
            set({
              currentChatSession: response.data,
            });
          }
        } catch (error) {
          console.error('Failed to update chat title:', error);
        }
      },

      generateChatTitle: async (userMessage) => {
        const { currentChatSessionId } = get();

        if (!currentChatSessionId) {
          console.warn('[useChatStore] No active chat session to generate title for');
          return;
        }

        try {
          console.log('[useChatStore] Requesting title generation for session:', currentChatSessionId);
          const response = await chatSessionsAPI.generateTitle(currentChatSessionId);

          if (response.success && response.data) {
            console.log('[useChatStore] Title generated successfully:', response.data.title);
            // Update the local state with the new title
            const session = get().currentChatSession;
            if (session) {
              set({
                currentChatSession: { ...session, title: response.data.title },
              });
            }
          } else {
            console.warn('[useChatStore] Title generation failed:', response);
          }
        } catch (error) {
          console.error('[useChatStore] Failed to generate chat title:', error);
        }
      },

      clearCurrentChat: () => {
        set({
          currentChatSessionId: null,
          currentChatSession: null,
          chatHistory: [],
        });
      },
    }),
    { name: 'chat-store' }
  )
);
