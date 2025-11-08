"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Database, Table as TableIcon, Loader2 } from "lucide-react";
import { databaseExplorerAPI, type Schema, type Table } from "@/lib/api/connections";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { cn } from "@/utils/ui";
import { toast } from "sonner";

interface SchemaSidebarProps {
  connectionId: string;
}

export function SchemaSidebar({ connectionId }: SchemaSidebarProps) {
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set());
  const [loadedTables, setLoadedTables] = useState<Record<string, Table[]>>({});
  const [loadingTables, setLoadingTables] = useState<Set<string>>(new Set());

  const { data: schemasData, isLoading } = useQuery({
    queryKey: ["schemas", connectionId],
    queryFn: async () => {
      const result = await databaseExplorerAPI.getSchemas(connectionId);
      if (!result.success) {
        throw new Error(result.error || "Failed to fetch schemas");
      }
      return result.data;
    },
    enabled: !!connectionId,
  });

  const toggleSchema = async (schemaName: string) => {
    const newExpanded = new Set(expandedSchemas);
    
    if (newExpanded.has(schemaName)) {
      newExpanded.delete(schemaName);
    } else {
      newExpanded.add(schemaName);
      
      // Fetch tables if not already loaded
      if (!loadedTables[schemaName]) {
        setLoadingTables((prev) => new Set(prev).add(schemaName));
        
        try {
          const result = await databaseExplorerAPI.getTables(connectionId, schemaName);
          if (result.success) {
            setLoadedTables((prev) => ({
              ...prev,
              [schemaName]: result.data,
            }));
          } else {
            toast.error(result.error || "Failed to fetch tables");
            newExpanded.delete(schemaName); // Collapse on error
          }
        } catch (error) {
          toast.error("Failed to fetch tables");
          newExpanded.delete(schemaName); // Collapse on error
        } finally {
          setLoadingTables((prev) => {
            const next = new Set(prev);
            next.delete(schemaName);
            return next;
          });
        }
      }
    }
    
    setExpandedSchemas(newExpanded);
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <LoadingSpinner />
      </div>
    );
  }

  const schemas = schemasData || [];

  return (
    <div className="p-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Schemas & Tables</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Click on a schema to view tables
        </p>
      </div>

      <div className="space-y-1">
        {schemas.length === 0 ? (
          <div className="text-sm text-muted-foreground p-4 text-center">
            No schemas found
          </div>
        ) : (
          schemas.map((schema) => {
            const isExpanded = expandedSchemas.has(schema.name);
            const tables = loadedTables[schema.name] || [];
            const isLoadingTables = loadingTables.has(schema.name);

            return (
              <div key={schema.name} className="select-none">
                <button
                  onClick={() => toggleSchema(schema.name)}
                  disabled={isLoadingTables}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium",
                    "hover:bg-accent transition-colors",
                    "text-left",
                    isLoadingTables && "opacity-75 cursor-wait"
                  )}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                  <Database className="w-4 h-4 text-muted-foreground" />
                  <span className="flex-1">{schema.name}</span>
                  {isLoadingTables && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  )}
                </button>

                {isExpanded && (
                  <div className="ml-7 mt-1 space-y-1">
                    {isLoadingTables ? (
                      <div className="px-3 py-2 flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Loading tables...</span>
                      </div>
                    ) : tables.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No tables found
                      </div>
                    ) : (
                      tables.map((table) => (
                        <div
                          key={table.name}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-accent/50 cursor-pointer"
                        >
                          <TableIcon className="w-3.5 h-3.5" />
                          <span>{table.name}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

