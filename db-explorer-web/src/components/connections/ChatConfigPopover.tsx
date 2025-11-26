"use client";

import { Sliders } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useConnectionExplorer } from "@/contexts/ConnectionExplorerContext";

export function ChatConfigPopover() {
  const { chatConfig, updateChatConfig } = useConnectionExplorer();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          title="Chat Configuration"
        >
          <Sliders className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-sm mb-1">Chat Configuration</h4>
          </div>

          <Separator />

          {/* Read Only Mode */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="read-only-mode" className="text-sm font-normal">
                Read Only Mode
              </Label>
              <Switch
                id="read-only-mode"
                checked={chatConfig.readOnlyMode}
                onCheckedChange={(checked) =>
                  updateChatConfig({ readOnlyMode: checked })
                }
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Blocks INSERT, UPDATE, and DELETE operations
            </p>
          </div>

          <Separator />

          {/* SQL Generation */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="show-sql" className="text-sm font-normal">
                Show SQL Generation
              </Label>
              <Switch
                id="show-sql"
                checked={chatConfig.showSQLGeneration}
                onCheckedChange={(checked) =>
                  updateChatConfig({ showSQLGeneration: checked })
                }
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Generate SQL without executing. Only inspects schema/tables.
            </p>
          </div>

          <Separator />

          {/* Auto-execute Queries */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-execute" className="text-sm font-normal">
                Auto-execute Queries
              </Label>
              <Switch
                id="auto-execute"
                checked={chatConfig.autoExecuteQueries}
                onCheckedChange={(checked) =>
                  updateChatConfig({ autoExecuteQueries: checked })
                }
              />
            </div>
            <p className="text-xs text-muted-foreground">
              When OFF, ask for confirmation before executing any tool call
            </p>
          </div>

          <Separator />

          {/* Result Row Limit */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label htmlFor="row-limit" className="text-sm font-normal">
                Result Row Limit
              </Label>
              <span className="text-sm font-medium text-muted-foreground">
                {chatConfig.resultRowLimit}
              </span>
            </div>
            <Slider
              id="row-limit"
              min={10}
              max={1000}
              step={10}
              value={[chatConfig.resultRowLimit]}
              onValueChange={(values) =>
                updateChatConfig({ resultRowLimit: values[0] })
              }
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Strictly enforced max rows (10-1000). LIMIT added to all queries.
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
