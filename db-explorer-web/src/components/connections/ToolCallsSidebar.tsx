'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Wrench, ChevronRight, ChevronDown, GripVertical } from 'lucide-react';
import { cn } from '@/utils/ui';

interface ToolCall {
  toolCallId: string;
  toolName: string;
  input: any;
  output?: any;
  state: string;
  errorText?: string;
  timestamp?: Date;
}

interface ToolCallsSidebarProps {
  toolCalls: ToolCall[];
  isOpen: boolean;
  onToggle: () => void;
}

const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 500;
const DEFAULT_SIDEBAR_WIDTH = 380;

export function ToolCallsSidebar({ toolCalls, isOpen, onToggle }: ToolCallsSidebarProps) {
  const [expandedCalls, setExpandedCalls] = useState<Set<string>>(new Set());

  // Resize functionality
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Resize handlers - drag from LEFT edge (since sidebar is on right)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      // Calculate width from right edge of viewport
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= MIN_SIDEBAR_WIDTH && newWidth <= MAX_SIDEBAR_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  // When sidebar is collapsed, show icon bar on the right edge
  if (!isOpen) {
    return (
      <div className="flex flex-col items-center gap-2 p-2 border-l bg-muted/30">
        <button
          onClick={onToggle}
          className={cn(
            "p-2 rounded-md transition-colors relative",
            "hover:bg-accent",
            toolCalls.length > 0 && "bg-accent"
          )}
          title={`Tool Execution History (${toolCalls.length})`}
        >
          <Wrench className="w-5 h-5" />
          {toolCalls.length > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 text-[10px] font-semibold text-white bg-blue-500 rounded-full">
              {toolCalls.length > 9 ? '9+' : toolCalls.length}
            </span>
          )}
        </button>
      </div>
    );
  }

  const toggleExpand = (toolCallId: string) => {
    setExpandedCalls(prev => {
      const newSet = new Set(prev);
      if (newSet.has(toolCallId)) {
        newSet.delete(toolCallId);
      } else {
        newSet.add(toolCallId);
      }
      return newSet;
    });
  };

  return (
    <div
      ref={sidebarRef}
      className="flex h-full bg-background border-l relative"
      style={{ width: `${sidebarWidth}px` }}
    >
      {/* Resize Handle - On LEFT edge since sidebar is on right */}
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          "absolute top-0 left-0 w-1 h-full cursor-col-resize group hover:bg-primary/20 transition-colors flex items-center justify-center z-50",
          isResizing && "bg-primary/30"
        )}
        title="Drag to resize"
      >
        <div className="absolute top-0 left-0 w-1 h-full bg-transparent group-hover:bg-primary/50 transition-colors" />
        <div className="relative z-10 bg-background/80 rounded-sm p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="w-3 h-3 text-muted-foreground" />
        </div>
      </div>

      {/* Main Sidebar Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-blue-500" />
            <h3 className="font-semibold text-sm">Tool Execution History</h3>
            <span className="text-xs text-muted-foreground">({toolCalls.length})</span>
          </div>
        </div>

        {/* Tool Calls List */}
        <div className="overflow-y-auto flex-1">
          {toolCalls.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <Wrench className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <p className="text-sm text-muted-foreground">No tool calls yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Tool executions will appear here
              </p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {toolCalls.map((toolCall, index) => {
                const isExpanded = expandedCalls.has(toolCall.toolCallId);
                const hasOutput = toolCall.state === 'output-available' && toolCall.output;
                const hasError = toolCall.state === 'output-error';
                const isExecuting = toolCall.state === 'input-available' || toolCall.state === 'input-streaming';

                return (
                  <div
                    key={toolCall.toolCallId}
                    className={cn(
                      "border rounded-lg overflow-hidden transition-colors",
                      hasError ? "border-red-200 dark:border-red-800" : "border-border",
                      "bg-card hover:bg-accent/50"
                    )}
                  >
                    {/* Tool Call Header - Clickable */}
                    <button
                      onClick={() => toggleExpand(toolCall.toolCallId)}
                      className="w-full p-3 flex items-start gap-2 text-left"
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Wrench className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                          <span className="font-medium text-sm text-blue-600 dark:text-blue-400 truncate">
                            {toolCall.toolName}
                          </span>
                          {isExecuting && (
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
                          )}
                          {hasError && (
                            <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {JSON.stringify(toolCall.input)}
                        </p>
                      </div>
                    </button>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="border-t border-border px-3 pb-3 pt-2 space-y-2">
                        {/* Input */}
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Input:</p>
                          <pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto">
                            {JSON.stringify(toolCall.input, null, 2)}
                          </pre>
                        </div>

                        {/* Output */}
                        {hasOutput && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-1">Output:</p>
                            <pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto max-h-60 overflow-y-auto">
                              {JSON.stringify(toolCall.output, null, 2)}
                            </pre>
                          </div>
                        )}

                        {/* Error */}
                        {hasError && (
                          <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded">
                            <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">Error:</p>
                            <p className="text-xs text-red-600 dark:text-red-400">
                              {toolCall.errorText || 'Tool execution failed'}
                            </p>
                          </div>
                        )}

                        {/* Status */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-xs font-medium",
                            hasError ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" :
                            hasOutput ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" :
                            "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                          )}>
                            {toolCall.state}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Icon Bar - for collapse */}
      <div className="flex flex-col items-center gap-2 p-2 border-l bg-muted/30">
        <button
          onClick={onToggle}
          className={cn(
            "p-2 rounded-md transition-colors relative",
            "hover:bg-accent bg-accent"
          )}
          title="Close sidebar"
        >
          <Wrench className="w-5 h-5" />
          {toolCalls.length > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 text-[10px] font-semibold text-white bg-blue-500 rounded-full">
              {toolCalls.length > 9 ? '9+' : toolCalls.length}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
