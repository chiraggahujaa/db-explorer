export type PermissionScope = 'tool' | 'category';

export interface ToolPermission {
  id: string;
  userId: string;
  connectionId: string;
  scope: PermissionScope;
  toolName?: string;
  categoryName?: string;
  allowed: boolean;
  autoApprove: boolean;
  grantedAt: Date;
  grantedBy?: string;
  lastUsedAt?: Date;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ToolDefinition {
  name: string;
  category: string;
  description: string;
  requiresPermission: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  isDestructive: boolean;
}

export interface ToolCategoryDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  defaultEnabled: boolean;
  tools: ToolDefinition[];
}

export interface ToolRegistry {
  categories: ToolCategoryDefinition[];
  totalTools: number;
}

export interface BulkUpdatePermissionsDto {
  connectionId: string;
  permissions: Array<{
    scope: PermissionScope;
    toolName?: string;
    categoryName?: string;
    allowed: boolean;
    autoApprove?: boolean;
  }>;
}

export interface PermissionCheckResult {
  granted: boolean;
  requiresApproval: boolean;
  autoApprove: boolean;
  reason?: string;
}
