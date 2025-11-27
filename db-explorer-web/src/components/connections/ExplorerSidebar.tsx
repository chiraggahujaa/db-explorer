"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Database,
  Clock,
  ChevronRight,
  RefreshCw,
  Plus,
  Filter,
  Table as TableIcon,
  Loader2,
  Check,
  GripVertical,
} from "lucide-react";
import { databaseExplorerAPI, type Table, type Schema } from "@/lib/api/connections";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { SearchInput } from "@/components/ui/search-input";
import { cn } from "@/utils/ui";
import { toast } from "sonner";
import { useConnectionExplorer } from "@/contexts/ConnectionExplorerContext";
import { ChatHistoryList } from "./ChatHistoryList";
import { useChatStore } from "@/stores/useChatStore";

type SidebarView = "database" | "recents";

interface ExplorerSidebarProps {
  initialConnectionId?: string;
  onNewChat?: () => void;
  onSelectChat?: (chatSessionId: string) => void;
  currentChatSessionId?: string | null;
  isOpen?: boolean;
  onToggle?: () => void;
}

const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 600;
const DEFAULT_SIDEBAR_WIDTH = 320;

export function ExplorerSidebar({
  initialConnectionId,
  onNewChat,
  onSelectChat,
  currentChatSessionId,
  isOpen = true,
  onToggle
}: ExplorerSidebarProps) {
  const {
    selectedSchema,
    selectedTables,
    setSelectedSchema,
    toggleTable,
  } = useConnectionExplorer();

  // Get the current chat session ID from the store
  // We'll use this to exclude newly created sessions from the history when in "new chat" view
  const currentChatSessionIdFromStore = useChatStore((state) => state.currentChatSessionId);

  const [activeView, setActiveView] = useState<SidebarView>("database");
  const [tableFilter, setTableFilter] = useState("");
  const [loadedTables, setLoadedTables] = useState<Table[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);

  // Resize functionality
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Fetch schemas for the connection
  const { data: schemasData, isLoading: isLoadingSchemas, refetch: refetchSchemas } = useQuery({
    queryKey: ["schemas", initialConnectionId],
    queryFn: async () => {
      if (!initialConnectionId) {
        throw new Error("Connection ID is required");
      }
      const result = await databaseExplorerAPI.getSchemas(initialConnectionId);
      if (!result.success) {
        throw new Error(result.error || "Failed to fetch schemas");
      }
      return result.data;
    },
    enabled: !!initialConnectionId,
  });

  // Reset schema selection when connection changes
  useEffect(() => {
    // Try to load the last selected schema from localStorage
    if (initialConnectionId) {
      try {
        const storageKey = `selected_schema_${initialConnectionId}`;
        const savedSchema = localStorage.getItem(storageKey);
        if (savedSchema) {
          // We'll set this after schemas are loaded
          // Just store it in a ref for now
        } else {
          setSelectedSchema(undefined);
        }
      } catch (error) {
        console.error('Failed to load schema from localStorage:', error);
        setSelectedSchema(undefined);
      }
    } else {
      setSelectedSchema(undefined);
    }
    setLoadedTables([]);
  }, [initialConnectionId, setSelectedSchema]);

  // Auto-select schema: first try localStorage, then single schema, or keep current selection
  useEffect(() => {
    if (!schemasData || !initialConnectionId) return;

    // If a schema is already selected, keep it
    if (selectedSchema) return;

    try {
      // Try to restore from localStorage
      const storageKey = `selected_schema_${initialConnectionId}`;
      const savedSchema = localStorage.getItem(storageKey);

      if (savedSchema && schemasData.some(s => s.name === savedSchema)) {
        // Restore the saved schema if it still exists
        setSelectedSchema(savedSchema);
        return;
      }
    } catch (error) {
      console.error('Failed to load schema from localStorage:', error);
    }

    // Fallback: auto-select if only one schema exists
    if (schemasData.length === 1) {
      setSelectedSchema(schemasData[0].name);
    }
  }, [schemasData, selectedSchema, setSelectedSchema, initialConnectionId]);

  // Load tables when schema is selected
  useEffect(() => {
    if (selectedSchema && initialConnectionId) {
      loadTables(initialConnectionId, selectedSchema);
    } else {
      setLoadedTables([]);
    }
  }, [selectedSchema, initialConnectionId]);

  const loadTables = async (connectionId: string, schemaName: string) => {
    setIsLoadingTables(true);
    try {
      const tablesResult = await databaseExplorerAPI.getTables(connectionId, schemaName);
      if (!tablesResult.success) {
        throw new Error(tablesResult.error || "Failed to fetch tables");
      }
      setLoadedTables(tablesResult.data || []);
    } catch (error: any) {
      console.error("Error loading tables:", error);
      toast.error(error.message || "Failed to load tables");
      setLoadedTables([]);
    } finally {
      setIsLoadingTables(false);
    }
  };

  const handleRefreshSchemas = async () => {
    await refetchSchemas();

    // Also refresh tables if a schema is selected
    if (selectedSchema && initialConnectionId) {
      await loadTables(initialConnectionId, selectedSchema);
      toast.success("Schemas and tables refreshed");
    } else {
      toast.success("Schemas refreshed");
    }
  };

  // Resize handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = e.clientX;
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

  const handleSchemaChange = useCallback((schemaName: string) => {
    // Use setTimeout to ensure Select portal closes before state updates
    setTimeout(() => {
      setSelectedSchema(schemaName);

      // Save to localStorage
      if (initialConnectionId) {
        try {
          const storageKey = `selected_schema_${initialConnectionId}`;
          localStorage.setItem(storageKey, schemaName);
        } catch (error) {
          console.error('Failed to save schema to localStorage:', error);
        }
      }
    }, 0);
  }, [setSelectedSchema, initialConnectionId]);

  const schemas = useMemo(() => {
    return schemasData || [];
  }, [schemasData]);

  const schemaOptions: SearchableSelectOption[] = useMemo(() => {
    return schemas.map((schema) => ({
      value: schema.name,
      label: schema.name,
      icon: <Database className="w-4 h-4 shrink-0" />,
    }));
  }, [schemas]);

  const filteredTables = useMemo(() => {
    if (!tableFilter.trim()) return loadedTables;
    const filterLower = tableFilter.toLowerCase();
    return loadedTables.filter((table) =>
      table.name.toLowerCase().includes(filterLower)
    );
  }, [loadedTables, tableFilter]);

  const handleDatabaseClick = () => {
    setActiveView("database");
    if (onToggle) onToggle(); // Toggle sidebar when clicking database icon
  };

  const handleRecentsClick = () => {
    setActiveView("recents");
    if (onToggle) onToggle(); // Toggle sidebar when clicking recents icon
  };

  // When collapsed, show the icon bar with both icons
  if (!isOpen) {
    return (
      <div className="flex flex-col items-center gap-2 p-2 border-r bg-muted/30">
        <button
          onClick={handleDatabaseClick}
          className={cn(
            "p-2 rounded-md transition-colors",
            "hover:bg-accent"
          )}
          title="Open Database view"
        >
          <Database className="w-5 h-5" />
        </button>
        <button
          onClick={handleRecentsClick}
          className={cn(
            "p-2 rounded-md transition-colors",
            "hover:bg-accent"
          )}
          title="Open Recents view"
        >
          <Clock className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={sidebarRef}
      className="flex h-full bg-background border-r relative"
      style={{ width: `${sidebarWidth}px` }}
    >
      {/* Left Icon Bar - Tabs */}
      <div className="flex flex-col items-center gap-2 p-2 border-r bg-muted/30">
        <button
          onClick={handleDatabaseClick}
          className={cn(
            "p-2 rounded-md transition-colors",
            "hover:bg-accent",
            activeView === "database" && "bg-accent"
          )}
          title="Database"
        >
          <Database className="w-5 h-5" />
        </button>
        <button
          onClick={handleRecentsClick}
          className={cn(
            "p-2 rounded-md transition-colors",
            "hover:bg-accent",
            activeView === "recents" && "bg-accent"
          )}
          title="Recents"
        >
          <Clock className="w-5 h-5" />
        </button>
        <div className="flex-1" />
      </div>

      {/* Main Sidebar Content - Database Tab */}
      {activeView === "database" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Section: Schema Selector */}
          <div className="p-3 border-b space-y-2">
            <div className="flex items-center gap-2">
              <SearchableSelect
                key={`schema-select-${initialConnectionId}`}
                options={schemaOptions}
                value={selectedSchema}
                onValueChange={handleSchemaChange}
                placeholder="Select schema"
                emptyText="No schemas found"
                searchPlaceholder="Search schemas..."
                disabled={!initialConnectionId || isLoadingSchemas}
                isLoading={isLoadingSchemas}
                triggerClassName="flex-1"
              />
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={handleRefreshSchemas}
                  disabled={isLoadingSchemas || !initialConnectionId}
                  title="Refresh schemas"
                >
                  <RefreshCw
                    className={cn(
                      "w-4 h-4",
                      isLoadingSchemas && "animate-spin"
                    )}
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => {
                    if (onNewChat) {
                      onNewChat();
                      toast.success("New chat session started");
                    }
                  }}
                  disabled={!onNewChat || !initialConnectionId}
                  title="Start new chat"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Filter Input */}
              <SearchInput
              placeholder="Filter"
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
              className="h-9"
              disabled={!selectedSchema}
              icon={<Filter className="w-4 h-4 text-muted-foreground" />}
              iconPosition="right"
            />
          </div>

          {/* Tables List */}
          <div className="flex-1 overflow-y-auto">
            {!initialConnectionId ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No connection selected
              </div>
            ) : isLoadingSchemas ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : !selectedSchema ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Select a schema to see tables
              </div>
            ) : isLoadingTables ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTables.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {tableFilter ? "No tables match your filter" : "No tables found"}
              </div>
            ) : (
              <div className="p-2">
                <div className="mb-2 px-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">ENTITIES</h3>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {filteredTables.length}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {filteredTables.map((table) => {
                    const isSelected = selectedTables.has(table.name);
                    return (
                      <div
                        key={`${table.schema || "default"}-${table.name}`}
                        onClick={() => toggleTable(table.name)}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm cursor-pointer group transition-colors",
                          isSelected
                            ? "bg-primary/10 hover:bg-primary/15 border border-primary/20"
                            : "hover:bg-accent"
                        )}
                      >
                        <div className="w-4 h-4 flex items-center justify-center shrink-0">
                          {isSelected ? (
                            <Check className="w-3.5 h-3.5 text-primary" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </div>
                        <TableIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className={cn("truncate", isSelected && "font-medium")}>
                          {table.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Sidebar Content - Recents Tab */}
      {activeView === "recents" && (
        <div className="flex-1 flex flex-col overflow-hidden" style={{ width: `${sidebarWidth}px` }}>
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold">Chat History</h3>
            {onNewChat && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => {
                  onNewChat();
                  setActiveView("database");
                  toast.success("New chat session started");
                }}
                disabled={!initialConnectionId}
                title="Start new chat"
              >
                <Plus className="w-4 h-4 mr-1" />
                New
              </Button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {initialConnectionId && onSelectChat ? (
              <ChatHistoryList
                connectionId={initialConnectionId}
                onSelectChat={onSelectChat}
                currentChatSessionId={currentChatSessionId}
                excludeSessionId={
                  // If we're in "new chat" view (no chatId in URL), exclude the session created in the store
                  currentChatSessionId === undefined ? currentChatSessionIdFromStore : null
                }
              />
            ) : (
              <div className="flex items-center justify-center p-8">
                <div className="text-center text-sm text-muted-foreground">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No connection selected</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resize Handle - Works for all tabs */}
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          "absolute top-0 right-0 w-1 h-full cursor-col-resize group hover:bg-primary/20 transition-colors flex items-center justify-center",
          isResizing && "bg-primary/30"
        )}
        title="Drag to resize"
      >
        <div className="absolute top-0 right-0 w-1 h-full bg-transparent group-hover:bg-primary/50 transition-colors" />
        <div className="relative z-10 bg-background/80 rounded-sm p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="w-3 h-3 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}

