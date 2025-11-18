"use client";

import * as React from "react";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Command as CommandPrimitive } from "cmdk";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";

export interface SearchableSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

export interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  triggerClassName?: string;
  popoverClassName?: string;
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select option...",
  emptyText = "No options found.",
  searchPlaceholder = "Search...",
  disabled = false,
  isLoading = false,
  triggerClassName,
  popoverClassName,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);

  const selectedOption = options.find((option) => option.value === value);

  const handleSelect = (selectedValue: string) => {
    // Use setTimeout to ensure Popover closes before state updates
    setTimeout(() => {
      onValueChange(selectedValue);
      setOpen(false);
    }, 0);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-[160px] justify-between h-9",
            !selectedOption && "text-muted-foreground",
            triggerClassName
          )}
          disabled={disabled}
        >
          {selectedOption ? (
            <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
              {selectedOption.icon && (
                <span className="shrink-0">{selectedOption.icon}</span>
              )}
              <span className="truncate flex-1">{selectedOption.label}</span>
            </div>
          ) : (
            <span className="text-muted-foreground truncate">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-[var(--radix-popover-trigger-width)] p-0", popoverClassName)} align="start">
        <Command className="[&_[cmdk-item]]:!pl-0 [&_[cmdk-group]]:!p-0">
          {/* Custom CommandInput without search icon */}
          <div className="flex h-9 items-center border-b px-0">
            <CommandPrimitive.Input
              placeholder={searchPlaceholder}
              className="flex h-full w-full rounded-md bg-transparent pl-0 pr-3 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <CommandList className="[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <LoadingSpinner size={16} className="mr-2" />
                <span className="text-sm text-muted-foreground">Loading...</span>
              </div>
            ) : (
              <>
                <CommandEmpty>{emptyText}</CommandEmpty>
                <CommandGroup className="!p-0">
                  {options.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={handleSelect}
                      className="!pl-2 pr-3 py-2 m-0"
                      style={{ paddingLeft: '0.5rem' }}
                    >
                      <div className={cn(
                        "w-1 h-4 shrink-0 mr-2 rounded-sm transition-colors",
                        value === option.value ? "bg-foreground/60" : "bg-transparent"
                      )} />
                      <span className="flex-1 truncate">{option.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

