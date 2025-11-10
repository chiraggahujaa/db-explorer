"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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
} from "lucide-react";
import { databaseExplorerAPI, type Table, type Schema } from "@/lib/api/connections";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { SearchInput } from "@/components/ui/search-input";
import { cn } from "@/utils/ui";
import { toast } from "sonner";

type SidebarView = "database" | "recents";

interface ExplorerSidebarProps {
  initialConnectionId?: string;
}

export function ExplorerSidebar({ initialConnectionId }: ExplorerSidebarProps) {
  const [activeView, setActiveView] = useState<SidebarView>("database");
  const [isDatabaseSidebarOpen, setIsDatabaseSidebarOpen] = useState(true);
  const [selectedSchemaName, setSelectedSchemaName] = useState<string | undefined>();
  const [tableFilter, setTableFilter] = useState("");
  const [loadedTables, setLoadedTables] = useState<Table[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);

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
    setSelectedSchemaName(undefined);
    setLoadedTables([]);
  }, [initialConnectionId]);

  // Auto-select schema if only one exists
  useEffect(() => {
    if (schemasData && schemasData.length === 1 && !selectedSchemaName) {
      setSelectedSchemaName(schemasData[0].name);
    }
  }, [schemasData, selectedSchemaName]);

  // Load tables when schema is selected
  useEffect(() => {
    if (selectedSchemaName && initialConnectionId) {
      loadTables(initialConnectionId, selectedSchemaName);
    } else {
      setLoadedTables([]);
    }
  }, [selectedSchemaName, initialConnectionId]);

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
    toast.success("Schemas refreshed");
  };

  const handleSchemaChange = useCallback((schemaName: string) => {
    // Use setTimeout to ensure Select portal closes before state updates
    setTimeout(() => {
      setSelectedSchemaName(schemaName);
    }, 0);
  }, []);

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

  const toggleDatabaseSidebar = () => {
    setIsDatabaseSidebarOpen((prev) => !prev);
    if (!isDatabaseSidebarOpen) {
      setActiveView("database");
    }
  };

  const handleRecentsClick = () => {
    setActiveView("recents");
    setIsDatabaseSidebarOpen(false);
  };

  return (
    <div className="flex h-full bg-background border-r">
      {/* Left Icon Bar */}
      <div className="flex flex-col items-center gap-2 p-2 border-r bg-muted/30">
        <button
          onClick={toggleDatabaseSidebar}
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
      </div>

      {/* Main Sidebar Content */}
      {activeView === "database" && isDatabaseSidebarOpen && (
        <div className="flex-1 flex flex-col w-80 overflow-hidden">
          {/* Top Section: Schema Selector */}
          <div className="p-3 border-b space-y-2">
            <div className="flex items-center gap-2">
              <SearchableSelect
                key={`schema-select-${initialConnectionId}`}
                options={schemaOptions}
                value={selectedSchemaName}
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
                  disabled
                  title="Add new database (coming soon)"
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
              disabled={!selectedSchemaName}
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
            ) : !selectedSchemaName ? (
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
                  {filteredTables.map((table) => (
                    <div
                      key={`${table.schema || "default"}-${table.name}`}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-accent cursor-pointer group"
                    >
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      <TableIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{table.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recents Sidebar */}
      {activeView === "recents" && (
        <div className="flex-1 flex flex-col w-80 overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="text-sm font-semibold">Recent Chats</h3>
          </div>
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center text-sm text-muted-foreground">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No recent chats</p>
              <p className="text-xs mt-1">Chat history will appear here</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

