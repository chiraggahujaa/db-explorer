"use client";

import { useState, FormEvent, useEffect, useRef } from "react";
import { Send, Settings, Database, Table as TableIcon, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ConnectionWithRole } from "@/types/connection";
import { useConnectionExplorer } from "@/contexts/ConnectionExplorerContext";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useChatMessages, useConnectionStatus } from "@/stores/useChatStore";
import { cn } from "@/utils/ui";

interface ChatInterfaceProps {
  connection: ConnectionWithRole;
  onResetChatReady?: (resetChat: () => void) => void;
}

export function ChatInterface({ connection, onResetChatReady }: ChatInterfaceProps) {
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingStateRef = useRef<boolean>(false);
  
  const {
    selectedSchema,
    selectedTables,
    config,
    updateConfig,
  } = useConnectionExplorer();

  // WebSocket integration
  const { sendMessage, sendTyping, isConnected, resetChat } = useWebSocket({
    connectionId: connection.id,
    autoConnect: true,
  });

  // Expose resetChat to parent
  useEffect(() => {
    if (onResetChatReady && resetChat) {
      onResetChatReady(resetChat);
    }
  }, [onResetChatReady, resetChat]);

  const messages = useChatMessages(connection.id);
  const connectionStatus = useConnectionStatus();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle typing indicator with proper debouncing
  useEffect(() => {
    // Clear any existing debounce timers
    if (typingDebounceRef.current) {
      clearTimeout(typingDebounceRef.current);
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    const hasContent = message.trim().length > 0;

    // Only send typing events if state changed
    if (hasContent !== lastTypingStateRef.current) {
      lastTypingStateRef.current = hasContent;
      
      if (hasContent) {
        // Send typing:start immediately when user starts typing
        sendTyping(true);
        
        // Set timeout to send typing:stop after 3 seconds of inactivity
        typingTimeoutRef.current = setTimeout(() => {
          sendTyping(false);
          lastTypingStateRef.current = false;
        }, 3000);
      } else {
        // Send typing:stop immediately when input is cleared
        sendTyping(false);
      }
    } else if (hasContent) {
      // User is still typing - reset the timeout
      typingTimeoutRef.current = setTimeout(() => {
        sendTyping(false);
        lastTypingStateRef.current = false;
      }, 3000);
    }

    return () => {
      if (typingDebounceRef.current) {
        clearTimeout(typingDebounceRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [message, sendTyping]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!message.trim() || isSubmitting || !isConnected) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      const content = message.trim();
      setMessage("");
      sendTyping(false);

      // Build context from selected schema/tables and config
      const context = {
        schema: selectedSchema || undefined,
        tables: selectedTables.size > 0 ? Array.from(selectedTables) : undefined,
        config: {
          readOnly: config.readOnly,
          dryRun: config.dryRun,
        },
      };

      await sendMessage(content, context);
    } catch (error) {
      console.error("Failed to send message:", error);
      // Optionally show error toast here
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">{connection.name}</h1>
            {connection.description && (
              <p className="text-sm text-muted-foreground mt-0.5">{connection.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Wifi className="w-3.5 h-3.5 text-green-500" />
                <span>Connected</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <WifiOff className="w-3.5 h-3.5 text-red-500" />
                <span>{connectionStatus === 'reconnecting' ? 'Reconnecting...' : 'Disconnected'}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-xl">
              <h2 className="text-2xl font-semibold mb-2">
                Ask questions about your database
              </h2>
              <p className="text-sm text-muted-foreground">
                Use natural language to explore your database schema, query data, and get insights.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.messageId}
                className={cn(
                  "rounded-lg p-3 max-w-[80%]",
                  msg.status === 'error' && "bg-red-50 border border-red-200",
                  msg.status === 'pending' && "bg-muted opacity-60",
                  msg.status === 'sent' && "bg-muted"
                )}
              >
                <div className="text-sm font-medium mb-1">
                  {msg.userId ? `User ${msg.userId.slice(0, 8)}` : 'You'}
                </div>
                <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                {msg.error && (
                  <div className="text-xs text-red-600 mt-1">Error: {msg.error}</div>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Chat Input */}
      <div className="border-t bg-background">
        {/* Config and Selection Bar */}
        <div className="px-3 pt-2.5 pb-2 flex items-center gap-2 flex-wrap">
          {/* Config Button */}
          <Popover open={isConfigOpen} onOpenChange={setIsConfigOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                title="Query configuration"
              >
                <Settings className="w-3.5 h-3.5 mr-1.5" />
                Config
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="start">
              <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="read-only" className="text-sm font-medium">
                      Read Only
                    </Label>
                    <Switch
                      id="read-only"
                      checked={config.readOnly}
                      onCheckedChange={(checked) =>
                        updateConfig({ readOnly: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="dry-run" className="text-sm font-medium">
                      Preview Only
                    </Label>
                    <Switch
                      id="dry-run"
                      checked={config.dryRun}
                      onCheckedChange={(checked) =>
                        updateConfig({ dryRun: checked })
                      }
                    />
                  </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Divider */}
          <div className="h-4 w-px bg-border" />

          {/* Schema Display */}
          {selectedSchema && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 border border-border/50">
              <Database className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="text-xs font-medium text-foreground truncate max-w-[120px]">
                {selectedSchema}
              </span>
            </div>
          )}

          {/* Tables Display */}
          {selectedTables.size > 0 && (
            <>
              {selectedSchema && <div className="h-4 w-px bg-border" />}
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 border border-border/50">
                <TableIcon className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="text-xs font-medium text-foreground">
                  {selectedTables.size} {selectedTables.size === 1 ? 'table' : 'tables'}
                </span>
              </div>
            </>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-3 flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask a question about your database..."
            className="flex-1"
            disabled={isSubmitting || !isConnected}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!message.trim() || isSubmitting}
            className="shrink-0"
          >
            <Send className="w-4 h-4" />
            <span className="sr-only">Send message</span>
          </Button>
        </form>
      </div>
    </div>
  );
}

