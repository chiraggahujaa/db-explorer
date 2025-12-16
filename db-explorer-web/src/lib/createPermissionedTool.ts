import { tool } from 'ai';
import { z } from 'zod';
import { checkToolPermission, ToolPermissionError, requiresPermission as toolRequiresPermission } from './toolPermissionHelper';

export function createPermissionedTool<TInput extends z.ZodTypeAny>(config: {
  toolName: string;
  description: string;
  inputSchema: TInput;
  execute: (input: z.infer<TInput>, options?: any) => Promise<any>;
  connectionId: string;
  userId: string;
  accessToken: string;
  chatSessionId?: string;
}) {
  return tool({
    description: config.description,
    inputSchema: config.inputSchema,
    execute: async (input, options) => {
      if (toolRequiresPermission(config.toolName)) {
        const permissionCheck = await checkToolPermission(
          config.toolName,
          config.connectionId,
          config.userId,
          config.accessToken
        );

        if (!permissionCheck.granted) {
          if (permissionCheck.requiresApproval) {
            return {
              error: 'PERMISSION_REQUIRED',
              message: `I need your permission to use the "${config.toolName}" tool. Would you like to grant permission?`,
              toolName: config.toolName,
              requiresApproval: true,
            };
          } else {
            return {
              error: 'PERMISSION_DENIED',
              message: `You have not granted permission to use the "${config.toolName}" tool. You can manage tool permissions in settings.`,
              toolName: config.toolName,
            };
          }
        }
      }

      try {
        return await config.execute(input, options);
      } catch (error: any) {
        console.error(`[Tool ${config.toolName}] Error:`, error);
        throw error;
      }
    },
  });
}
