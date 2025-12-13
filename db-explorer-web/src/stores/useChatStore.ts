import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { chatSessionsAPI, type ChatSession, type ChatMessage } from '@/lib/api/chatSessions';

interface ChatState {
  currentChatSessionId: string | null;
  currentChatSession: ChatSession | null;
  chatHistory: ChatMessage[];

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
      currentChatSessionId: null,
      currentChatSession: null,
      chatHistory: [],

      createNewChat: async (connectionId, schema, tables, chatConfig) => {
        try {
          console.log('[useChatStore] Creating new chat session with:', {
            connectionId,
            schema,
            tables,
            chatConfig
          });

          if (!connectionId) {
            console.error('[useChatStore] Connection ID is required but was not provided');
            return null;
          }

          const response = await chatSessionsAPI.createChatSession({
            connectionId,
            selectedSchema: schema,
            selectedTables: tables,
            chatConfig: chatConfig,
          });

          console.log('[useChatStore] Create chat session response:', response);

          if (response.success && response.data) {
            console.log('[useChatStore] Chat session created successfully:', response.data.id);
            set({
              currentChatSessionId: response.data.id,
              currentChatSession: response.data,
              chatHistory: [],
            });
            return response.data;
          } else {
            console.error('[useChatStore] Failed to create chat session - response not successful');
            return null;
          }
        } catch (error) {
          console.error('[useChatStore] Exception while creating new chat:', error);
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
            console.error('Failed to load chat history');
            set({
              currentChatSessionId: null,
              currentChatSession: null,
              chatHistory: [],
            });
          }
        } catch (error) {
          console.error('Failed to load chat history:', error);
          set({
            currentChatSessionId: null,
            currentChatSession: null,
            chatHistory: [],
          });
        }
      },

      saveChatMessages: async (userMessage, assistantMessage, toolCalls) => {
        const { currentChatSessionId } = get();

        console.log('[useChatStore] Attempting to save messages for session:', currentChatSessionId);
        console.log('[useChatStore] User message length:', userMessage?.length || 0);
        console.log('[useChatStore] Assistant message length:', assistantMessage?.length || 0);

        if (!currentChatSessionId) {
          console.error('[useChatStore] No active chat session to save messages to');
          return;
        }

        if (!userMessage || !assistantMessage) {
          console.error('[useChatStore] User message or assistant message is empty', {
            userMessage: userMessage?.substring(0, 50),
            assistantMessage: assistantMessage?.substring(0, 50)
          });
          return;
        }

        try {
          console.log('[useChatStore] Saving user message...');
          const userResponse = await chatSessionsAPI.addMessage(currentChatSessionId, {
            role: 'user',
            content: userMessage,
          });
          console.log('[useChatStore] User message saved:', userResponse);

          console.log('[useChatStore] Saving assistant message...');
          const assistantResponse = await chatSessionsAPI.addMessage(currentChatSessionId, {
            role: 'assistant',
            content: assistantMessage,
            toolCalls: toolCalls,
          });
          console.log('[useChatStore] Assistant message saved:', assistantResponse);
        } catch (error) {
          console.error('[useChatStore] Failed to save chat messages:', error);
          throw error;
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

        console.log('[useChatStore] generateChatTitle called with:', {
          currentChatSessionId,
          userMessageLength: userMessage?.length || 0
        });

        if (!currentChatSessionId) {
          console.error('[useChatStore] No active chat session to generate title for');
          return;
        }

        if (!userMessage || userMessage.trim().length === 0) {
          console.error('[useChatStore] User message is empty, cannot generate title');
          return;
        }

        try {
          console.log('[useChatStore] Requesting title generation for session:', currentChatSessionId);
          console.log('[useChatStore] First 100 chars of user message:', userMessage.substring(0, 100));

          const response = await chatSessionsAPI.generateTitle(currentChatSessionId);

          console.log('[useChatStore] Title generation response:', response);

          if (response.success && response.data) {
            console.log('[useChatStore] Title generated successfully:', response.data.title);
            const session = get().currentChatSession;
            if (session) {
              set({
                currentChatSession: { ...session, title: response.data.title },
              });
            }
          } else {
            console.error('[useChatStore] Title generation failed - response not successful');
          }
        } catch (error) {
          console.error('[useChatStore] Exception during title generation:', error);
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
