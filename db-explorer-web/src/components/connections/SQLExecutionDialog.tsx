"use client";

import { useState } from "react";
import { Copy, Play, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface SQLExecutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sql: string;
  onExecuteOnce: () => void;
  onExecuteAndRemember: () => void;
}

export function SQLExecutionDialog({
  open,
  onOpenChange,
  sql,
  onExecuteOnce,
  onExecuteAndRemember,
}: SQLExecutionDialogProps) {
  const [isCopying, setIsCopying] = useState(false);

  const handleCopy = async () => {
    try {
      setIsCopying(true);
      await navigator.clipboard.writeText(sql);
      toast.success("SQL copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy SQL");
    } finally {
      setTimeout(() => setIsCopying(false), 1000);
    }
  };

  const handleExecuteOnce = () => {
    onExecuteOnce();
    onOpenChange(false);
  };

  const handleExecuteAndRemember = () => {
    onExecuteAndRemember();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] w-full max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-purple-500">🔒</span>
            Execute SQL Query in Incognito Mode?
          </DialogTitle>
          <DialogDescription>
            This query was generated but not executed because Incognito Mode is active.
            Choose how you would like to proceed:
          </DialogDescription>
        </DialogHeader>

        <div className="my-4">
          <div className="rounded-lg overflow-hidden border border-border">
            <SyntaxHighlighter
              language="sql"
              style={oneDark}
              customStyle={{
                margin: 0,
                borderRadius: 0,
                fontSize: '0.875rem',
              }}
            >
              {sql}
            </SyntaxHighlighter>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleCopy}
            disabled={isCopying}
            className="w-full sm:w-auto"
          >
            <Copy className="h-4 w-4 mr-2" />
            {isCopying ? "Copied!" : "Copy SQL"}
          </Button>

          <div className="flex flex-col sm:flex-row gap-2 flex-1">
            <Button
              variant="secondary"
              onClick={handleExecuteOnce}
              className="flex-1"
            >
              <Play className="h-4 w-4 mr-2" />
              Execute Once
            </Button>

            <Button
              onClick={handleExecuteAndRemember}
              className="flex-1 bg-purple-500 hover:bg-purple-600 text-white"
            >
              <PlayCircle className="h-4 w-4 mr-2" />
              Execute & Remember
            </Button>
          </div>
        </DialogFooter>

        <div className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
          <p>
            <strong>Execute Once:</strong> Run this query one time only.
          </p>
          <p className="mt-1">
            <strong>Execute & Remember:</strong> Run and auto-execute future queries this session
            (resets on page refresh).
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
