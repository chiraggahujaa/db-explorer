"use client";

import { useEffect, useState } from "react";
import { Info, Loader2, Database, Table as TableIcon, Terminal } from "lucide-react";
import { chatSessionsAPI } from "@/lib/api/chatSessions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/ui";

interface ChatContextSummaryProps {
  chatSessionId: string;
  className?: string;
}

export function ChatContextSummary({ chatSessionId, className }: ChatContextSummaryProps) {
  const [contextSummary, setContextSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadContext = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await chatSessionsAPI.getContext(chatSessionId);

        if (result.success) {
          setContextSummary(result.data);
        } else {
          setError("Failed to load chat context");
        }
      } catch (err) {
        console.error("Error loading chat context:", err);
        setError("Failed to load chat context");
      } finally {
        setIsLoading(false);
      }
    };

    if (chatSessionId) {
      loadContext();
    }
  }, [chatSessionId]);

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground py-2", className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading chat context...</span>
      </div>
    );
  }

  if (error || !contextSummary) {
    return null;
  }

  // Parse the context summary to extract structured information
  const hasSchema = contextSummary.includes("Schema:");
  const hasTables = contextSummary.includes("Tables:");
  const hasQueries = contextSummary.includes("Recent queries:");

  // Don't show if no meaningful context
  if (contextSummary === "No context available for this chat session.") {
    return null;
  }

  return (
    <Alert className={cn("border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900", className)}>
      <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      <AlertDescription className="text-sm space-y-2">
        <div className="font-medium text-blue-900 dark:text-blue-100 mb-2">
          Resuming previous conversation
        </div>

        <div className="text-blue-800 dark:text-blue-200 space-y-1">
          <p className="leading-relaxed">{contextSummary}</p>

          {/* Visual indicators */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {hasSchema && (
              <Badge variant="secondary" className="text-xs">
                <Database className="h-3 w-3 mr-1" />
                Schema Selected
              </Badge>
            )}
            {hasTables && (
              <Badge variant="secondary" className="text-xs">
                <TableIcon className="h-3 w-3 mr-1" />
                Tables in Context
              </Badge>
            )}
            {hasQueries && (
              <Badge variant="secondary" className="text-xs">
                <Terminal className="h-3 w-3 mr-1" />
                Query History
              </Badge>
            )}
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}
