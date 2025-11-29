'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Wrench, ChevronRight, ChevronDown, GripVertical, Database, FileText, Search, Plus, Edit, Trash2, BarChart3, Settings, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { cn } from '@/utils/ui';

interface ToolCall {
  toolCallId: string;
  toolName?: string;
  type?: string;
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

// Tool type configurations
const getToolDisplayInfo = (toolName: string | undefined) => {
  if (!toolName) {
    return {
      icon: Wrench,
      displayName: 'Unknown Tool',
      color: 'text-gray-600',
      category: 'Other'
    };
  }

  const toolConfigs: Record<string, { icon: any; displayName: string; color: string; category: string }> = {
    // Schema & Structure Tools
    'list_databases': { icon: Database, displayName: 'List Databases', color: 'text-blue-600', category: 'Schema' },
    'list_tables': { icon: Database, displayName: 'List Tables', color: 'text-blue-600', category: 'Schema' },
    'describe_table': { icon: FileText, displayName: 'Describe Table', color: 'text-purple-600', category: 'Schema' },
    'show_indexes': { icon: BarChart3, displayName: 'Show Indexes', color: 'text-cyan-600', category: 'Schema' },
    'analyze_foreign_keys': { icon: Settings, displayName: 'Analyze Foreign Keys', color: 'text-indigo-600', category: 'Schema' },
    'get_table_dependencies': { icon: Settings, displayName: 'Table Dependencies', color: 'text-indigo-600', category: 'Schema' },

    // Data Query Tools
    'select_data': { icon: Search, displayName: 'Query Data', color: 'text-green-600', category: 'Query' },
    'count_records': { icon: BarChart3, displayName: 'Count Records', color: 'text-emerald-600', category: 'Query' },
    'find_by_id': { icon: Search, displayName: 'Find by ID', color: 'text-teal-600', category: 'Query' },
    'search_records': { icon: Search, displayName: 'Search Records', color: 'text-lime-600', category: 'Query' },
    'get_recent_records': { icon: Clock, displayName: 'Recent Records', color: 'text-orange-600', category: 'Query' },
    'execute_custom_query': { icon: Database, displayName: 'Custom Query', color: 'text-amber-600', category: 'Query' },

    // Data Modification Tools
    'insert_record': { icon: Plus, displayName: 'Insert Record', color: 'text-emerald-600', category: 'Modify' },
    'update_record': { icon: Edit, displayName: 'Update Record', color: 'text-yellow-600', category: 'Modify' },
    'delete_record': { icon: Trash2, displayName: 'Delete Record', color: 'text-red-600', category: 'Modify' },
    'bulk_insert': { icon: Plus, displayName: 'Bulk Insert', color: 'text-emerald-600', category: 'Modify' },

    // Analysis Tools
    'join_tables': { icon: Database, displayName: 'Join Tables', color: 'text-violet-600', category: 'Analysis' },
    'find_orphaned_records': { icon: Search, displayName: 'Find Orphans', color: 'text-pink-600', category: 'Analysis' },
    'validate_referential_integrity': { icon: CheckCircle, displayName: 'Validate Integrity', color: 'text-green-600', category: 'Analysis' },
    'analyze_table_relationships': { icon: Settings, displayName: 'Analyze Relationships', color: 'text-indigo-600', category: 'Analysis' },
    'get_column_statistics': { icon: BarChart3, displayName: 'Column Statistics', color: 'text-cyan-600', category: 'Analysis' },

    // Utility Tools
    'explain_query': { icon: FileText, displayName: 'Explain Query', color: 'text-slate-600', category: 'Utility' },
    'check_table_status': { icon: BarChart3, displayName: 'Table Status', color: 'text-slate-600', category: 'Utility' },
    'optimize_table': { icon: Settings, displayName: 'Optimize Table', color: 'text-slate-600', category: 'Utility' },
    'backup_table_structure': { icon: FileText, displayName: 'Backup Structure', color: 'text-slate-600', category: 'Utility' },
    'test_connection': { icon: CheckCircle, displayName: 'Test Connection', color: 'text-slate-600', category: 'Utility' },
    'get_database_size': { icon: BarChart3, displayName: 'Database Size', color: 'text-slate-600', category: 'Utility' },
  };

  return toolConfigs[toolName] || {
    icon: Wrench,
    displayName: toolName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    color: 'text-gray-600',
    category: 'Other'
  };
};

const getStatusInfo = (state: string) => {
  switch (state) {
    case 'input-available':
    case 'input-streaming':
      return { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Running', animate: true };
    case 'output-available':
      return { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10', label: 'Completed', animate: false };
    case 'output-error':
      return { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Failed', animate: false };
    default:
      return { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'Pending', animate: false };
  }
};

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
        <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-background to-muted/20">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10">
              <Wrench className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Tool History</h3>
              <p className="text-xs text-muted-foreground">{toolCalls.length} execution{toolCalls.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>

        {/* Tool Calls List */}
        <div className="overflow-y-auto flex-1">
          {toolCalls.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                <Wrench className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <h4 className="font-medium text-sm text-muted-foreground mb-1">No Tools Executed</h4>
              <p className="text-xs text-muted-foreground max-w-48">
                Database operations and queries will appear here when the AI assistant runs them
              </p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {toolCalls.map((toolCall, index) => {
                const isExpanded = expandedCalls.has(toolCall.toolCallId);
                const toolName = toolCall.toolName || (toolCall.type?.startsWith('tool-') ? toolCall.type.slice(5) : toolCall.type || 'unknown');
                const toolInfo = getToolDisplayInfo(toolName);
                const statusInfo = getStatusInfo(toolCall.state);
                const StatusIcon = statusInfo.icon;
                const ToolIcon = toolInfo.icon;

                return (
                  <div
                    key={toolCall.toolCallId}
                    className={cn(
                      "border rounded-lg overflow-hidden transition-all duration-200",
                      "border-border bg-card hover:bg-accent/30 hover:shadow-sm"
                    )}
                  >
                    {/* Tool Call Header - Clickable */}
                    <button
                      onClick={() => toggleExpand(toolCall.toolCallId)}
                      className="w-full p-3 flex items-start gap-3 text-left group"
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                        )}
                      </div>

                      {/* Tool Icon */}
                      <div className={cn(
                        "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
                        toolInfo.color.replace('text-', 'bg-') + '/10'
                      )}>
                        <ToolIcon className={cn("w-4 h-4", toolInfo.color)} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm text-foreground truncate">
                            {toolInfo.displayName}
                          </span>
                          <div className={cn(
                            "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                            statusInfo.bg
                          )}>
                            {statusInfo.animate ? (
                              <StatusIcon className={cn("w-3 h-3 animate-spin", statusInfo.color)} />
                            ) : (
                              <StatusIcon className={cn("w-3 h-3", statusInfo.color)} />
                            )}
                            <span className={statusInfo.color}>{statusInfo.label}</span>
                          </div>
                        </div>

                        {/* Tool parameters summary */}
                        <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                          {toolCall.input?.database && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/50">
                              <Database className="w-3 h-3" />
                              {toolCall.input.database}
                            </span>
                          )}
                          {toolCall.input?.table && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/50">
                              <FileText className="w-3 h-3" />
                              {toolCall.input.table}
                            </span>
                          )}
                          {toolCall.input?.sql && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/50 truncate max-w-32">
                              SQL: {toolCall.input.sql.slice(0, 20)}...
                            </span>
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="border-t border-border bg-muted/20">
                        <div className="p-3 space-y-3">
                          {/* Input Parameters */}
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Parameters</span>
                            </div>
                            <div className="bg-background/50 rounded-md p-2 border">
                              <pre className="text-xs text-foreground overflow-x-auto whitespace-pre-wrap break-all">
                                {JSON.stringify(toolCall.input, null, 2)}
                              </pre>
                            </div>
                          </div>

                          {/* Output */}
                          {toolCall.output && (
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Result</span>
                              </div>
                              <div className="bg-background/50 rounded-md p-2 border max-h-48 overflow-y-auto">
                                <pre className="text-xs text-foreground overflow-x-auto whitespace-pre-wrap break-all">
                                  {typeof toolCall.output === 'string'
                                    ? toolCall.output
                                    : JSON.stringify(toolCall.output, null, 2)
                                  }
                                </pre>
                              </div>
                            </div>
                          )}

                          {/* Error */}
                          {toolCall.errorText && (
                            <div className="bg-red-500/5 border border-red-500/20 rounded-md p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <XCircle className="w-3.5 h-3.5 text-red-500" />
                                <span className="text-xs font-semibold text-red-500 uppercase tracking-wide">Error</span>
                              </div>
                              <p className="text-xs text-red-600 dark:text-red-400">
                                {toolCall.errorText}
                              </p>
                            </div>
                          )}

                          {/* Execution Details */}
                          <div className="flex items-center justify-between pt-2 border-t border-border/50">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Status:</span>
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-xs font-medium",
                                statusInfo.bg
                              )}>
                                {statusInfo.label}
                              </span>
                            </div>
                            {toolCall.timestamp && (
                              <span className="text-xs text-muted-foreground">
                                {new Date(toolCall.timestamp).toLocaleTimeString()}
                              </span>
                            )}
                          </div>
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
