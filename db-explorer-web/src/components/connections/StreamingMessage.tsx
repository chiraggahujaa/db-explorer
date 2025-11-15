"use client";

import { Loader2, CheckCircle2, XCircle, Wrench, Database } from "lucide-react";
import { cn } from "@/utils/ui";
import type { MCPStreamingMessage } from "@/stores/useMCPStore";

interface StreamingMessageProps {
  message: MCPStreamingMessage;
  className?: string;
}

// Parse tool calls from text (e.g., "🔧 Using tool: **list_tables**")
function parseToolCalls(text: string): { beforeTool: string; toolName: string | null; afterTool: string } {
  const toolMatch = text.match(/🔧\s*Using tool:\s*\*\*([^*]+)\*\*/);
  if (toolMatch) {
    const toolName = toolMatch[1];
    const beforeTool = text.slice(0, toolMatch.index);
    const afterTool = text.slice(toolMatch.index! + toolMatch[0].length);
    return { beforeTool, toolName, afterTool };
  }
  return { beforeTool: text, toolName: null, afterTool: '' };
}

export function StreamingMessage({ message, className }: StreamingMessageProps) {
  const isStreaming = message.status === 'streaming';
  const isCompleted = message.status === 'completed';
  const isError = message.status === 'error';

  const { beforeTool, toolName, afterTool } = parseToolCalls(message.fullText || '');
  const hasToolCall = toolName !== null;

  return (
    <div
      className={cn(
        "rounded-lg p-4 max-w-[85%]",
        isStreaming && "bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200",
        isCompleted && "bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200",
        isError && "bg-gradient-to-r from-red-50 to-rose-50 border border-red-200",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        {isStreaming && <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0" />}
        {isCompleted && <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />}
        {isError && <XCircle className="w-5 h-5 text-red-600 shrink-0" />}
        <span className={cn(
          "text-sm font-semibold",
          isStreaming && "text-blue-800",
          isCompleted && "text-green-800",
          isError && "text-red-800"
        )}>
          {isStreaming && `Executing: ${message.tool}`}
          {isCompleted && 'Query Completed'}
          {isError && 'Query Failed'}
        </span>
      </div>

      {/* Content */}
      <div className="space-y-2">
        {beforeTool && (
          <div className={cn(
            "text-sm whitespace-pre-wrap",
            isStreaming && "text-blue-900",
            isCompleted && "text-gray-700",
            isError && "text-red-900"
          )}>
            {beforeTool.trim() || 'Preparing query...'}
          </div>
        )}

        {/* Tool Call Badge */}
        {hasToolCall && (
          <div className="flex items-center gap-2 py-2 px-3 bg-white/80 backdrop-blur-sm rounded-md border border-gray-200 shadow-sm">
            <Database className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="text-xs font-mono text-indigo-900 font-medium">
              {toolName}
            </span>
            <Wrench className="w-3 h-3 text-gray-400 shrink-0" />
          </div>
        )}

        {afterTool && afterTool.trim() && (
          <div className={cn(
            "text-sm whitespace-pre-wrap",
            isStreaming && "text-blue-900",
            isCompleted && "text-gray-700",
            isError && "text-red-900"
          )}>
            {afterTool.trim()}
          </div>
        )}

        {!beforeTool && !hasToolCall && !afterTool && (
          <div className="text-sm text-gray-500 italic">
            Preparing query...
          </div>
        )}
      </div>

      {/* Error message */}
      {isError && message.error && (
        <div className="text-xs text-red-700 mt-3 p-2 bg-red-100 rounded border border-red-300 font-medium">
          Error: {message.error}
        </div>
      )}

      {/* Timestamp */}
      <div className={cn(
        "text-xs mt-3 font-medium",
        isStreaming && "text-blue-500",
        isCompleted && "text-green-500",
        isError && "text-red-500"
      )}>
        {new Date(message.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}




