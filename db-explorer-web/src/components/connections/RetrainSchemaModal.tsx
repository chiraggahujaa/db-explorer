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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { RefreshCw, Database, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { schemaTrainingAPI, connectionsAPI } from "@/lib/api/connections";
import type { ConnectionWithRole } from "@/types/connection";

interface RetrainSchemaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: ConnectionWithRole | null;
  onSuccess: () => void;
}

interface SchemaWithTables {
  name: string;
  tables: Array<{ name: string; selected: boolean }>;
  selected: boolean;
}

interface TrainingOptions {
  includeColumns: boolean;
  includeTypes: boolean;
  includeConstraints: boolean;
  includeIndexes: boolean;
  includeForeignKeys: boolean;
}

export function RetrainSchemaModal({
  open,
  onOpenChange,
  connection,
  onSuccess,
}: RetrainSchemaModalProps) {
  const [isTraining, setIsTraining] = useState(false);
  const [isLoadingSchemas, setIsLoadingSchemas] = useState(false);
  const [schemas, setSchemas] = useState<SchemaWithTables[]>([]);
  const [trainingOptions, setTrainingOptions] = useState<TrainingOptions>({
    includeColumns: true,
    includeTypes: true,
    includeConstraints: true,
    includeIndexes: true,
    includeForeignKeys: true,
  });
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Fetch schemas and tables when modal opens
  useEffect(() => {
    if (open && connection) {
      loadSchemasAndTables();
    }
  }, [open, connection]);

  const loadSchemasAndTables = async () => {
    if (!connection) return;

    setIsLoadingSchemas(true);
    try {
      // Fetch schemas
      const schemasResponse = await connectionsAPI.getSchemas(connection.id);
      if (!schemasResponse.success || !schemasResponse.data) {
        throw new Error("Failed to fetch schemas");
      }

      // Fetch tables for each schema
      const schemasWithTables: SchemaWithTables[] = await Promise.all(
        schemasResponse.data.map(async (schema) => {
          try {
            const tablesResponse = await connectionsAPI.getTables(
              connection.id,
              schema.name
            );

            return {
              name: schema.name,
              selected: true, // Default: select all schemas
              tables:
                tablesResponse.success && tablesResponse.data
                  ? tablesResponse.data.map((table) => ({
                      name: table.name,
                      selected: true, // Default: select all tables
                    }))
                  : [],
            };
          } catch (error) {
            console.error(`Error fetching tables for schema ${schema.name}:`, error);
            return {
              name: schema.name,
              selected: true,
              tables: [],
            };
          }
        })
      );

      setSchemas(schemasWithTables);
    } catch (error) {
      console.error("Error loading schemas:", error);
      toast.error("Failed to load schemas", {
        description: "Could not fetch schema list from the database",
      });
    } finally {
      setIsLoadingSchemas(false);
    }
  };

  const toggleSchema = (schemaName: string) => {
    setSchemas((prev) =>
      prev.map((schema) =>
        schema.name === schemaName
          ? {
              ...schema,
              selected: !schema.selected,
              // If selecting schema, select all tables; if deselecting, deselect all
              tables: schema.tables.map((table) => ({
                ...table,
                selected: !schema.selected,
              })),
            }
          : schema
      )
    );
  };

  const toggleTable = (schemaName: string, tableName: string) => {
    setSchemas((prev) =>
      prev.map((schema) => {
        if (schema.name !== schemaName) return schema;

        const updatedTables = schema.tables.map((table) =>
          table.name === tableName
            ? { ...table, selected: !table.selected }
            : table
        );

        // Update schema selection based on tables
        const anyTableSelected = updatedTables.some((t) => t.selected);

        return {
          ...schema,
          tables: updatedTables,
          selected: anyTableSelected,
        };
      })
    );
  };

  const selectAllSchemas = () => {
    setSchemas((prev) =>
      prev.map((schema) => ({
        ...schema,
        selected: true,
        tables: schema.tables.map((table) => ({ ...table, selected: true })),
      }))
    );
  };

  const deselectAllSchemas = () => {
    setSchemas((prev) =>
      prev.map((schema) => ({
        ...schema,
        selected: false,
        tables: schema.tables.map((table) => ({ ...table, selected: false })),
      }))
    );
  };

  const handleRetrain = async () => {
    if (!connection) return;

    // Validate selection
    const selectedSchemas = schemas.filter((s) => s.selected);
    if (selectedSchemas.length === 0) {
      toast.error("No schemas selected", {
        description: "Please select at least one schema to train",
      });
      return;
    }

    // Check if any tables are selected
    const hasSelectedTables = selectedSchemas.some((schema) =>
      schema.tables.some((t) => t.selected)
    );
    if (!hasSelectedTables) {
      toast.error("No tables selected", {
        description: "Please select at least one table to train",
      });
      return;
    }

    setIsTraining(true);

    try {
      // Build options object
      const options = {
        schemas: selectedSchemas.map((s) => s.name),
        tables: selectedSchemas.flatMap((schema) =>
          schema.tables
            .filter((t) => t.selected)
            .map((t) => ({ schema: schema.name, table: t.name }))
        ),
        includeColumns: trainingOptions.includeColumns,
        includeTypes: trainingOptions.includeTypes,
        includeConstraints: trainingOptions.includeConstraints,
        includeIndexes: trainingOptions.includeIndexes,
        includeForeignKeys: trainingOptions.includeForeignKeys,
      };

      const result = await schemaTrainingAPI.trainSchema(connection.id, true, options);

      if (result.success && result.status === "queued") {
        toast.success("Schema training queued", {
          description:
            "Your training job has been queued. You'll receive a notification when it completes.",
        });
        onSuccess();
        handleClose();
      } else if (result.status === "training") {
        toast.info("Schema training is in progress", {
          description: "This may take a few minutes. You can continue working.",
        });
        onOpenChange(false);
      } else {
        toast.error(result.message || "Failed to train schema");
      }
    } catch (error: any) {
      console.error("Schema training error:", error);
      const errorMessage =
        error?.response?.data?.message || error?.message || "An error occurred";
      toast.error("Schema training failed", {
        description: errorMessage,
      });
    } finally {
      setIsTraining(false);
    }
  };

  const handleClose = () => {
    if (!isTraining) {
      onOpenChange(false);
      // Reset to defaults on close
      setShowAdvancedOptions(false);
    }
  };

  const selectedSchemasCount = schemas.filter((s) => s.selected).length;
  const selectedTablesCount = schemas.reduce(
    (count, schema) => count + schema.tables.filter((t) => t.selected).length,
    0
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-100 dark:bg-blue-900/20">
              <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <DialogTitle>Configure Schema Training</DialogTitle>
              <DialogDescription className="mt-1">
                Customize what to train for {connection?.name}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4 py-4">
          {/* Info Banner */}
          <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 text-sm text-blue-900 dark:text-blue-100">
              <p className="font-medium">Why customize training?</p>
              <p className="text-blue-700 dark:text-blue-300 mt-1">
                Select specific schemas and tables to train for faster processing, or
                choose which metadata types to include based on your needs.
              </p>
            </div>
          </div>

          {/* Selection Summary */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="text-sm">
              <span className="font-medium">Selected:</span>{" "}
              <span className="text-muted-foreground">
                {selectedSchemasCount} {selectedSchemasCount === 1 ? "schema" : "schemas"},{" "}
                {selectedTablesCount} {selectedTablesCount === 1 ? "table" : "tables"}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAllSchemas}
                disabled={isLoadingSchemas}
              >
                Select All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={deselectAllSchemas}
                disabled={isLoadingSchemas}
              >
                Deselect All
              </Button>
            </div>
          </div>

          {/* Schema and Table Selection */}
          {isLoadingSchemas ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading schemas...</span>
            </div>
          ) : (
            <ScrollArea className="h-64 rounded-md border p-4">
              <Accordion type="multiple" className="space-y-2">
                {schemas.map((schema) => (
                  <AccordionItem key={schema.name} value={schema.name} className="border rounded-lg px-4">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id={`schema-${schema.name}`}
                        checked={schema.selected}
                        onCheckedChange={() => toggleSchema(schema.name)}
                      />
                      <AccordionTrigger className="flex-1 hover:no-underline">
                        <div className="flex items-center justify-between flex-1 pr-3">
                          <Label
                            htmlFor={`schema-${schema.name}`}
                            className="font-medium cursor-pointer"
                          >
                            {schema.name}
                          </Label>
                          <span className="text-xs text-muted-foreground">
                            {schema.tables.filter((t) => t.selected).length}/{schema.tables.length}{" "}
                            tables
                          </span>
                        </div>
                      </AccordionTrigger>
                    </div>
                    <AccordionContent>
                      <div className="ml-9 mt-2 space-y-2">
                        {schema.tables.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No tables found</p>
                        ) : (
                          schema.tables.map((table) => (
                            <div key={table.name} className="flex items-center gap-2">
                              <Checkbox
                                id={`table-${schema.name}-${table.name}`}
                                checked={table.selected}
                                onCheckedChange={() => toggleTable(schema.name, table.name)}
                              />
                              <Label
                                htmlFor={`table-${schema.name}-${table.name}`}
                                className="text-sm cursor-pointer"
                              >
                                {table.name}
                              </Label>
                            </div>
                          ))
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </ScrollArea>
          )}

          {/* Training Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Training Options</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              >
                {showAdvancedOptions ? "Hide" : "Show"} Options
              </Button>
            </div>

            {showAdvancedOptions && (
              <div className="grid grid-cols-2 gap-3 p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="include-columns"
                    checked={trainingOptions.includeColumns}
                    onCheckedChange={(checked) =>
                      setTrainingOptions((prev) => ({
                        ...prev,
                        includeColumns: checked as boolean,
                      }))
                    }
                  />
                  <Label htmlFor="include-columns" className="text-sm cursor-pointer">
                    Include Columns
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="include-types"
                    checked={trainingOptions.includeTypes}
                    onCheckedChange={(checked) =>
                      setTrainingOptions((prev) => ({
                        ...prev,
                        includeTypes: checked as boolean,
                      }))
                    }
                  />
                  <Label htmlFor="include-types" className="text-sm cursor-pointer">
                    Include Data Types
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="include-constraints"
                    checked={trainingOptions.includeConstraints}
                    onCheckedChange={(checked) =>
                      setTrainingOptions((prev) => ({
                        ...prev,
                        includeConstraints: checked as boolean,
                      }))
                    }
                  />
                  <Label htmlFor="include-constraints" className="text-sm cursor-pointer">
                    Include Constraints
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="include-indexes"
                    checked={trainingOptions.includeIndexes}
                    onCheckedChange={(checked) =>
                      setTrainingOptions((prev) => ({
                        ...prev,
                        includeIndexes: checked as boolean,
                      }))
                    }
                  />
                  <Label htmlFor="include-indexes" className="text-sm cursor-pointer">
                    Include Indexes
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="include-foreign-keys"
                    checked={trainingOptions.includeForeignKeys}
                    onCheckedChange={(checked) =>
                      setTrainingOptions((prev) => ({
                        ...prev,
                        includeForeignKeys: checked as boolean,
                      }))
                    }
                  />
                  <Label htmlFor="include-foreign-keys" className="text-sm cursor-pointer">
                    Include Foreign Keys
                  </Label>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isTraining}>
            Cancel
          </Button>
          <Button
            onClick={handleRetrain}
            disabled={isTraining || isLoadingSchemas || selectedTablesCount === 0}
            className="gap-2"
          >
            {isTraining ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Queueing Training...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Start Training
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
