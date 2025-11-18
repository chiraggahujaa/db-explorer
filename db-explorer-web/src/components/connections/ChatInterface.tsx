"use client";

import { useState, FormEvent, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { Send, Sparkles, Database, Loader2, Square, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ConnectionWithRole } from "@/types/connection";
import { useMCP } from "@/hooks/useMCP";
import { getAIService, type AIStreamEvent, getCurrentAIProvider } from "@/services/AIService";
import {
  useStreamingMessages,
  usePendingPermissions,
} from "@/stores/useMCPStore";
import { useMCPStore } from "@/stores/useMCPStore";
import { StreamingMessage } from "./StreamingMessage";
import { PermissionDialog } from "./PermissionDialog";
import { ChatContextSummary } from "./ChatContextSummary";
import { MessageMarkdown } from "./MessageMarkdown";
import { useConnectionExplorer } from "@/contexts/ConnectionExplorerContext";
import { cn } from "@/utils/ui";
import { buildSystemPrompt } from "@/utils/chatPrompts";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import { createToolCallData } from "@/utils/sqlExtractor";

interface ChatInterfaceProps {
  connection: ConnectionWithRole;
  chatSessionId?: string;
}

// Collapsible message component for long user messages
function CollapsibleMessage({ content, maxLines = 3 }: { content: string; maxLines?: number }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const lines = content.split('\n');
  const shouldCollapse = lines.length > maxLines || content.length > 200;

  if (!shouldCollapse) {
    return <p className="text-sm whitespace-pre-wrap break-words">{content}</p>;
  }

  const previewContent = isExpanded
    ? content
    : lines.slice(0, maxLines).join('\n') + (lines.length > maxLines ? '...' : '');

  return (
    <div className="space-y-2">
      <p className="text-sm whitespace-pre-wrap break-words">{previewContent}</p>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1 text-xs text-primary-foreground/80 hover:text-primary-foreground transition-colors"
      >
        {isExpanded ? (
          <>
            <ChevronUp className="w-3 h-3" />
            Show less
          </>
        ) : (
          <>
            <ChevronDown className="w-3 h-3" />
            Show more
          </>
        )}
      </button>
    </div>
  );
}

export function ChatInterface({ connection, chatSessionId }: ChatInterfaceProps) {
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentMessageIdRef = useRef<string | null>(null);
  const titleGeneratedRef = useRef<boolean>(false);

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

  // MCP integration
  const {
    executeQuery,
    respondToPermission,
    isConnected: isMCPConnected,
    isConnecting: isMCPConnecting,
  } = useMCP({
    connection: connection,
    autoConnect: true,
  });

  const streamingMessages = useStreamingMessages(connection.id);
  const pendingPermissions = usePendingPermissions(connection.id);

  // Load chat history on mount if chatSessionId is provided
  useEffect(() => {
    // IMPORTANT: Always clear MCP state (streaming messages, permissions) when chatSessionId changes
    // This ensures proper segregation between different chat views
    const { clearMCPState } = useMCPStore.getState();
    clearMCPState(connection.id);

    // Clear AI service history for a fresh start
    const aiService = getAIService();
    aiService.clearHistory();
    console.log('[ChatInterface] Chat session changed, cleared MCP state and AI history');

    if (chatSessionId) {
      // Loading an existing chat from history
      console.log('[ChatInterface] Loading existing chat:', chatSessionId);
      loadChatHistory(chatSessionId);
      titleGeneratedRef.current = true; // Existing chat, title already generated
    } else {
      // Starting a new chat (no chatSessionId in URL)
      console.log('[ChatInterface] Starting new chat view');
      clearCurrentChat();
      titleGeneratedRef.current = false; // New chat, title not generated yet
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatSessionId, connection.id]); // Depend on chatSessionId changes

  // Clear AI conversation history when schema changes (only during active chat, not on mount)
  useEffect(() => {
    // Skip clearing on mount - the main effect above already handles it
    // Only clear when schema actively changes during a chat session
    if (selectedSchema && (chatHistory.length > 0 || streamingMessages.length > 0)) {
      const aiService = getAIService();
      aiService.clearHistory();
      console.log('[ChatInterface] Schema changed during active chat to:', selectedSchema, '- Cleared AI history');
    }
  }, [selectedSchema]); // Note: intentionally not including chatHistory/streamingMessages in deps

  // Auto-scroll to bottom when new messages or MCP events arrive
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [streamingMessages, pendingPermissions, chatHistory]);

  const handleStop = () => {
    if (abortControllerRef.current && currentMessageIdRef.current) {
      console.log('[ChatInterface] Stopping chat request');
      abortControllerRef.current.abort();

      // Mark the message as cancelled in the store
      const { cancelStreaming } = useMCPStore.getState();
      cancelStreaming(currentMessageIdRef.current);

      // Clean up
      abortControllerRef.current = null;
      currentMessageIdRef.current = null;
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
    // Allow Shift + Enter to create new line (default textarea behavior)
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!message.trim() || isSubmitting || !isMCPConnected) {
      return;
    }

    setIsSubmitting(true);
    const { addStreamingMessage, addChunk, addToolCall, updateToolCallResult, completeStreaming, setStreamingError } = useMCPStore.getState();

    // Create new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const content = message.trim();
      setMessage("");

      // Create chat session if this is the first message and no session exists
      if (!currentChatSessionId) {
        console.log('[ChatInterface] Creating new chat session');
        const newSession = await createNewChat(
          connection.id,
          selectedSchema,
          Array.from(selectedTables)
        );

        if (!newSession) {
          toast.error('Failed to create chat session');
          setIsSubmitting(false);
          return;
        }
      }

      // Create a streaming message for AI response
      const messageId = uuidv4();
      currentMessageIdRef.current = messageId;

      const currentProvider = getCurrentAIProvider() || 'gemini';
      addStreamingMessage({
        messageId,
        connectionId: connection.id,
        tool: `${currentProvider}_query`,
        arguments: { query: content },
        timestamp: Date.now(),
        status: 'streaming',
        chunks: [],
        fullText: '',
        toolCalls: [],
      });

      // Get AI service and send message
      const aiService = getAIService();

      // Build system prompt with connection context
      const systemPrompt = buildSystemPrompt({
        connection,
        selectedSchema: selectedSchema || undefined,
        selectedTables,
      });

      await aiService.sendMessageWithSystem(
        content,
        systemPrompt,
        connection.id,
        selectedSchema || null,
        async (event: AIStreamEvent) => {
          switch (event.type) {
            case 'text':
              if (event.content) {
                // This prevents React from batching updates and shows true streaming
                const chunk = event.content;
                flushSync(() => {
                  addChunk(messageId, chunk);
                });
              }
              break;

            case 'tool_use':
              // Create tool call data and add to store
              if (event.toolName && event.toolCallId) {
                const toolCallData = createToolCallData(
                  event.toolCallId,
                  event.toolName,
                  event.toolInput || {}
                );
                flushSync(() => {
                  addToolCall(messageId, toolCallData);
                });
              }
              break;

            case 'tool_result':
              // Update tool call with result
              if (event.toolCallId && event.toolResult) {
                const toolCallId = event.toolCallId;
                const toolResult = event.toolResult;
                flushSync(() => {
                  updateToolCallResult(messageId, toolCallId, toolResult);
                });
              }
              console.log('[ChatInterface] Tool executed:', event.toolName);
              break;

            case 'done':
              completeStreaming(messageId, { success: true });

              // Save messages to database after completion
              const streamingMsg = useMCPStore.getState().streamingMessages.get(messageId);
              if (streamingMsg) {
                const assistantMessage = streamingMsg.fullText;
                const toolCalls = streamingMsg.toolCalls.length > 0 ? streamingMsg.toolCalls : undefined;

                // Save both user and assistant messages
                await saveChatMessages(content, assistantMessage, toolCalls);

                // Generate title for new chats after first message is saved
                const sessionId = useMCPStore.getState().currentChatSessionId;
                if (!titleGeneratedRef.current && sessionId) {
                  console.log('[ChatInterface] Generating title for new chat session:', sessionId);
                  await generateChatTitle(content);
                  titleGeneratedRef.current = true;
                }
              }
              break;

            case 'error':
              setStreamingError(messageId, event.error || 'Unknown error');
              break;
          }
        },
        abortController.signal
      );
    } catch (error: any) {
      // Don't show error if request was aborted
      if (error.name === 'AbortError' || abortController.signal.aborted) {
        console.log('[ChatInterface] Request was cancelled by user');
        return;
      }

      console.error("Failed to send message to AI:", error);
      // Show error to user
      if (error.message?.includes('API key')) {
        const provider = getCurrentAIProvider() || 'AI';
        const envVar = provider === 'gemini' ? 'NEXT_PUBLIC_GEMINI_API_KEY' : 'NEXT_PUBLIC_ANTHROPIC_API_KEY';
        toast.error(`${provider.toUpperCase()} API Key Missing`, {
          description: `Please set ${envVar} in your .env.local file.`,
          duration: 5000,
        });
      } else {
        toast.error('Failed to send message', {
          description: error.message || 'An unexpected error occurred',
          duration: 4000,
        });
      }
    } finally {
      // Clean up
      abortControllerRef.current = null;
      currentMessageIdRef.current = null;
      setIsSubmitting(false);
    }
  };

  const hasMessages = chatHistory.length > 0 || streamingMessages.length > 0 || pendingPermissions.length > 0;
  const isResumingChat = chatSessionId && chatHistory.length > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-4xl mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
                <Database className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-base font-semibold">{connection.name}</h1>
                {connection.description && (
                  <p className="text-xs text-muted-foreground">{connection.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isMCPConnecting ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
                  <Loader2 className="w-2.5 h-2.5 text-yellow-600 dark:text-yellow-400 animate-spin" />
                  <span className="text-xs font-medium text-yellow-700 dark:text-yellow-400">Connecting...</span>
                </div>
              ) : isMCPConnected ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/30">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 dark:bg-green-400 animate-pulse" />
                  <span className="text-xs font-medium text-green-700 dark:text-green-400">Connected</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/30">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 dark:bg-red-400" />
                  <span className="text-xs font-medium text-red-700 dark:text-red-400">Disconnected</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chat Content Area - Scrollable */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
        {!hasMessages ? (
          // Welcome Screen - centered in full available height
          <div className="h-full flex items-center justify-center px-4">
            <div className="w-full max-w-2xl mx-auto text-center">
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 dark:from-blue-600 dark:to-purple-700 mb-4 shadow-lg">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
              </div>
              <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                Ask me anything about your database
              </h2>
              <p className="text-muted-foreground mx-auto max-w-md mb-8">
                I can help you explore schemas, query data, analyze tables, and more.
                Just ask in natural language or write SQL directly.
              </p>

              {/* Example Prompts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
                <button
                  onClick={() => setMessage("Show me all tables in this database")}
                  className="p-4 text-left rounded-lg border bg-card hover:bg-accent transition-colors"
                >
                  <div className="font-medium text-sm mb-1">Explore Schema</div>
                  <div className="text-xs text-muted-foreground">Show me all tables in this database</div>
                </button>
                <button
                  onClick={() => setMessage("SELECT * FROM users LIMIT 5")}
                  className="p-4 text-left rounded-lg border bg-card hover:bg-accent transition-colors"
                >
                  <div className="font-medium text-sm mb-1">Query Data</div>
                  <div className="text-xs text-muted-foreground">SELECT * FROM users LIMIT 5</div>
                </button>
                <button
                  onClick={() => setMessage("What are the foreign key relationships?")}
                  className="p-4 text-left rounded-lg border bg-card hover:bg-accent transition-colors"
                >
                  <div className="font-medium text-sm mb-1">Analyze Relationships</div>
                  <div className="text-xs text-muted-foreground">What are the foreign key relationships?</div>
                </button>
                <button
                  onClick={() => setMessage("Show table statistics")}
                  className="p-4 text-left rounded-lg border bg-card hover:bg-accent transition-colors"
                >
                  <div className="font-medium text-sm mb-1">Get Statistics</div>
                  <div className="text-xs text-muted-foreground">Show table statistics</div>
                </button>
              </div>
            </div>
          </div>
        ) : (
          // Messages
          <div className="container max-w-4xl mx-auto px-2 py-6">
            <div className="space-y-6 py-4">
              {/* Show context summary when resuming a chat */}
              {isResumingChat && (
                <ChatContextSummary chatSessionId={chatSessionId!} className="mb-4" />
              )}

              {/* Historical Messages from database */}
              {chatHistory.map((historyMsg) => (
                <div key={historyMsg.id}>
                  {historyMsg.role === 'user' ? (
                    // User message
                    <div className="flex justify-end mb-4">
                      <div className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm">
                        <CollapsibleMessage content={historyMsg.content} />
                      </div>
                    </div>
                  ) : historyMsg.role === 'assistant' ? (
                    // AI Response
                    <div className="flex gap-3 mb-4">
                      <div className="flex-shrink-0">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 dark:from-blue-600 dark:to-purple-700 shadow-sm">
                          <Sparkles className="w-4 h-4 text-white" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="bg-card rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border">
                          <MessageMarkdown content={historyMsg.content} />
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}

              {/* Current Streaming Messages */}
              {streamingMessages.map((streamMsg, index) => (
                <div key={streamMsg.messageId}>
                  {/* User message */}
                  <div className="flex justify-end mb-4">
                    <div className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm">
                      <CollapsibleMessage
                        content={
                          streamMsg.tool === 'claude_query' || streamMsg.tool === 'gemini_query'
                            ? streamMsg.arguments.query
                            : streamMsg.tool === 'execute_custom_query'
                            ? streamMsg.arguments.sql
                            : `/${streamMsg.tool} ${JSON.stringify(streamMsg.arguments)}`
                        }
                      />
                    </div>
                  </div>

                  {/* AI Response */}
                  <div className="flex gap-3 mb-4">
                    <div className="flex-shrink-0">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
                        {streamMsg.status === 'streaming' ? (
                          <Loader2 className="w-4 h-4 text-white animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4 text-white" />
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <StreamingMessage message={streamMsg} className="shadow-sm" />
                    </div>
                  </div>
                </div>
              ))}

              {/* Permission requests */}
              {pendingPermissions.map((perm) => (
                <div key={perm.messageId} className="flex gap-3">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500 dark:bg-yellow-600 shadow-sm">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <PermissionDialog
                      permission={perm}
                      onApprove={(alwaysAllow) => respondToPermission(perm.messageId, true, alwaysAllow)}
                      onDeny={() => respondToPermission(perm.messageId, false)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Chat Input */}
      <div className="flex-shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-4xl mx-auto px-2 py-4">
          <form onSubmit={handleSubmit} className="flex gap-3 items-end">
            <div className="relative flex-1">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isMCPConnecting
                    ? "Connecting to database..."
                    : !isMCPConnected
                    ? "Not connected"
                    : "Ask a question or write SQL... (Shift + Enter for new line)"
                }
                className="pr-12 min-h-12 max-h-40 resize-none rounded-2xl border-2 focus-visible:ring-2 focus-visible:ring-primary py-3"
                disabled={isSubmitting || !isMCPConnected || isMCPConnecting}
                rows={1}
              />
              {isSubmitting && (
                <div className="absolute right-4 top-3">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
            {isSubmitting ? (
              <Button
                type="button"
                size="lg"
                onClick={handleStop}
                className="rounded-full w-12 h-12 p-0 bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white shadow-lg"
              >
                <Square className="w-5 h-5" />
                <span className="sr-only">Stop</span>
              </Button>
            ) : (
              <Button
                type="submit"
                size="lg"
                disabled={!message.trim() || isSubmitting || !isMCPConnected || isMCPConnecting}
                className="rounded-full w-12 h-12 p-0"
              >
                <Send className="w-5 h-5" />
                <span className="sr-only">Send message</span>
              </Button>
            )}
          </form>
          
          <p className="text-xs text-center text-muted-foreground mt-2">
            Powered by {getCurrentAIProvider() === 'gemini' ? 'Gemini' : 'Claude'} AI with MCP tools • Ask in natural language or write SQL directly
          </p>
        </div>
      </div>
    </div>
  );
}
