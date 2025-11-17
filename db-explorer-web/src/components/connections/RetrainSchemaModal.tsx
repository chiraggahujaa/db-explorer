"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RefreshCw, Database, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { schemaTrainingAPI } from "@/lib/api/connections";
import type { ConnectionWithRole } from "@/types/connection";

interface RetrainSchemaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: ConnectionWithRole | null;
  onSuccess: () => void;
}

export function RetrainSchemaModal({
  open,
  onOpenChange,
  connection,
  onSuccess,
}: RetrainSchemaModalProps) {
  const [isTraining, setIsTraining] = useState(false);
  const [trainingComplete, setTrainingComplete] = useState(false);

  const handleRetrain = async () => {
    if (!connection) return;

    setIsTraining(true);
    setTrainingComplete(false);

    try {
      const result = await schemaTrainingAPI.trainSchema(connection.id, true);

      if (result.success && result.status === 'completed') {
        setTrainingComplete(true);
        toast.success("Schema training completed successfully");
        onSuccess();

        // Auto-close after success
        setTimeout(() => {
          handleClose();
        }, 2000);
      } else if (result.status === 'training') {
        toast.info("Schema training is in progress", {
          description: "This may take a few minutes. You can continue working.",
        });
        onOpenChange(false);
      } else {
        toast.error(result.message || "Failed to train schema");
      }
    } catch (error: any) {
      console.error("Schema training error:", error);
      const errorMessage = error?.response?.data?.message || error?.message || "An error occurred";
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
      setTrainingComplete(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              trainingComplete
                ? "bg-green-100 dark:bg-green-900/20"
                : "bg-blue-100 dark:bg-blue-900/20"
            }`}>
              {trainingComplete ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : (
                <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              )}
            </div>
            <div>
              <DialogTitle>
                {trainingComplete ? "Training Complete" : "Re-train Schema"}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {trainingComplete
                  ? "Schema cache has been updated"
                  : "Update cached schema metadata"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {trainingComplete ? (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 text-sm">
                <p className="font-medium text-green-900 dark:text-green-100">
                  Schema successfully trained
                </p>
                <p className="text-green-700 dark:text-green-300 mt-1">
                  The cached schema metadata for{" "}
                  <span className="font-semibold">{connection?.name}</span> has been
                  updated and is now available for AI-powered queries.
                </p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                This will analyze and cache the complete schema structure of{" "}
                <span className="font-semibold text-foreground">
                  {connection?.name}
                </span>
                , including:
              </p>

              <ul className="text-sm text-muted-foreground space-y-2 ml-4">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>All database schemas and tables</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>Column names, types, and constraints</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>Indexes and foreign key relationships</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>Approximate row counts</span>
                </li>
              </ul>

              <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
                <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 text-sm text-blue-900 dark:text-blue-100">
                  <p className="font-medium">Why re-train?</p>
                  <p className="text-blue-700 dark:text-blue-300 mt-1">
                    Re-train if you've made structural changes to your database
                    (added/removed tables, columns, or relationships). This ensures
                    AI-powered queries have accurate context.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          {!trainingComplete && (
            <>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isTraining}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRetrain}
                disabled={isTraining}
                className="gap-2"
              >
                {isTraining ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Training...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Start Training
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
