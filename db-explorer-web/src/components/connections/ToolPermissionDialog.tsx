"use client";

import { useState } from "react";
import { Shield, AlertTriangle, CheckCircle2, XCircle, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface ToolPermissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toolName: string;
  toolDescription?: string;
  toolArgs?: Record<string, any>;
  riskLevel?: 'low' | 'medium' | 'high';
  isDestructive?: boolean;
  onExecuteOnce: () => void;
  onExecuteAndRemember: () => void;
  onDeny: () => void;
}

const getRiskColor = (riskLevel: string) => {
  switch (riskLevel) {
    case 'high':
      return 'text-red-600 dark:text-red-400';
    case 'medium':
      return 'text-yellow-600 dark:text-yellow-400';
    default:
      return 'text-green-600 dark:text-green-400';
  }
};

const getRiskBadge = (riskLevel: string) => {
  switch (riskLevel) {
    case 'high':
      return <Badge variant="destructive">High Risk</Badge>;
    case 'medium':
      return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Medium Risk</Badge>;
    default:
      return <Badge variant="outline" className="border-green-500 text-green-600">Low Risk</Badge>;
  }
};

export function ToolPermissionDialog({
  open,
  onOpenChange,
  toolName,
  toolDescription,
  toolArgs,
  riskLevel = 'low',
  isDestructive = false,
  onExecuteOnce,
  onExecuteAndRemember,
  onDeny,
}: ToolPermissionDialogProps) {
  const [remember, setRemember] = useState(false);

  const handleExecute = () => {
    if (remember) {
      onExecuteAndRemember();
    } else {
      onExecuteOnce();
    }
    onOpenChange(false);
    setRemember(false);
  };

  const handleDeny = () => {
    onDeny();
    onOpenChange(false);
    setRemember(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <DialogTitle>Permission Required</DialogTitle>
              <DialogDescription>
                The AI needs your permission to execute a tool
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border p-4 bg-muted/50">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold">{toolName}</h4>
              <div className="flex gap-2">
                {getRiskBadge(riskLevel)}
                {isDestructive && (
                  <Badge variant="destructive">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Destructive
                  </Badge>
                )}
              </div>
            </div>
            {toolDescription && (
              <p className="text-sm text-muted-foreground">
                {toolDescription}
              </p>
            )}
          </div>

          {toolArgs && Object.keys(toolArgs).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Tool Parameters:</h4>
              <div className="rounded-lg border p-3 bg-background max-h-40 overflow-y-auto">
                <pre className="text-xs">
                  {JSON.stringify(toolArgs, null, 2)}
                </pre>
              </div>
            </div>
          )}

          <Separator />

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Execute Once</p>
                <p className="text-xs text-muted-foreground">
                  Allow this tool to run this time only. You'll be asked again next time.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Execute and Remember</p>
                <p className="text-xs text-muted-foreground">
                  Allow this tool and automatically approve it for future use. You can change this in settings.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Deny</p>
                <p className="text-xs text-muted-foreground">
                  Reject this tool execution. The AI won't be able to use it.
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex items-center space-x-2">
            <Checkbox
              id="remember"
              checked={remember}
              onCheckedChange={(checked) => setRemember(checked as boolean)}
            />
            <Label
              htmlFor="remember"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Remember my choice and auto-approve this tool in the future
            </Label>
          </div>

          {isDestructive && (
            <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-3">
              <div className="flex gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-900 dark:text-red-100">
                    Warning: Destructive Operation
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                    This tool can modify or delete data. Please review the parameters carefully before approving.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleDeny}>
            <XCircle className="w-4 h-4 mr-2" />
            Deny
          </Button>
          <Button variant="default" onClick={handleExecute}>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            {remember ? 'Execute & Remember' : 'Execute Once'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
