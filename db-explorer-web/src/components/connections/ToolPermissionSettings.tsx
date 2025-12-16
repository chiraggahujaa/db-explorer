"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Database, Shield, Lock, Unlock, CheckCircle2, XCircle, AlertTriangle, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { toolPermissionsApi } from "@/lib/api/toolPermissions";
import type { ConnectionWithRole } from "@/types/connection";
import type { ToolCategoryDefinition, ToolDefinition } from "@/types/toolPermission";

interface ToolPermissionSettingsProps {
  connection: ConnectionWithRole;
}

interface PermissionState {
  [key: string]: {
    allowed: boolean;
    autoApprove: boolean;
  };
}

const getRiskBadge = (riskLevel: string) => {
  switch (riskLevel) {
    case 'high':
      return <Badge variant="destructive" className="ml-2">High Risk</Badge>;
    case 'medium':
      return <Badge variant="outline" className="ml-2 border-yellow-500 text-yellow-600">Medium Risk</Badge>;
    default:
      return <Badge variant="outline" className="ml-2 border-green-500 text-green-600">Low Risk</Badge>;
  }
};

export function ToolPermissionSettings({ connection }: ToolPermissionSettingsProps) {
  const [categoryPermissions, setCategoryPermissions] = useState<PermissionState>({});
  const [toolPermissions, setToolPermissions] = useState<PermissionState>({});
  const [hasChanges, setHasChanges] = useState(false);
  const queryClient = useQueryClient();

  const { data: registry, isLoading: registryLoading } = useQuery({
    queryKey: ['tool-registry'],
    queryFn: () => toolPermissionsApi.getToolRegistry(),
  });

  const { data: userPermissions, isLoading: permissionsLoading } = useQuery({
    queryKey: ['tool-permissions', connection.id],
    queryFn: () => toolPermissionsApi.getUserPermissions(connection.id),
  });

  useEffect(() => {
    if (userPermissions && registry) {
      const catPerms: PermissionState = {};
      const toolPerms: PermissionState = {};

      userPermissions.forEach(permission => {
        const key = permission.scope === 'category'
          ? `cat_${permission.categoryName}`
          : `tool_${permission.toolName}`;

        const state = {
          allowed: permission.allowed,
          autoApprove: permission.autoApprove,
        };

        if (permission.scope === 'category') {
          catPerms[key] = state;
        } else {
          toolPerms[key] = state;
        }
      });

      setCategoryPermissions(catPerms);
      setToolPermissions(toolPerms);
      setHasChanges(false);
    }
  }, [userPermissions, registry]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const permissions: any[] = [];

      Object.entries(categoryPermissions).forEach(([key, value]) => {
        const categoryName = key.replace('cat_', '');
        permissions.push({
          scope: 'category' as const,
          categoryName,
          allowed: value.allowed,
          autoApprove: value.autoApprove,
        });
      });

      Object.entries(toolPermissions).forEach(([key, value]) => {
        const toolName = key.replace('tool_', '');
        permissions.push({
          scope: 'tool' as const,
          toolName,
          allowed: value.allowed,
          autoApprove: value.autoApprove,
        });
      });

      await toolPermissionsApi.bulkUpdatePermissions({
        connectionId: connection.id,
        permissions,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tool-permissions', connection.id] });
      setHasChanges(false);
      toast.success('Permissions saved successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to save permissions', {
        description: error.message,
      });
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => toolPermissionsApi.initializeDefaultPermissions(connection.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tool-permissions', connection.id] });
      toast.success('Permissions reset to defaults');
    },
    onError: (error: any) => {
      toast.error('Failed to reset permissions', {
        description: error.message,
      });
    },
  });

  const toggleCategoryPermission = (categoryId: string, field: 'allowed' | 'autoApprove') => {
    const key = `cat_${categoryId}`;
    setCategoryPermissions(prev => {
      const current = prev[key] || { allowed: false, autoApprove: false };
      return {
        ...prev,
        [key]: {
          ...current,
          [field]: !current[field],
          ...(field === 'allowed' && !current.allowed ? { autoApprove: false } : {}),
        },
      };
    });
    setHasChanges(true);
  };

  const toggleToolPermission = (toolName: string, field: 'allowed' | 'autoApprove') => {
    const key = `tool_${toolName}`;
    setToolPermissions(prev => {
      const current = prev[key] || { allowed: false, autoApprove: false };
      return {
        ...prev,
        [key]: {
          ...current,
          [field]: !current[field],
          ...(field === 'allowed' && !current.allowed ? { autoApprove: false } : {}),
        },
      };
    });
    setHasChanges(true);
  };

  const selectAllInCategory = (categoryId: string, allowed: boolean) => {
    const category = registry?.categories.find(c => c.id === categoryId);
    if (!category) return;

    const updates: PermissionState = {};
    category.tools.forEach(tool => {
      if (tool.requiresPermission) {
        updates[`tool_${tool.name}`] = {
          allowed,
          autoApprove: toolPermissions[`tool_${tool.name}`]?.autoApprove || false,
        };
      }
    });

    setToolPermissions(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  if (registryLoading || permissionsLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Loading permissions...</p>
        </CardContent>
      </Card>
    );
  }

  const categories = registry?.categories || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6" />
            AI Tool Permissions
          </h2>
          <p className="text-muted-foreground mt-1">
            Control which database tools the AI can access for {connection.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => resetMutation.mutate()}
            disabled={resetMutation.isPending}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!hasChanges || saveMutation.isPending}
          >
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      <Tabs defaultValue="by-category" className="w-full">
        <TabsList>
          <TabsTrigger value="by-category">By Category</TabsTrigger>
          <TabsTrigger value="all-tools">All Tools</TabsTrigger>
        </TabsList>

        <TabsContent value="by-category" className="space-y-4 mt-4">
          {categories.map((category: ToolCategoryDefinition) => {
            const catKey = `cat_${category.id}`;
            const catPermission = categoryPermissions[catKey] || { allowed: false, autoApprove: false };
            const toolsInCategory = category.tools.filter(t => t.requiresPermission);
            const enabledTools = toolsInCategory.filter(t =>
              toolPermissions[`tool_${t.name}`]?.allowed
            ).length;

            return (
              <Card key={category.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        {category.name}
                        <Badge variant="secondary">
                          {enabledTools}/{toolsInCategory.length} enabled
                        </Badge>
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {category.description}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => selectAllInCategory(category.id, true)}
                      >
                        Enable All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => selectAllInCategory(category.id, false)}
                      >
                        Disable All
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {category.tools.map((tool: ToolDefinition) => {
                    if (!tool.requiresPermission) {
                      return (
                        <div key={tool.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="flex-1">
                            <div className="font-medium text-sm flex items-center">
                              {tool.name}
                              <Badge variant="outline" className="ml-2">Always Allowed</Badge>
                              {getRiskBadge(tool.riskLevel)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {tool.description}
                            </p>
                          </div>
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        </div>
                      );
                    }

                    const toolKey = `tool_${tool.name}`;
                    const toolPerm = toolPermissions[toolKey] || { allowed: false, autoApprove: false };

                    return (
                      <div key={tool.name} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex-1">
                          <div className="font-medium text-sm flex items-center">
                            {tool.name}
                            {getRiskBadge(tool.riskLevel)}
                            {tool.isDestructive && (
                              <Badge variant="destructive" className="ml-2">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Destructive
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {tool.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-6 ml-4">
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`${toolKey}-allowed`} className="text-xs cursor-pointer">
                              Allowed
                            </Label>
                            <Switch
                              id={`${toolKey}-allowed`}
                              checked={toolPerm.allowed}
                              onCheckedChange={() => toggleToolPermission(tool.name, 'allowed')}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`${toolKey}-auto`} className="text-xs cursor-pointer">
                              Auto-approve
                            </Label>
                            <Switch
                              id={`${toolKey}-auto`}
                              checked={toolPerm.autoApprove}
                              disabled={!toolPerm.allowed}
                              onCheckedChange={() => toggleToolPermission(tool.name, 'autoApprove')}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="all-tools" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <div className="space-y-3">
                {categories.flatMap((category: ToolCategoryDefinition) =>
                  category.tools.map((tool: ToolDefinition) => {
                    if (!tool.requiresPermission) return null;

                    const toolKey = `tool_${tool.name}`;
                    const toolPerm = toolPermissions[toolKey] || { allowed: false, autoApprove: false };

                    return (
                      <div key={tool.name} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex-1">
                          <div className="font-medium text-sm flex items-center">
                            {tool.name}
                            <Badge variant="secondary" className="ml-2">{category.name}</Badge>
                            {getRiskBadge(tool.riskLevel)}
                            {tool.isDestructive && (
                              <Badge variant="destructive" className="ml-2">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Destructive
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {tool.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-6 ml-4">
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`${toolKey}-all-allowed`} className="text-xs cursor-pointer">
                              Allowed
                            </Label>
                            <Switch
                              id={`${toolKey}-all-allowed`}
                              checked={toolPerm.allowed}
                              onCheckedChange={() => toggleToolPermission(tool.name, 'allowed')}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`${toolKey}-all-auto`} className="text-xs cursor-pointer">
                              Auto-approve
                            </Label>
                            <Switch
                              id={`${toolKey}-all-auto`}
                              checked={toolPerm.autoApprove}
                              disabled={!toolPerm.allowed}
                              onCheckedChange={() => toggleToolPermission(tool.name, 'autoApprove')}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
