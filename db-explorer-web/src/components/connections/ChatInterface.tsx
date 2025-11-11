"use client";

import { useState, FormEvent } from "react";
import { Send, Settings, Database, Table as TableIcon } from "lucide-react";
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

interface ChatInterfaceProps {
  connection: ConnectionWithRole;
}

export function ChatInterface({ connection }: ChatInterfaceProps) {
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  
  const {
    selectedSchema,
    selectedTables,
    config,
    updateConfig,
  } = useConnectionExplorer();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!message.trim() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    
    // TODO: Implement chat functionality with MCP server
    console.log("Sending message:", message);
    
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      setMessage("");
    }, 1000);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-4 py-3">
        <h1 className="text-lg font-semibold">{connection.name}</h1>
        {connection.description && (
          <p className="text-sm text-muted-foreground mt-0.5">{connection.description}</p>
        )}
      </div>

      {/* Chat Content Area */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-xl">
          <h2 className="text-2xl font-semibold mb-2">
            Ask questions about your database
          </h2>
          <p className="text-sm text-muted-foreground">
            Use natural language to explore your database schema, query data, and get insights.
          </p>
        </div>
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
            disabled={isSubmitting}
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

