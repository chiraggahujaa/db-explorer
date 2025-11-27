/**
 * Chat Interface using Vercel AI SDK v5
 * Built following official AI SDK UI documentation
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { Send, Sparkles, Database, Loader2, Square, RefreshCw, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ConnectionWithRole } from "@/types/connection";
import { MessageMarkdown } from "./MessageMarkdown";
import { RetrainSchemaModal } from "./RetrainSchemaModal";
import { ChatContextSummary } from "./ChatContextSummary";
import { ContextIndicator } from "./ContextIndicator";
import { ToolCallsSidebar } from "./ToolCallsSidebar";
import { ChatConfigPopover } from "./ChatConfigPopover";
import { SQLDisplay } from "./SQLDisplay";
import { useMCPStore } from "@/stores/useMCPStore";
import { useConnectionExplorer } from "@/contexts/ConnectionExplorerContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/utils/ui";
import { getContextManager } from "@/utils/contextManager";

interface ChatInterfaceNewProps {
  connection: ConnectionWithRole;
  chatSessionId?: string;
  onNewChat?: () => void;
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

// Helper to extract text from UIMessage parts
function getMessageText(message: any): string {
  if (typeof message.content === 'string') {
    return message.content;
  }
  if (message.parts && Array.isArray(message.parts)) {
    return message.parts
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text || '')
      .join('');
  }
  return '';
}

// Helper to extract tool calls from UIMessage parts
function getToolCalls(message: any): any[] {
  if (!message.parts || !Array.isArray(message.parts)) {
    return [];
  }
  // Tool parts have type like 'tool-list_tables', 'tool-describe_table', etc.
  // or 'dynamic-tool' for dynamic tools
  return message.parts.filter((part: any) =>
    part.type?.startsWith('tool-') || part.type === 'dynamic-tool'
  );
}

// Helper to extract SQL from tool calls
function extractSQLFromToolCalls(toolCalls: any[]): string[] {
  const sqlQueries: string[] = [];

  for (const toolCall of toolCalls) {
    // Check if this is a query-related tool call
    const toolName = toolCall.type?.replace('tool-', '') || toolCall.toolName;
    const args = toolCall.args || {};

    // Generate SQL based on tool type
    if (toolName === 'select_data' && args.table && args.database) {
      const columns = args.columns?.join(', ') || '*';
      let sql = `SELECT ${columns} FROM \`${args.database}\`.\`${args.table}\``;
      if (args.where) sql += ` WHERE ${args.where}`;
      if (args.orderBy) sql += ` ORDER BY ${args.orderBy}`;
      if (args.limit) sql += ` LIMIT ${args.limit}`;
      if (args.offset) sql += ` OFFSET ${args.offset}`;
      sqlQueries.push(sql);
    } else if (toolName === 'execute_custom_query' && args.sql) {
      sqlQueries.push(args.sql);
    } else if (toolName === 'insert_record' && args.table && args.database && args.data) {
      const columns = Object.keys(args.data).join(', ');
      const values = Object.values(args.data).map((v: any) =>
        typeof v === 'string' ? `'${v}'` : v
      ).join(', ');
      sqlQueries.push(`INSERT INTO \`${args.database}\`.\`${args.table}\` (${columns}) VALUES (${values})`);
    } else if (toolName === 'update_record' && args.table && args.database && args.data && args.where) {
      const setClause = Object.entries(args.data).map(([k, v]) =>
        `${k} = ${typeof v === 'string' ? `'${v}'` : v}`
      ).join(', ');
      sqlQueries.push(`UPDATE \`${args.database}\`.\`${args.table}\` SET ${setClause} WHERE ${args.where}`);
    } else if (toolName === 'delete_record' && args.table && args.database && args.where) {
      sqlQueries.push(`DELETE FROM \`${args.database}\`.\`${args.table}\` WHERE ${args.where}`);
    } else if (toolName === 'count_records' && args.table && args.database) {
      let sql = `SELECT COUNT(*) FROM \`${args.database}\`.\`${args.table}\``;
      if (args.where) sql += ` WHERE ${args.where}`;
      sqlQueries.push(sql);
    }
  }

  return sqlQueries;
}

export function ChatInterfaceNew({ connection, chatSessionId, onNewChat }: ChatInterfaceNewProps) {
  const [input, setInput] = useState("");
  const [isRetrainModalOpen, setIsRetrainModalOpen] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [isToolSidebarOpen, setIsToolSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { chatConfig } = useConnectionExplorer();
  const titleGeneratedRef = useRef<boolean>(false);
  const queryClient = useQueryClient();

  // Get sidebar selection context
  const { selectedSchema, selectedTables } = useConnectionExplorer();

  // Use ref to always get latest selectedSchema and chatConfig values in dynamic body function
  const selectedSchemaRef = useRef(selectedSchema);
  selectedSchemaRef.current = selectedSchema;
  const chatConfigRef = useRef(chatConfig);
  chatConfigRef.current = chatConfig;

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

  // Calculate context window status
  const contextManager = getContextManager();
  const contextWindow = contextManager.getContextWindow(chatHistory);

  // Use Vercel AI SDK's useChat hook (v5 API)
  const {
    messages,
    status,
    error,
    sendMessage,
    stop,
    setMessages,
  } = useChat({
    // CRITICAL: Automatically continue after tool execution completes
    // This ensures the AI generates text responses after calling tools
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      headers: () => {
        // Dynamic header function - called for each request
        const token = typeof window !== 'undefined'
          ? localStorage.getItem('access_token') || sessionStorage.getItem('access_token')
          : null;


        return {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        };
      },
      body: () => {
        // Dynamic body function - called for each request to get latest context
        // Use ref to get the latest selectedSchema and chatConfig values
        const currentSchema = selectedSchemaRef.current;
        const currentChatConfig = chatConfigRef.current;


        return {
          connectionId: connection.id,
          userId: connection.createdBy,
          selectedSchema: currentSchema,
          chatConfig: currentChatConfig,
        };
      },
    }),
    onError: (error) => {
      console.error('[ChatInterface] Error:', error);

      // Check if it's a schema training error
      if (error.message.includes('Schema not trained') || error.message.includes('needsTraining')) {
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
    onFinish: async ({ message }) => {
      console.log('[ChatInterface] Message completed:', message);
      console.log('[ChatInterface] Current messages array length:', messages.length);
      console.log('[ChatInterface] Current chat session ID:', currentChatSessionId);

      // Save to chat history
      if (currentChatSessionId && messages.length > 0) {
        // Get the user message that triggered this response
        // At this point, messages array has: [...previous messages, current user message]
        // The assistant response (message param) is not yet in the messages array
        const userMessage = messages[messages.length - 1];
        const userText = getMessageText(userMessage);
        const assistantText = getMessageText(message);

        console.log('[ChatInterface] Saving messages - User:', userText.substring(0, 50), 'Assistant:', assistantText.substring(0, 50));

        // Save both messages
        await saveChatMessages(userText, assistantText);

        // Invalidate chat history query to refresh the sidebar
        queryClient.invalidateQueries({ queryKey: ["chat-sessions", connection.id] });

        // Generate title for first exchange if needed
        // Check if this is the first exchange (messages.length === 1 means only the user message is in the array)
        if (!titleGeneratedRef.current && messages.length === 1) {
          console.log('[ChatInterface] Generating title for first exchange');
          await generateChatTitle(userText);
          titleGeneratedRef.current = true;
          // Invalidate again after title is generated to update the sidebar with the new title
          queryClient.invalidateQueries({ queryKey: ["chat-sessions", connection.id] });
        }
      }
    },
  });

  // Collect all tool calls from all messages (latest first)
  const allToolCalls = messages
    .flatMap(msg => getToolCalls(msg))
    .reverse(); // Reverse to show latest at top

  // Auto-open sidebar when new tool calls appear - DISABLED
  // useEffect(() => {
  //   if (allToolCalls.length > 0 && !isToolSidebarOpen) {
  //     setIsToolSidebarOpen(true);
  //   }
  // }, [allToolCalls.length, isToolSidebarOpen]);

  // Load chat history on mount
  useEffect(() => {
    const loadExistingChat = async () => {
      if (chatSessionId) {
        console.log('[ChatInterface] Loading existing chat:', chatSessionId);
        await loadChatHistory(chatSessionId);

        // Load history into useChat
        const { chatHistory: loadedHistory } = useMCPStore.getState();
        if (loadedHistory && loadedHistory.length > 0) {
          // Convert to UIMessage format
          const uiMessages = loadedHistory.map((msg: any) => ({
            id: msg.id,
            role: msg.role,
            parts: [{ type: 'text', text: msg.content }],
          }));
          setMessages(uiMessages as any);
          titleGeneratedRef.current = true;
        }
      } else {
        console.log('[ChatInterface] Starting new chat');
        clearCurrentChat();
        setMessages([]);
        titleGeneratedRef.current = false;
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
  }, [messages, status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const messageToSend = input.trim();
    if (!messageToSend || status === 'streaming' || status === 'submitted') {
      return;
    }

    // Create chat session if needed
    if (!currentChatSessionId) {
      console.log('[ChatInterface] Creating new chat session');
      const newSession = await createNewChat(
        connection.id,
        selectedSchema,
        Array.from(selectedTables),
        chatConfig
      );

      if (!newSession) {
        toast.error('Failed to create chat session');
        return;
      }
    }

    // Clear input immediately
    setInput("");

    // Send message using AI SDK v5 API
    sendMessage({ text: messageToSend });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const handleExampleClick = (exampleText: string) => {
    setInput(exampleText);
  };

  const isLoading = status === 'streaming' || status === 'submitted';
  const hasMessages = messages.length > 0;
  const isResumingChat = chatSessionId && chatHistory.length > 0;

  return (
    <>
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-gradient-to-b from-background to-muted/20">
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (onNewChat) {
                    onNewChat();
                  } else {
                    // Fallback: Clear current chat state locally
                    clearCurrentChat();
                    setMessages([]);
                    titleGeneratedRef.current = false;
                  }
                  toast.success('New session started', {
                    description: 'Previous chat cleared. Start a fresh conversation.',
                  });
                }}
                title="Start a new chat session without previous context"
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New Session</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRetrainModalOpen(true)}
                title="Re-train schema cache for AI understanding"
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Re-train Schema</span>
              </Button>

              {/* Context Window Indicator */}
              {chatHistory.length > 0 && (
                <ContextIndicator
                  percentageUsed={contextWindow.percentageUsed}
                  totalTokens={contextWindow.totalTokens}
                  maxTokens={contextManager.getConfig().maxTokens}
                  messageCount={chatHistory.length}
                />
              )}

              {/* Connection Status */}
              {schemaError ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/30">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 dark:bg-red-400" />
                  <span className="text-xs font-medium text-red-700 dark:text-red-400">Not Trained</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/30">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 dark:bg-green-400 animate-pulse" />
                  <span className="text-xs font-medium text-green-700 dark:text-green-400">Ready</span>
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
              {!schemaError && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
                  <button
                    onClick={() => handleExampleClick("Show me all tables in this database")}
                    className="p-4 text-left rounded-lg border bg-card hover:bg-accent transition-colors"
                  >
                    <div className="font-medium text-sm mb-1">Explore Schema</div>
                    <div className="text-xs text-muted-foreground">Show me all tables in this database</div>
                  </button>
                  <button
                    onClick={() => handleExampleClick("SELECT * FROM users LIMIT 5")}
                    className="p-4 text-left rounded-lg border bg-card hover:bg-accent transition-colors"
                  >
                    <div className="font-medium text-sm mb-1">Query Data</div>
                    <div className="text-xs text-muted-foreground">SELECT * FROM users LIMIT 5</div>
                  </button>
                  <button
                    onClick={() => handleExampleClick("What are the foreign key relationships?")}
                    className="p-4 text-left rounded-lg border bg-card hover:bg-accent transition-colors"
                  >
                    <div className="font-medium text-sm mb-1">Analyze Relationships</div>
                    <div className="text-xs text-muted-foreground">What are the foreign key relationships?</div>
                  </button>
                  <button
                    onClick={() => handleExampleClick("Show table statistics")}
                    className="p-4 text-left rounded-lg border bg-card hover:bg-accent transition-colors"
                  >
                    <div className="font-medium text-sm mb-1">Get Statistics</div>
                    <div className="text-xs text-muted-foreground">Show table statistics</div>
                  </button>
                </div>
              )}

              {/* No Schema Selected Info */}
              {!schemaError && !selectedSchema && (
                <div className="mt-4 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-start gap-2">
                    <Database className="w-5 h-5 text-blue-500 mt-0.5" />
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-blue-500">Tip: Select a Database</p>
                      <p className="text-xs text-blue-500/80 mt-1">
                        Select a database from the sidebar to enable context-aware queries like "list tables" without specifying which database.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Schema Error Banner */}
              {schemaError && (
                <div className="mt-4 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <div className="flex items-start gap-2">
                    <Database className="w-5 h-5 text-yellow-500 mt-0.5" />
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-yellow-500">Schema Not Trained</p>
                      <p className="text-xs text-yellow-500/80 mt-1">
                        Train the database schema to enable AI-powered queries.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsRetrainModalOpen(true)}
                        className="mt-3 border-yellow-500/20 hover:bg-yellow-500/10"
                      >
                        Train Now
                      </Button>
                    </div>
                  </div>
                </div>
              )}
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

              {/* Messages */}
              {messages.map((msg, index) => {
                const messageText = getMessageText(msg);
                const toolCalls = getToolCalls(msg);
                const sqlQueries = chatConfig.showSQLGeneration ? extractSQLFromToolCalls(toolCalls) : [];

                // Skip rendering if there's no text (only tool calls)
                if (!messageText && msg.role === 'assistant') {
                  return null;
                }

                return (
                  <div key={msg.id || index}>
                    {msg.role === 'user' ? (
                      // User message
                      <div className="flex justify-end mb-4">
                        <div className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm">
                          <CollapsibleMessage content={messageText} />
                        </div>
                      </div>
                    ) : (
                      // AI Response - only show text, tool calls are in sidebar
                      <div className="flex gap-3 mb-4">
                        <div className="flex-shrink-0">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 dark:from-blue-600 dark:to-purple-700 shadow-sm">
                            {isLoading && index === messages.length - 1 ? (
                              <Loader2 className="w-4 h-4 text-white animate-spin" />
                            ) : (
                              <Sparkles className="w-4 h-4 text-white" />
                            )}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          {/* Show SQL if enabled */}
                          {sqlQueries.length > 0 && (
                            <div className="mb-2">
                              {sqlQueries.map((sql, sqlIndex) => (
                                <SQLDisplay key={sqlIndex} sql={sql} />
                              ))}
                            </div>
                          )}
                          <div className="bg-card rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border">
                            <MessageMarkdown content={messageText} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Loading indicator for new message */}
              {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
                <div className="flex gap-3 mb-4">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="bg-card rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Thinking...</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="flex gap-3 mb-4">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-destructive/20">
                      <span className="text-sm font-medium text-destructive">!</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="bg-destructive/10 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-destructive/20">
                      <p className="text-sm text-destructive">{error.message}</p>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* Chat Input */}
      <div className="flex-shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-4xl mx-auto px-2 py-4">
          <form onSubmit={handleSubmit} className="flex gap-2 items-end">
            {/* Configuration Popover */}
            <ChatConfigPopover />

            <div className="relative flex-1">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  schemaError
                    ? "Please train the schema first..."
                    : "Ask a question or write SQL... (Shift + Enter for new line)"
                }
                className="pr-12 min-h-12 max-h-40 resize-none rounded-2xl border-2 focus-visible:ring-2 focus-visible:ring-primary py-3"
                disabled={isLoading || !!schemaError}
                rows={1}
              />
              {isLoading && (
                <div className="absolute right-4 top-3">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>

            {isLoading ? (
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={stop}
                className="h-12 w-12 rounded-2xl flex-shrink-0"
              >
                <Square className="w-5 h-5" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || !!schemaError}
                className="h-12 w-12 rounded-2xl flex-shrink-0 bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              >
                <Send className="w-5 h-5" />
              </Button>
            )}
          </form>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Press Enter to send, Shift + Enter for new line
          </p>
        </div>
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

      {/* Tool Calls Sidebar - Always render to show icon bar */}
      <ToolCallsSidebar
        toolCalls={allToolCalls}
        isOpen={isToolSidebarOpen}
        onToggle={() => setIsToolSidebarOpen(!isToolSidebarOpen)}
      />
    </>
  );
}
