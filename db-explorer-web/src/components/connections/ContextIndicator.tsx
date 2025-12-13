"use client";

import { cn } from "@/utils/ui";

interface ContextIndicatorProps {
  percentageUsed: number;
  totalTokens: number;
  maxTokens: number;
  messageCount: number;
  className?: string;
}

export function ContextIndicator({
  percentageUsed,
  className,
}: ContextIndicatorProps) {
  // Determine color based on percentage
  const getStatusColor = () => {
    if (percentageUsed < 50) {
      return "text-green-600 dark:text-green-400";
    } else if (percentageUsed < 80) {
      return "text-yellow-600 dark:text-yellow-400";
    } else {
      return "text-red-600 dark:text-red-400";
    }
  };

  const getFillColor = () => {
    if (percentageUsed < 50) {
      return "bg-green-500 dark:bg-green-400";
    } else if (percentageUsed < 80) {
      return "bg-yellow-500 dark:bg-yellow-400";
    } else {
      return "bg-red-500 dark:bg-red-400";
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2 py-1 rounded-full",
        className
      )}
    >
      {/* Circular fill indicator */}
      <div className="relative w-5 h-5">
        {/* Background circle */}
        <div className="absolute inset-0 rounded-full border-2 border-muted" />
        {/* Fill circle (clipped) */}
        <div className="absolute inset-0 overflow-hidden rounded-full">
          <div
            className={cn("w-full transition-all", getFillColor())}
            style={{
              height: `${Math.min(percentageUsed, 100)}%`,
              marginTop: `${100 - Math.min(percentageUsed, 100)}%`
            }}
          />
        </div>
      </div>
      {/* Percentage text */}
      <span className={cn("text-xs font-semibold", getStatusColor())}>
        {percentageUsed}%
      </span>
    </div>
  );
}
