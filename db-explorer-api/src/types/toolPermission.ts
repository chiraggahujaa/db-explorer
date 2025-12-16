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

export interface ToolPermissionRequest {
  id: string;
  userId: string;
  connectionId: string;
  chatSessionId?: string;
  toolName: string;
  toolArgs?: Record<string, any>;
  context?: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  response?: 'execute_once' | 'execute_and_remember' | 'deny';
  requestedAt: Date;
  respondedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
}

export interface ToolAuditLog {
  id: string;
  userId: string;
  connectionId: string;
  chatSessionId?: string;
  toolName: string;
  toolCategory?: string;
  toolArgs?: Record<string, any>;
  permissionGranted: boolean;
  autoApproved: boolean;
  executionStatus?: string;
  executionError?: string;
  executionDurationMs?: number;
  executedAt: Date;
}

export interface CreateToolPermissionDto {
  userId: string;
  connectionId: string;
  scope: PermissionScope;
  toolName?: string;
  categoryName?: string;
  allowed: boolean;
  autoApprove?: boolean;
  grantedBy?: string;
}

export interface UpdateToolPermissionDto {
  allowed?: boolean;
  autoApprove?: boolean;
}

export interface BulkUpdatePermissionsDto {
  userId: string;
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

export interface ToolExecutionContext {
  userId: string;
  connectionId: string;
  chatSessionId?: string;
  toolName: string;
  toolArgs?: Record<string, any>;
}
