import api from './api/axios';

export class ToolPermissionError extends Error {
  public readonly requiresApproval: boolean;
  public readonly toolName: string;
  public readonly permissionRequestId?: string;

  constructor(toolName: string, requiresApproval: boolean = false, permissionRequestId?: string) {
    super(requiresApproval
      ? `Tool "${toolName}" requires permission approval`
      : `Permission denied for tool: ${toolName}`
    );
    this.name = 'ToolPermissionError';
    this.requiresApproval = requiresApproval;
    this.toolName = toolName;
    this.permissionRequestId = permissionRequestId;
  }
}

interface PermissionCheckResult {
  granted: boolean;
  requiresApproval: boolean;
  autoApprove: boolean;
  reason?: string;
}

export async function checkToolPermission(
  toolName: string,
  connectionId: string,
  userId: string,
  accessToken: string
): Promise<PermissionCheckResult> {
  try {
    const response = await api.post(
      '/api/tool-permissions/check',
      {
        toolName,
        connectionId,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return response.data.data;
  } catch (error: any) {
    console.error('[Permission Check] Error:', error);
    return {
      granted: false,
      requiresApproval: true,
      autoApprove: false,
      reason: error.message,
    };
  }
}

export async function createToolWrapper<T>(
  toolName: string,
  execute: () => Promise<T>,
  context: {
    connectionId: string;
    userId: string;
    accessToken: string;
    chatSessionId?: string;
    toolArgs?: any;
  }
): Promise<T> {
  const permissionCheck = await checkToolPermission(
    toolName,
    context.connectionId,
    context.userId,
    context.accessToken
  );

  if (!permissionCheck.granted) {
    if (permissionCheck.requiresApproval) {
      throw new ToolPermissionError(toolName, true);
    } else {
      throw new ToolPermissionError(toolName, false);
    }
  }

  try {
    return await execute();
  } catch (error: any) {
    throw error;
  }
}

export const TOOLS_NOT_REQUIRING_PERMISSION = [
  'list_databases',
  'list_tables',
  'describe_table',
  'show_indexes',
  'analyze_foreign_keys',
  'get_table_dependencies',
  'list_tenants',
  'test_connection',
  'show_connections',
];

export function requiresPermission(toolName: string): boolean {
  return !TOOLS_NOT_REQUIRING_PERMISSION.includes(toolName);
}
