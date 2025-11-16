"use client";

import { useState, FormEvent, useEffect, useRef } from "react";
import { Send, Sparkles, Database, Loader2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useConnectionExplorer } from "@/contexts/ConnectionExplorerContext";
import { cn } from "@/utils/ui";
import { buildSystemPrompt } from "@/utils/chatPrompts";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import { createToolCallData } from "@/utils/sqlExtractor";

interface ChatInterfaceProps {
  connection: ConnectionWithRole;
}

export function ChatInterface({ connection }: ChatInterfaceProps) {
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentMessageIdRef = useRef<string | null>(null);

  // Get sidebar selection context
  const { selectedSchema, selectedTables } = useConnectionExplorer();

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

  // Clear AI conversation history when schema changes
  useEffect(() => {
    if (selectedSchema) {
      const aiService = getAIService();
      aiService.clearHistory();
      console.log('[ChatInterface] Schema changed to:', selectedSchema, '- Cleared conversation history');
    }
  }, [selectedSchema]);

  // Auto-scroll to bottom when new messages or MCP events arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [streamingMessages, pendingPermissions]);

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
        (event: AIStreamEvent) => {
          switch (event.type) {
            case 'text':
              if (event.content) {
                addChunk(messageId, event.content);
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
                addToolCall(messageId, toolCallData);
              }
              break;

            case 'tool_result':
              // Update tool call with result
              if (event.toolCallId && event.toolResult) {
                updateToolCallResult(messageId, event.toolCallId, event.toolResult);
              }
              console.log('[ChatInterface] Tool executed:', event.toolName);
              break;

            case 'done':
              completeStreaming(messageId, { success: true });
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

  const hasMessages = streamingMessages.length > 0 || pendingPermissions.length > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
                <Database className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">{connection.name}</h1>
                {connection.description && (
                  <p className="text-sm text-muted-foreground">{connection.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isMCPConnecting ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
                  <Loader2 className="w-3 h-3 text-yellow-600 animate-spin" />
                  <span className="text-xs font-medium text-yellow-700 dark:text-yellow-400">Connecting...</span>
                </div>
              ) : isMCPConnected ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs font-medium text-green-700 dark:text-green-400">Connected</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-900/30">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-xs font-medium text-red-700 dark:text-red-400">Disconnected</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chat Content Area - Scrollable */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
        <div className="container max-w-4xl mx-auto px-2 py-6">
          {!hasMessages ? (
            // Welcome Screen
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 mb-4">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
              </div>
              <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Ask me anything about your database
              </h2>
              <p className="text-muted-foreground max-w-md mb-8">
                I can help you explore schemas, query data, analyze tables, and more.
                Just ask in natural language or write SQL directly.
              </p>
              
              {/* Example Prompts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
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
          ) : (
            // Messages
            <div className="space-y-6 py-4">
              {/* User Input Messages (show what was asked) */}
              {streamingMessages.map((streamMsg, index) => (
                <div key={streamMsg.messageId}>
                  {/* User message */}
                  <div className="flex justify-end mb-4">
                    <div className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm">
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {streamMsg.tool === 'claude_query' || streamMsg.tool === 'gemini_query'
                          ? streamMsg.arguments.query 
                          : streamMsg.tool === 'execute_custom_query'
                          ? streamMsg.arguments.sql
                          : `/${streamMsg.tool} ${JSON.stringify(streamMsg.arguments)}`
                        }
                      </p>
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
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500">
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

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Chat Input */}
      <div className="flex-shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-4xl mx-auto px-2 py-4">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <div className="relative flex-1">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  isMCPConnecting
                    ? "Connecting to database..."
                    : !isMCPConnected
                    ? "Not connected"
                    : "Ask a question or write SQL..."
                }
                className="pr-12 h-12 rounded-full border-2 focus-visible:ring-2 focus-visible:ring-primary"
                disabled={isSubmitting || !isMCPConnected || isMCPConnecting}
              />
              {isSubmitting && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
            {isSubmitting ? (
              <Button
                type="button"
                size="lg"
                onClick={handleStop}
                className="rounded-full w-12 h-12 p-0 bg-red-500 hover:bg-red-600 text-white"
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
