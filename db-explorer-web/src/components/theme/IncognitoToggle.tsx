"use client";

import { useEffect, useState } from "react";
import { EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/utils/ui";

export function IncognitoToggle() {
  const [mounted, setMounted] = useState(false);
  const [isIncognito, setIsIncognito] = useState(false);

  useEffect(() => {
    setMounted(true);

    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('incognito-mode');
      if (saved !== null) {
        setIsIncognito(saved === 'true');
      }
    }
  }, []);

  const toggleIncognito = () => {
    const newValue = !isIncognito;
    setIsIncognito(newValue);

    if (typeof window !== 'undefined') {
      localStorage.setItem('incognito-mode', String(newValue));
      window.dispatchEvent(new CustomEvent('incognito-mode-change', { detail: { enabled: newValue } }));
    }
  };

  if (!mounted) {
    return (
      <Button variant="outline" size="icon" className="h-9 w-9">
        <EyeOff className="h-[1.2rem] w-[1.2rem]" />
        <span className="sr-only">Toggle incognito mode</span>
      </Button>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={toggleIncognito}
            className={cn(
              "h-9 w-9",
              isIncognito &&
              "bg-purple-500/10 border-purple-500/50 text-purple-500 hover:bg-purple-500/20 hover:text-purple-600 dark:hover:text-purple-400"
            )}
            aria-pressed={isIncognito}
          >
            <EyeOff className="h-[1.2rem] w-[1.2rem]" />
            <span className="sr-only">Toggle incognito mode</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-center">
            <p className="font-medium">
              Incognito Mode {isIncognito ? '(Active)' : '(Inactive)'}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
