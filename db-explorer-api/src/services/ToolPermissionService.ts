import { supabase } from '../lib/supabase';
import { ToolCategory, getToolDefinition, requiresPermission, TOOL_CATEGORIES } from '../config/toolRegistry';
import type {
  ToolPermission,
  ToolPermissionRequest,
  ToolAuditLog,
  CreateToolPermissionDto,
  UpdateToolPermissionDto,
  BulkUpdatePermissionsDto,
  PermissionCheckResult,
  ToolExecutionContext,
} from '../types/toolPermission';

export class ToolPermissionService {
  async checkPermission(context: ToolExecutionContext): Promise<PermissionCheckResult> {
    const { userId, connectionId, toolName } = context;

    const toolDef = getToolDefinition(toolName);
    if (!toolDef) {
      return {
        granted: false,
        requiresApproval: false,
        autoApprove: false,
        reason: 'Unknown tool',
      };
    }

    if (!toolDef.requiresPermission) {
      return {
        granted: true,
        requiresApproval: false,
        autoApprove: false,
        reason: 'Tool does not require permission',
      };
    }

    const { data: toolPermission } = await supabase
      .from('ai_tool_permissions')
      .select('*')
      .eq('user_id', userId)
      .eq('connection_id', connectionId)
      .eq('scope', 'tool')
      .eq('tool_name', toolName)
      .eq('allowed', true)
      .single();

    if (toolPermission) {
      return {
        granted: true,
        requiresApproval: false,
        autoApprove: toolPermission.auto_approve || false,
        reason: 'Tool permission granted',
      };
    }

    const { data: categoryPermission } = await supabase
      .from('ai_tool_permissions')
      .select('*')
      .eq('user_id', userId)
      .eq('connection_id', connectionId)
      .eq('scope', 'category')
      .eq('category_name', toolDef.category)
      .eq('allowed', true)
      .single();

    if (categoryPermission) {
      return {
        granted: true,
        requiresApproval: false,
        autoApprove: categoryPermission.auto_approve || false,
        reason: 'Category permission granted',
      };
    }

    return {
      granted: false,
      requiresApproval: true,
      autoApprove: false,
      reason: 'Permission required',
    };
  }

