"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { useIncognito } from "@/contexts/IncognitoContext";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Incognito mode toggle component that restricts AI data access
 * When enabled, AI can only access schema metadata (tables, columns)
 * and cannot query actual database records
 *
 * Usage:
 * ```tsx
 * <IncognitoToggle />
 * ```
 */
export function IncognitoToggle() {
  const { incognitoMode, toggleIncognito } = useIncognito();
  const isIncognito = incognitoMode;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={toggleIncognito}
            className={isIncognito ? "border-orange-500 dark:border-orange-400" : ""}
          >
            <Eye className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all data-[incognito=true]:-rotate-90 data-[incognito=true]:scale-0" data-incognito={isIncognito} />
            <EyeOff className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all data-[incognito=true]:rotate-0 data-[incognito=true]:scale-100 text-orange-500 dark:text-orange-400" data-incognito={isIncognito} />
            <span className="sr-only">Toggle incognito mode</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm">
            <div className="font-semibold mb-1">
              {isIncognito ? "Incognito Mode: ON" : "Incognito Mode: OFF"}
            </div>
            <div className="text-muted-foreground max-w-xs">
              {isIncognito
                ? "AI can only see schema structure. Data queries are blocked."
                : "AI has full access to query and analyze database records."}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
