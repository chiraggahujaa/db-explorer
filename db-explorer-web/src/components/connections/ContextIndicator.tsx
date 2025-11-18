"use client";

import { Database, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/utils/ui";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ContextIndicatorProps {
  percentageUsed: number;
  totalTokens: number;
  maxTokens: number;
  messageCount: number;
  className?: string;
}

export function ContextIndicator({
  percentageUsed,
  totalTokens,
  maxTokens,
  messageCount,
  className,
}: ContextIndicatorProps) {
  // Determine color and status based on percentage
  const getStatusColor = () => {
    if (percentageUsed < 50) {
      return "text-green-600 dark:text-green-400";
    } else if (percentageUsed < 80) {
      return "text-yellow-600 dark:text-yellow-400";
    } else {
      return "text-red-600 dark:text-red-400";
    }
  };

  const getStatusIcon = () => {
    if (percentageUsed < 80) {
      return <CheckCircle className="h-3 w-3" />;
    } else {
      return <AlertCircle className="h-3 w-3" />;
    }
  };

  const getStatusMessage = () => {
    if (percentageUsed < 50) {
      return "Context window has plenty of space";
    } else if (percentageUsed < 80) {
      return "Context window is moderately used";
    } else {
      return "Context window is nearing capacity. Old messages may be summarized.";
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex items-center gap-2 px-2.5 py-1 rounded-full bg-muted/50 hover:bg-muted transition-colors cursor-help",
              className
            )}
          >
            <Database className="h-3 w-3 text-muted-foreground" />
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Context:
              </span>
              <span className={cn("text-xs font-semibold", getStatusColor())}>
                {percentageUsed}%
              </span>
              {getStatusIcon()}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs bg-popover text-popover-foreground border-border" side="bottom">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">{getStatusMessage()}</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Messages:</span>
                <span className="font-medium text-foreground">{messageCount}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Tokens Used:</span>
                <span className="font-medium text-foreground">
                  {totalTokens.toLocaleString()} / {maxTokens.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Capacity:</span>
                <span className="font-medium text-foreground">{percentageUsed}%</span>
              </div>
            </div>
            <div className="pt-2 border-t border-border">
              <div className="w-full bg-muted/30 rounded-full h-1.5">
                <div
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    percentageUsed < 50
                      ? "bg-green-500 dark:bg-green-400"
                      : percentageUsed < 80
                      ? "bg-yellow-500 dark:bg-yellow-400"
                      : "bg-red-500 dark:bg-red-400"
                  )}
                  style={{ width: `${Math.min(percentageUsed, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
