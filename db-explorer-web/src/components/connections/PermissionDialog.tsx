"use client";

import { AlertTriangle, CheckCircle2, XCircle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { MCPPermissionRequest } from "@/stores/useMCPStore";

interface PermissionDialogProps {
  permission: MCPPermissionRequest;
  onApprove: (alwaysAllow: boolean) => void;
  onDeny: () => void;
}

export function PermissionDialog({
  permission,
  onApprove,
  onDeny,
}: PermissionDialogProps) {
  return (
    <Card className="border-yellow-200 bg-yellow-50/50 dark:border-yellow-900/50 dark:bg-yellow-950/30 max-w-[80%]">
      <CardHeader>
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <CardTitle className="text-base">Permission Required</CardTitle>
            <CardDescription className="mt-1">{permission.message}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="text-sm">
            <span className="font-medium">Operation:</span> {permission.tool}
          </div>
          {permission.resource && (
            <div className="text-sm">
              <span className="font-medium">Resource:</span> {permission.resource}
            </div>
          )}
          {permission.action && (
            <div className="text-sm">
              <span className="font-medium">Action:</span> {permission.action}
            </div>
          )}
          <div className="text-sm">
            <span className="font-medium">Type:</span> {permission.permissionType}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <div className="flex gap-2 w-full">
          <Button
            onClick={() => onApprove(false)}
            size="sm"
            className="flex-1 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 text-white"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Allow
          </Button>
          <Button
            onClick={onDeny}
            size="sm"
            variant="destructive"
            className="flex-1"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Deny
          </Button>
        </div>
        <Button
          onClick={() => onApprove(true)}
          size="sm"
          variant="outline"
          className="w-full"
        >
          <Shield className="w-4 h-4 mr-2" />
          Always Allow
        </Button>
      </CardFooter>
    </Card>
  );
}




