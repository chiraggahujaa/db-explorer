"use client";

import { useState } from "react";
import { Settings2, Shield, Lock, ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useDataAccessStore } from "@/stores/useDataAccessStore";
import { cn } from "@/utils/ui";

interface DataAccessConfigProps {
  connectionId: string;
  className?: string;
}

const PRESET_LIMITS = [10, 100, 200, 500, 1000];

export function DataAccessConfig({ connectionId, className }: DataAccessConfigProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState("");

  const {
    getConfig,
    setReadOnly,
    setPrivacyMode,
    setRowLimit,
    setCustomRowLimit,
  } = useDataAccessStore();

  const config = getConfig(connectionId);
  const hasActiveRestrictions = config.readOnly || config.privacyMode || config.rowLimit !== 100;

  const handleLimitChange = (value: string) => {
    if (value === "custom") {
      setShowCustomInput(true);
    } else {
      setShowCustomInput(false);
      setRowLimit(connectionId, parseInt(value));
    }
  };

  const handleCustomLimitSubmit = () => {
    const limit = parseInt(customValue);
    if (!isNaN(limit) && limit > 0) {
      setCustomRowLimit(connectionId, limit);
      setShowCustomInput(false);
      setCustomValue("");
    }
  };

  const isPresetLimit = PRESET_LIMITS.includes(config.rowLimit);
  const currentLimitValue = isPresetLimit ? config.rowLimit.toString() : "custom";

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="lg"
          className={cn(
            "rounded-full w-12 h-12 p-0 relative",
            hasActiveRestrictions && "border-blue-500 dark:border-blue-400",
            className
          )}
          title="Data Access Configuration"
        >
          <Settings2 className={cn(
            "w-5 h-5",
            hasActiveRestrictions && "text-blue-500 dark:text-blue-400"
          )} />
          {hasActiveRestrictions && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-background" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-sm mb-1">Data Access Configuration</h4>
            <p className="text-xs text-muted-foreground">
              Control how the AI can access and query your database
            </p>
          </div>

          <Separator />

          {/* Read Only Mode */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-muted-foreground" />
                <Label htmlFor="read-only" className="text-sm font-medium cursor-pointer">
                  Read Only
                </Label>
              </div>
              <Switch
                id="read-only"
                checked={config.readOnly}
                onCheckedChange={(checked) => setReadOnly(connectionId, checked)}
              />
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              Only allow SELECT queries. Prevents INSERT, UPDATE, DELETE operations.
            </p>
          </div>

          <Separator />

          {/* Privacy Mode */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-muted-foreground" />
                <Label htmlFor="privacy-mode" className="text-sm font-medium cursor-pointer">
                  Privacy Mode
                </Label>
              </div>
              <Switch
                id="privacy-mode"
                checked={config.privacyMode}
                onCheckedChange={(checked) => setPrivacyMode(connectionId, checked)}
              />
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              AI can only see schema metadata (tables, columns). Data is fetched via API without AI access.
            </p>
          </div>

          <Separator />

          {/* Row Limit */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <ListFilter className="w-4 h-4 text-muted-foreground" />
              <Label htmlFor="row-limit" className="text-sm font-medium">
                Row Limit
              </Label>
            </div>
            <Select
              value={currentLimitValue}
              onValueChange={handleLimitChange}
            >
              <SelectTrigger id="row-limit" className="w-full">
                <SelectValue placeholder="Select row limit" />
              </SelectTrigger>
              <SelectContent>
                {PRESET_LIMITS.map((limit) => (
                  <SelectItem key={limit} value={limit.toString()}>
                    {limit} rows
                  </SelectItem>
                ))}
                <SelectItem value="custom">
                  Custom {!isPresetLimit && `(${config.rowLimit})`}
                </SelectItem>
              </SelectContent>
            </Select>

            {showCustomInput && (
              <div className="flex gap-2 mt-2">
                <Input
                  type="number"
                  min="1"
                  placeholder="Enter custom limit"
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleCustomLimitSubmit();
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  onClick={handleCustomLimitSubmit}
                  disabled={!customValue || isNaN(parseInt(customValue)) || parseInt(customValue) <= 0}
                >
                  Set
                </Button>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Maximum number of rows to fetch in a single query. Default: 100
            </p>
          </div>

          {hasActiveRestrictions && (
            <>
              <Separator />
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                  Active Restrictions:
                </p>
                <ul className="text-xs text-blue-600 dark:text-blue-400 mt-1 space-y-1 ml-4 list-disc">
                  {config.readOnly && <li>Read-only mode enabled</li>}
                  {config.privacyMode && <li>Privacy mode enabled</li>}
                  {config.rowLimit !== 100 && <li>Row limit: {config.rowLimit}</li>}
                </ul>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
