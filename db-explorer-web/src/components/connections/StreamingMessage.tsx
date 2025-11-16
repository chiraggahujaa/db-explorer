"use client";

import { Loader2, CheckCircle2, XCircle, Ban } from "lucide-react";
import { cn } from "@/utils/ui";
import type { MCPStreamingMessage } from "@/stores/useMCPStore";
import { ToolCallsList } from "./ToolCallsList";

interface StreamingMessageProps {
  message: MCPStreamingMessage;
  className?: string;
}

export function StreamingMessage({ message, className }: StreamingMessageProps) {
  const isStreaming = message.status === 'streaming';
  const isCompleted = message.status === 'completed';
  const isError = message.status === 'error';
  const isCancelled = message.status === 'cancelled';

  // Extract text without tool call markers (which are now handled separately)
  const cleanText = message.fullText.replace(/🔧\s*Using tool:\s*\*\*[^*]+\*\*/g, '').trim();

  return (
    <div
      className={cn(
        "rounded-lg p-4 max-w-[85%]",
        isStreaming && "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800",
        isCompleted && "bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200 dark:border-green-800",
        isError && "bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border border-red-200 dark:border-red-800",
        isCancelled && "bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-950/30 dark:to-orange-950/30 border border-yellow-200 dark:border-yellow-800",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        {isStreaming && <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />}
        {isCompleted && <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />}
        {isError && <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />}
        {isCancelled && <Ban className="w-5 h-5 text-yellow-600 dark:text-yellow-400 shrink-0" />}
        <span className={cn(
          "text-sm font-semibold",
          isStreaming && "text-blue-800 dark:text-blue-300",
          isCompleted && "text-green-800 dark:text-green-300",
          isError && "text-red-800 dark:text-red-300",
          isCancelled && "text-yellow-800 dark:text-yellow-300"
        )}>
          {isStreaming && `Processing...`}
          {isCompleted && 'Completed'}
          {isError && 'Failed'}
          {isCancelled && 'Cancelled by user'}
        </span>
      </div>

      {/* AI Response Text */}
      {cleanText && (
        <div className={cn(
          "text-sm whitespace-pre-wrap mb-3",
          isStreaming && "text-blue-900 dark:text-blue-200",
          isCompleted && "text-gray-700 dark:text-gray-300",
          isError && "text-red-900 dark:text-red-200",
          isCancelled && "text-yellow-900 dark:text-yellow-200"
        )}>
          {cleanText}
        </div>
      )}

      {/* Tool Calls List */}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <div className="mt-4">
          <ToolCallsList toolCalls={message.toolCalls} />
        </div>
      )}

      {/* Show placeholder if nothing to display yet */}
      {!cleanText && (!message.toolCalls || message.toolCalls.length === 0) && (
        <div className="text-sm text-gray-500 dark:text-gray-400 italic">
          Preparing query...
        </div>
      )}

      {/* Error message */}
      {isError && message.error && (
        <div className="text-xs text-red-700 dark:text-red-300 mt-3 p-2 bg-red-100 dark:bg-red-900/30 rounded border border-red-300 dark:border-red-700 font-medium">
          Error: {message.error}
        </div>
      )}

      {/* Timestamp */}
      <div className={cn(
        "text-xs mt-3 font-medium",
        isStreaming && "text-blue-500 dark:text-blue-400",
        isCompleted && "text-green-500 dark:text-green-400",
        isError && "text-red-500 dark:text-red-400",
        isCancelled && "text-yellow-500 dark:text-yellow-400"
      )}>
        {new Date(message.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}
