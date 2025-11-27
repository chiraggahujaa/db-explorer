"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { RefreshCw, Database, Info, Settings2, ChevronRight, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { connectionsAPI, databaseExplorerAPI } from "@/lib/api/connections";
import { socketService } from "@/lib/socket";
import type { ConnectionWithRole } from "@/types/connection";

interface RetrainSchemaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: ConnectionWithRole | null;
  onSuccess: () => void;
}

interface SchemaSelection {
  schema: string;
  allTables: boolean;
  tables: Set<string>;
}

interface TrainingConfig {
  includeSchemaMetadata: boolean;
  includeTableMetadata: boolean;
  includeColumnMetadata: boolean;
  includeIndexes: boolean;
  includeForeignKeys: boolean;
  includeConstraints: boolean;
  includeRowCounts: boolean;
  includeSampleData: boolean;
  sampleDataRowCount: number;
}

export function RetrainSchemaModal({
  open,
  onOpenChange,
  connection,
  onSuccess,
}: RetrainSchemaModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // Schema/Table selection
  const [availableSchemas, setAvailableSchemas] = useState<Array<{ name: string; tables: string[] }>>([]);
  const [loadingSchemas, setLoadingSchemas] = useState(false);
  const [schemaSelections, setSchemaSelections] = useState<Map<string, SchemaSelection>>(new Map());
  const [selectAllSchemas, setSelectAllSchemas] = useState(true);
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set());

  // Training configuration
  const [trainingConfig, setTrainingConfig] = useState<TrainingConfig>({
    includeSchemaMetadata: true,
    includeTableMetadata: true,
    includeColumnMetadata: true,
    includeIndexes: true,
    includeForeignKeys: true,
    includeConstraints: true,
    includeRowCounts: true,
    includeSampleData: false,
    sampleDataRowCount: 5,
  });

  // Load schemas when modal opens
  useEffect(() => {
    if (open && connection) {
      loadSchemas();

      // Connect to WebSocket
      if (!socketService.connected()) {
        socketService.connect();
      }
    }
  }, [open, connection]);

  const loadSchemas = async () => {
    if (!connection) return;

    setLoadingSchemas(true);
    try {
      const schemasResponse = await databaseExplorerAPI.getSchemas(connection.id);
      if (schemasResponse.success && schemasResponse.data) {
        // Load tables for each schema
        const schemasWithTables = await Promise.all(
          schemasResponse.data.map(async (schema) => {
            try {
              const tablesResponse = await databaseExplorerAPI.getTables(connection.id, schema.name);
              return {
                name: schema.name,
                tables: tablesResponse.success && tablesResponse.data
                  ? tablesResponse.data.map((t) => t.name)
                  : [],
              };
            } catch (error) {
              console.error(`Error loading tables for schema ${schema.name}:`, error);
              return { name: schema.name, tables: [] };
            }
          })
        );
        setAvailableSchemas(schemasWithTables);
      }
    } catch (error) {
      console.error("Error loading schemas:", error);
      toast.error("Failed to load schemas");
    } finally {
      setLoadingSchemas(false);
    }
  };

  const handleSchemaToggle = (schemaName: string) => {
    const newSelections = new Map(schemaSelections);
    if (newSelections.has(schemaName)) {
      // Deselect all tables but keep schema expanded
      newSelections.delete(schemaName);
    } else {
      // Select schema and all tables, and expand it
      const schema = availableSchemas.find((s) => s.name === schemaName);
      newSelections.set(schemaName, {
        schema: schemaName,
        allTables: true,
        tables: new Set(schema?.tables || []),
      });

      // Auto-expand when selecting
      const newExpanded = new Set(expandedSchemas);
      newExpanded.add(schemaName);
      setExpandedSchemas(newExpanded);
    }
    setSchemaSelections(newSelections);
    setSelectAllSchemas(false);
  };

  const handleSchemaExpand = (schemaName: string) => {
    const newExpanded = new Set(expandedSchemas);
    if (newExpanded.has(schemaName)) {
      newExpanded.delete(schemaName);
    } else {
      newExpanded.add(schemaName);
    }
    setExpandedSchemas(newExpanded);
  };

  const handleTableToggle = (schemaName: string, tableName: string) => {
    const newSelections = new Map(schemaSelections);
    let selection = newSelections.get(schemaName);

    // If schema is not selected, create a new selection with just this table
    if (!selection) {
      selection = {
        schema: schemaName,
        allTables: false,
        tables: new Set([tableName]),
      };
      newSelections.set(schemaName, selection);
    } else {
      const newTables = new Set(selection.tables);
      if (newTables.has(tableName)) {
        newTables.delete(tableName);
      } else {
        newTables.add(tableName);
      }

      const schema = availableSchemas.find((s) => s.name === schemaName);
      const allTablesSelected = schema ? newTables.size === schema.tables.length : false;

      // If no tables are selected, remove the schema selection entirely
      if (newTables.size === 0) {
        newSelections.delete(schemaName);
      } else {
        newSelections.set(schemaName, {
          schema: schemaName,
          allTables: allTablesSelected,
          tables: newTables,
        });
      }
    }

    setSchemaSelections(newSelections);
    setSelectAllSchemas(false);
  };

  const handleSelectAllSchemasToggle = () => {
    setSelectAllSchemas(!selectAllSchemas);
    setSchemaSelections(new Map());
  };

  const handleRetrain = async () => {
    if (!connection) return;

    setIsStarting(true);

    try {
      // Build schemas array for selective training
      const schemas = selectAllSchemas
        ? undefined
        : Array.from(schemaSelections.values()).map((sel) => ({
            schema: sel.schema,
            tables: sel.allTables ? undefined : Array.from(sel.tables),
          }));

      // Start rebuild job
      const result = await connectionsAPI.rebuildSchema(connection.id, {
        force: true,
        schemas,
        config: trainingConfig,
      });

      if (result.success && result.data.jobId) {
        // Subscribe to job updates
        socketService.subscribeToJob(result.data.jobId);

        // Setup job completion handler
        const handleJobCompleted = (payload: any) => {
          if (payload.jobId === result.data.jobId) {
            if (payload.event === 'completed') {
              toast.success("Schema rebuild completed", {
                description: `Successfully trained ${payload.result?.totalTables || 0} tables`,
              });
              onSuccess();
              socketService.off('job:event', handleJobCompleted);
            } else if (payload.event === 'failed') {
              toast.error("Schema rebuild failed", {
                description: payload.error || "An error occurred during rebuild",
              });
              socketService.off('job:event', handleJobCompleted);
            }
          }
        };

        socketService.on('job:event', handleJobCompleted);

        // Show start toast and close modal
        toast.info("Schema rebuild started", {
          description: "You'll be notified when it completes. You can continue working.",
        });

        onOpenChange(false);
      } else {
        toast.error("Failed to start rebuild", {
          description: result.error || "An error occurred",
        });
      }
    } catch (error: any) {
      console.error("Schema rebuild error:", error);
      const errorMessage = error?.response?.data?.message || error?.message || "An error occurred";
      toast.error("Failed to start rebuild", {
        description: errorMessage,
      });
    } finally {
      setIsStarting(false);
    }
  };

  const handleClose = () => {
    if (!isStarting) {
      onOpenChange(false);
    }
  };

  const selectedSchemasCount = selectAllSchemas
    ? availableSchemas.length
    : schemaSelections.size;

  const selectedTablesCount = selectAllSchemas
    ? availableSchemas.reduce((sum, s) => sum + s.tables.length, 0)
    : Array.from(schemaSelections.values()).reduce((sum, sel) => sum + sel.tables.size, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-100 dark:bg-blue-900/20">
              <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <DialogTitle>Rebuild Schema Cache</DialogTitle>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-sm">
                      <p className="text-sm">
                        This process will run in the background. You'll receive a notification when completed and can continue working in the meantime.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <DialogDescription className="mt-1">
                Train and cache schema metadata for{" "}
                <span className="font-semibold">{connection?.name}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6 py-4">
            {/* Selection Summary */}
            {!selectAllSchemas && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
                <Database className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <div className="flex-1 text-sm font-medium text-blue-900 dark:text-blue-100">
                  Selected: {selectedSchemasCount} schema{selectedSchemasCount !== 1 ? 's' : ''}, {selectedTablesCount} table{selectedTablesCount !== 1 ? 's' : ''}
                </div>
              </div>
            )}

            {/* Schema/Table Selection */}
            <Accordion type="single" collapsible defaultValue="schemas">
              <AccordionItem value="schemas">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    <span>Schema & Table Selection</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    {/* Select All Schemas */}
                    <div className="flex items-center space-x-3 p-2 rounded-md hover:bg-accent/50 transition-colors">
                      <Checkbox
                        id="select-all-schemas"
                        checked={selectAllSchemas}
                        onCheckedChange={handleSelectAllSchemasToggle}
                      />
                      <Label htmlFor="select-all-schemas" className="font-semibold cursor-pointer flex-1">
                        Train all schemas and tables
                      </Label>
                    </div>

                    {!selectAllSchemas && (
                      <>
                        {loadingSchemas ? (
                          <div className="text-sm text-muted-foreground">Loading schemas...</div>
                        ) : (
                          <div className="space-y-2 pl-6">
                            {availableSchemas.map((schema) => {
                              const selection = schemaSelections.get(schema.name);
                              const isSchemaSelected = !!selection;
                              const isExpanded = expandedSchemas.has(schema.name);

                              return (
                                <div key={schema.name} className="space-y-2">
                                  <div className="flex items-center space-x-2 p-2 rounded-md hover:bg-accent/50 transition-colors">
                                    {/* Expand/Collapse Arrow */}
                                    <button
                                      type="button"
                                      onClick={() => handleSchemaExpand(schema.name)}
                                      className="p-0.5 hover:bg-accent rounded transition-colors"
                                      aria-label={isExpanded ? "Collapse" : "Expand"}
                                    >
                                      {isExpanded ? (
                                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                      )}
                                    </button>

                                    {/* Schema Checkbox */}
                                    <Checkbox
                                      id={`schema-${schema.name}`}
                                      checked={isSchemaSelected}
                                      onCheckedChange={() => handleSchemaToggle(schema.name)}
                                    />
                                    <Label
                                      htmlFor={`schema-${schema.name}`}
                                      className="font-medium cursor-pointer flex-1"
                                    >
                                      {schema.name}
                                      <span className="text-xs text-muted-foreground ml-2">
                                        ({schema.tables.length} table{schema.tables.length !== 1 ? 's' : ''})
                                      </span>
                                    </Label>
                                  </div>

                                  {/* Table List - Show when expanded */}
                                  {isExpanded && (
                                    <div className="pl-8 space-y-1 border-l-2 border-border ml-2 py-1">
                                      {schema.tables.map((table) => (
                                        <div key={table} className="flex items-center space-x-3 p-1.5 rounded-md hover:bg-accent/30 transition-colors">
                                          <Checkbox
                                            id={`table-${schema.name}-${table}`}
                                            checked={isSchemaSelected && selection?.tables.has(table)}
                                            onCheckedChange={() => handleTableToggle(schema.name, table)}
                                          />
                                          <Label
                                            htmlFor={`table-${schema.name}-${table}`}
                                            className="text-sm cursor-pointer flex-1"
                                          >
                                            {table}
                                          </Label>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Training Configuration */}
              <AccordionItem value="config">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4" />
                    <span>Training Configuration</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-2">
                    <ConfigOption
                      id="schema-metadata"
                      label="Schema Metadata"
                      hint="Include schema-level information and properties"
                      checked={trainingConfig.includeSchemaMetadata}
                      onChange={(checked) =>
                        setTrainingConfig({ ...trainingConfig, includeSchemaMetadata: checked })
                      }
                    />
                    <ConfigOption
                      id="table-metadata"
                      label="Table Metadata"
                      hint="Include table-level information like types and properties"
                      checked={trainingConfig.includeTableMetadata}
                      onChange={(checked) =>
                        setTrainingConfig({ ...trainingConfig, includeTableMetadata: checked })
                      }
                    />
                    <ConfigOption
                      id="column-metadata"
                      label="Column Details"
                      hint="Include column names, types, nullability, and default values"
                      checked={trainingConfig.includeColumnMetadata}
                      onChange={(checked) =>
                        setTrainingConfig({ ...trainingConfig, includeColumnMetadata: checked })
                      }
                    />
                    <ConfigOption
                      id="indexes"
                      label="Indexes"
                      hint="Include index definitions and their columns"
                      checked={trainingConfig.includeIndexes}
                      onChange={(checked) =>
                        setTrainingConfig({ ...trainingConfig, includeIndexes: checked })
                      }
                    />
                    <ConfigOption
                      id="foreign-keys"
                      label="Foreign Keys"
                      hint="Include foreign key relationships and references"
                      checked={trainingConfig.includeForeignKeys}
                      onChange={(checked) =>
                        setTrainingConfig({ ...trainingConfig, includeForeignKeys: checked })
                      }
                    />
                    <ConfigOption
                      id="constraints"
                      label="Constraints"
                      hint="Include check constraints, unique constraints, etc."
                      checked={trainingConfig.includeConstraints}
                      onChange={(checked) =>
                        setTrainingConfig({ ...trainingConfig, includeConstraints: checked })
                      }
                    />
                    <ConfigOption
                      id="row-counts"
                      label="Row Counts"
                      hint="Include approximate row count for each table"
                      checked={trainingConfig.includeRowCounts}
                      onChange={(checked) =>
                        setTrainingConfig({ ...trainingConfig, includeRowCounts: checked })
                      }
                    />
                    <ConfigOption
                      id="sample-data"
                      label="Sample Data (Experimental)"
                      hint="Include sample rows from each table for AI context"
                      checked={trainingConfig.includeSampleData}
                      onChange={(checked) =>
                        setTrainingConfig({ ...trainingConfig, includeSampleData: checked })
                      }
                    />
                    {trainingConfig.includeSampleData && (
                      <div className="pl-6 flex items-center gap-2">
                        <Label htmlFor="sample-rows" className="text-sm whitespace-nowrap">
                          Sample rows:
                        </Label>
                        <Input
                          id="sample-rows"
                          type="number"
                          min={1}
                          max={20}
                          value={trainingConfig.sampleDataRowCount}
                          onChange={(e) =>
                            setTrainingConfig({
                              ...trainingConfig,
                              sampleDataRowCount: parseInt(e.target.value) || 5,
                            })
                          }
                          className="w-20"
                        />
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isStarting}>
            Cancel
          </Button>
          <Button onClick={handleRetrain} disabled={isStarting} className="gap-2">
            {isStarting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Start Rebuild
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper component for configuration options with tooltips
function ConfigOption({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center space-x-3 p-2 rounded-md hover:bg-accent/50 transition-colors">
      <Checkbox id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id} className="cursor-pointer flex items-center gap-2 flex-1">
        {label}
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground transition-colors cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <p className="text-sm">{hint}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </Label>
    </div>
  );
}
