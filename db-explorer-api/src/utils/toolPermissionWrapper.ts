import { toolPermissionService } from '../services/ToolPermissionService';
import type { ToolExecutionContext } from '../types/toolPermission';

export class PermissionDeniedError extends Error {
  public readonly requiresApproval: boolean;
  public readonly toolName: string;

  constructor(toolName: string, requiresApproval: boolean = false) {
    super(`Permission denied for tool: ${toolName}`);
    this.name = 'PermissionDeniedError';
    this.requiresApproval = requiresApproval;
    this.toolName = toolName;
  }
}

export async function checkAndExecuteWithPermission<T>(
  context: ToolExecutionContext,
  execute: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  try {
    const permissionCheck = await toolPermissionService.checkPermission(context);

    if (!permissionCheck.granted) {
      await toolPermissionService.logToolExecution(
        context,
        false,
        false,
        'denied',
        'Permission not granted'
      );

      throw new PermissionDeniedError(context.toolName, permissionCheck.requiresApproval);
    }

    const result = await execute();
    const executionTime = Date.now() - startTime;

    await toolPermissionService.logToolExecution(
      context,
      true,
      permissionCheck.autoApprove,
      'success',
      undefined,
      executionTime
    );

    return result;
  } catch (error: any) {
    const executionTime = Date.now() - startTime;

    if (!(error instanceof PermissionDeniedError)) {
      await toolPermissionService.logToolExecution(
        context,
        true,
        false,
        'error',
        error.message,
        executionTime
      );
    }

    throw error;
  }
}

export function createPermissionedTool<TInput, TOutput>(
  toolName: string,
  execute: (input: TInput, context: ToolExecutionContext) => Promise<TOutput>
) {
  return async (
    input: TInput,
    userId: string,
    connectionId: string,
    chatSessionId?: string
  ): Promise<TOutput> => {
    const context: ToolExecutionContext = {
      userId,
      connectionId,
      chatSessionId,
      toolName,
      toolArgs: input as any,
    };

    return checkAndExecuteWithPermission(context, () => execute(input, context));
  };
}