  async createPermission(dto: CreateToolPermissionDto): Promise<ToolPermission> {
    const { data, error } = await supabase
      .from('ai_tool_permissions')
      .insert({
        user_id: dto.userId,
        connection_id: dto.connectionId,
        scope: dto.scope,
        tool_name: dto.toolName,
        category_name: dto.categoryName,
        allowed: dto.allowed,
        auto_approve: dto.autoApprove ?? false,
        granted_by: dto.grantedBy,
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapToToolPermission(data);
  }

  async updatePermission(id: string, dto: UpdateToolPermissionDto): Promise<ToolPermission> {
    const { data, error } = await supabase
      .from('ai_tool_permissions')
      .update({
        allowed: dto.allowed,
        auto_approve: dto.autoApprove,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToToolPermission(data);
  }

  async deletePermission(id: string): Promise<void> {
    const { error } = await supabase
      .from('ai_tool_permissions')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getPermissionsByUserAndConnection(
    userId: string,
    connectionId: string
  ): Promise<ToolPermission[]> {
    const { data, error } = await supabase
      .from('ai_tool_permissions')
      .select('*')
      .eq('user_id', userId)
      .eq('connection_id', connectionId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(this.mapToToolPermission);
  }

  async bulkUpdatePermissions(dto: BulkUpdatePermissionsDto): Promise<void> {
    const { userId, connectionId, permissions } = dto;

    const { error: deleteError } = await supabase
      .from('ai_tool_permissions')
      .delete()
      .eq('user_id', userId)
      .eq('connection_id', connectionId);

    if (deleteError) throw deleteError;

    if (permissions.length === 0) return;

    const records = permissions.map(p => ({
      user_id: userId,
      connection_id: connectionId,
      scope: p.scope,
      tool_name: p.toolName,
      category_name: p.categoryName,
      allowed: p.allowed,
      auto_approve: p.autoApprove ?? false,
      granted_by: userId,
    }));

    const { error: insertError } = await supabase
      .from('ai_tool_permissions')
      .insert(records);

    if (insertError) throw insertError;
  }

  async createPermissionRequest(context: ToolExecutionContext): Promise<ToolPermissionRequest> {
    const { data, error } = await supabase
      .from('ai_tool_permission_requests')
      .insert({
        user_id: context.userId,
        connection_id: context.connectionId,
        chat_session_id: context.chatSessionId,
        tool_name: context.toolName,
        tool_args: context.toolArgs,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapToPermissionRequest(data);
  }

  async respondToPermissionRequest(
    requestId: string,
    response: 'execute_once' | 'execute_and_remember' | 'deny'
  ): Promise<ToolPermissionRequest> {
    const status = response === 'deny' ? 'denied' : 'approved';

    const { data, error } = await supabase
      .from('ai_tool_permission_requests')
      .update({
        status,
        response,
        responded_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select()
      .single();

    if (error) throw error;

    const request = this.mapToPermissionRequest(data);

    if (response === 'execute_and_remember') {
      const toolDef = getToolDefinition(request.toolName);
      await this.createPermission({
        userId: request.userId,
        connectionId: request.connectionId,
        scope: 'tool',
        toolName: request.toolName,
        allowed: true,
        autoApprove: true,
        grantedBy: request.userId,
      });
    }

    return request;
  }

  async getPendingRequests(userId: string, connectionId: string): Promise<ToolPermissionRequest[]> {
    const { data, error } = await supabase
      .from('ai_tool_permission_requests')
      .select('*')
      .eq('user_id', userId)
      .eq('connection_id', connectionId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('requested_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(this.mapToPermissionRequest);
  }

  async logToolExecution(
    context: ToolExecutionContext,
    permissionGranted: boolean,
    autoApproved: boolean,
    executionStatus?: string,
    executionError?: string,
    executionDurationMs?: number
  ): Promise<void> {
    const toolDef = getToolDefinition(context.toolName);

    await supabase.from('ai_tool_audit_log').insert({
      user_id: context.userId,
      connection_id: context.connectionId,
      chat_session_id: context.chatSessionId,
      tool_name: context.toolName,
      tool_category: toolDef?.category,
      tool_args: context.toolArgs,
      permission_granted: permissionGranted,
      auto_approved: autoApproved,
      execution_status: executionStatus,
      execution_error: executionError,
      execution_duration_ms: executionDurationMs,
    });
  }

  async getAuditLogs(
    userId: string,
    connectionId: string,
    limit: number = 100
  ): Promise<ToolAuditLog[]> {
    const { data, error } = await supabase
      .from('ai_tool_audit_log')
      .select('*')
      .eq('user_id', userId)
      .eq('connection_id', connectionId)
      .order('executed_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map(this.mapToAuditLog);
  }

  async initializeDefaultPermissions(userId: string, connectionId: string): Promise<void> {
    const defaultCategories = Object.values(TOOL_CATEGORIES).filter(c => c.defaultEnabled);

    const permissions = defaultCategories.map(category => ({
      user_id: userId,
      connection_id: connectionId,
      scope: 'category' as const,
      category_name: category.id,
      allowed: true,
      auto_approve: false,
      granted_by: userId,
    }));

    if (permissions.length > 0) {
      await supabase.from('ai_tool_permissions').insert(permissions);
    }
  }

  private mapToToolPermission(data: any): ToolPermission {
    return {
      id: data.id,
      userId: data.user_id,
      connectionId: data.connection_id,
      scope: data.scope,
      toolName: data.tool_name,
      categoryName: data.category_name,
      allowed: data.allowed,
      autoApprove: data.auto_approve,
      grantedAt: new Date(data.granted_at),
      grantedBy: data.granted_by,
      lastUsedAt: data.last_used_at ? new Date(data.last_used_at) : undefined,
      usageCount: data.usage_count,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  private mapToPermissionRequest(data: any): ToolPermissionRequest {
    return {
      id: data.id,
      userId: data.user_id,
      connectionId: data.connection_id,
      chatSessionId: data.chat_session_id,
      toolName: data.tool_name,
      toolArgs: data.tool_args,
      context: data.context,
      status: data.status,
      response: data.response,
      requestedAt: new Date(data.requested_at),
      respondedAt: data.responded_at ? new Date(data.responded_at) : undefined,
      expiresAt: new Date(data.expires_at),
      createdAt: new Date(data.created_at),
    };
  }

  private mapToAuditLog(data: any): ToolAuditLog {
    return {
      id: data.id,
      userId: data.user_id,
      connectionId: data.connection_id,
      chatSessionId: data.chat_session_id,
      toolName: data.tool_name,
      toolCategory: data.tool_category,
      toolArgs: data.tool_args,
      permissionGranted: data.permission_granted,
      autoApproved: data.auto_approved,
      executionStatus: data.execution_status,
      executionError: data.execution_error,
      executionDurationMs: data.execution_duration_ms,
      executedAt: new Date(data.executed_at),
    };
  }
}

export const toolPermissionService = new ToolPermissionService();
