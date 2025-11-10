"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/utils/ui";
import { Input } from "@/components/ui/input";

export interface SearchInputProps extends React.ComponentProps<"input"> {
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  showIcon?: boolean;
}

export function SearchInput({
  className,
  icon,
  iconPosition = "left",
  showIcon = true,
  ...props
}: SearchInputProps) {
  const IconComponent = icon || <Search className="w-4 h-4 text-muted-foreground" />;

  if (iconPosition === "right") {
    return (
      <div className="relative">
        <Input
          className={cn("pr-9", className)}
          {...props}
        />
        {showIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {IconComponent}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      {showIcon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {IconComponent}
        </div>
      )}
      <Input
        className={cn(showIcon && "pl-9", className)}
        {...props}
      />
    </div>
  );
}

