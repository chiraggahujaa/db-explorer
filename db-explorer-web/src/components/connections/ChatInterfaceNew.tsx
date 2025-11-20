/**
 * New Chat Interface using Vercel AI SDK
 * Replaces MCP-based architecture with direct AI SDK streaming
 */

"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useChat } from "ai/react";
import { Send, Sparkles, Database, Loader2, Square, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ConnectionWithRole } from "@/types/connection";
import { MessageMarkdown } from "./MessageMarkdown";
import { RetrainSchemaModal } from "./RetrainSchemaModal";
import { useMCPStore } from "@/stores/useMCPStore";
import { useConnectionExplorer } from "@/contexts/ConnectionExplorerContext";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { cn } from "@/utils/ui";

interface ChatInterfaceNewProps {
  connection: ConnectionWithRole;
  chatSessionId?: string;
}

export function ChatInterfaceNew({ connection, chatSessionId }: ChatInterfaceNewProps) {
  const [isRetrainModalOpen, setIsRetrainModalOpen] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Get sidebar selection context
  const { selectedSchema, selectedTables } = useConnectionExplorer();

  // Get chat session state from store
  const {
    currentChatSessionId,
    currentChatSession,
    chatHistory,
    createNewChat,
    loadChatHistory,
    saveChatMessages,
    generateChatTitle,
    clearCurrentChat,
  } = useMCPStore();

  // Use Vercel AI SDK's useChat hook
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit: handleChatSubmit,
    isLoading,
    error,
    stop,
    reload,
    setMessages,
  } = useChat({
    api: '/api/chat',
    body: {
      connectionId: connection.id,
      userId: connection.userId || connection.owner_id,
    },
    onError: (error) => {
      console.error('[ChatInterface] Error:', error);

      // Check if it's a schema training error
      if (error.message.includes('Schema not trained')) {
        setSchemaError('Schema not trained. Please train the schema first.');
        toast.error('Schema not trained', {
          description: 'Please train the database schema to enable AI chat.',
          action: {
            label: 'Train Now',
            onClick: () => setIsRetrainModalOpen(true),
          },
        });
      } else {
        toast.error('Failed to send message', {
          description: error.message,
        });
      }
    },
    onFinish: async (message) => {
      console.log('[ChatInterface] Message completed:', message);

      // Save to chat history
      if (currentChatSessionId) {
        await saveChatMessages(currentChatSessionId, [
          ...messages,
          message
        ].map(m => ({
          id: uuidv4(),
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: new Date().toISOString(),
        })));

        // Generate title for first message if needed
        if (messages.length === 1 && !currentChatSession?.title) {
          await generateChatTitle(currentChatSessionId, messages[0].content);
        }
      }
    },
  });

  // Load chat history on mount
  useEffect(() => {
    const loadExistingChat = async () => {
      if (chatSessionId) {
        console.log('[ChatInterface] Loading existing chat:', chatSessionId);
        await loadChatHistory(chatSessionId);

        // Load history into useChat
        const { chatHistory: loadedHistory } = useMCPStore.getState();
        if (loadedHistory && loadedHistory.length > 0) {
          setMessages(loadedHistory.map((msg: any) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
          })));
        }
      } else {
        console.log('[ChatInterface] Starting new chat');
        clearCurrentChat();
        setMessages([]);
      }
    };

    loadExistingChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatSessionId, connection.id]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!input.trim() || isLoading) {
      return;
    }

    // Create chat session if needed
    if (!currentChatSessionId) {
      console.log('[ChatInterface] Creating new chat session');
      const newSession = await createNewChat(
        connection.id,
        selectedSchema,
        Array.from(selectedTables)
      );

      if (!newSession) {
        toast.error('Failed to create chat session');
        return;
      }
    }

    // Submit to AI
    handleChatSubmit(e);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">AI Assistant</h2>
            <p className="text-xs text-muted-foreground">
              Ask questions about your database
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Schema status */}
          {selectedSchema && (
            <div className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-primary/10 text-primary">
              <Database className="w-3 h-3" />
              <span>{selectedSchema}</span>
            </div>
          )}

          {/* Retrain schema button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsRetrainModalOpen(true)}
            className="h-8 px-2"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Retrain
          </Button>
        </div>
      </div>

      {/* Schema error banner */}
      {schemaError && (
        <div className="px-4 py-3 bg-yellow-500/10 border-b border-yellow-500/20">
          <div className="flex items-start gap-2">
            <Database className="w-4 h-4 text-yellow-500 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-500">Schema Not Trained</p>
              <p className="text-xs text-yellow-500/80 mt-1">
                Train the database schema to enable AI-powered queries.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsRetrainModalOpen(true)}
              className="border-yellow-500/20 hover:bg-yellow-500/10"
            >
              Train Now
            </Button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Start a conversation</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Ask questions about your database schema, query data, or get insights.
            </p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={msg.id || index}
              className={cn(
                "flex gap-3 items-start",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
              )}

              <div
                className={cn(
                  "rounded-lg px-4 py-3 max-w-[80%]",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                {msg.role === "user" ? (
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {msg.content}
                  </p>
                ) : (
                  <MessageMarkdown content={msg.content} />
                )}
              </div>

              {msg.role === "user" && (
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary flex-shrink-0">
                  <span className="text-xs font-medium text-primary-foreground">
                    You
                  </span>
                </div>
              )}
            </div>
          ))
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex gap-3 items-start">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 flex-shrink-0">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div className="rounded-lg px-4 py-3 bg-muted">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="flex gap-3 items-start">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-destructive/10 flex-shrink-0">
              <span className="text-xs font-medium text-destructive">!</span>
            </div>
            <div className="rounded-lg px-4 py-3 bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">{error.message}</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border/50 bg-card/50 backdrop-blur-sm">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your database..."
            className="min-h-[60px] max-h-[120px] resize-none"
            disabled={isLoading || !!schemaError}
          />

          <div className="flex flex-col gap-2">
            {isLoading ? (
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={stop}
                className="h-[60px] w-[60px]"
              >
                <Square className="w-5 h-5" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || !!schemaError}
                className="h-[60px] w-[60px]"
              >
                <Send className="w-5 h-5" />
              </Button>
            )}
          </div>
        </form>

        <p className="text-xs text-muted-foreground mt-2">
          Press Enter to send, Shift + Enter for new line
        </p>
      </div>

      {/* Retrain Modal */}
      <RetrainSchemaModal
        open={isRetrainModalOpen}
        onOpenChange={setIsRetrainModalOpen}
        connection={connection}
        onSuccess={() => {
          setSchemaError(null);
          toast.success('Schema trained successfully');
        }}
      />
    </div>
  );
}
