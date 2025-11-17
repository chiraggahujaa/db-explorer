import { z } from 'zod';

// Chat message role enum
export const chatMessageRoleSchema = z.enum(['user', 'assistant', 'system']);

// Chat message status enum
export const chatMessageStatusSchema = z.enum(['pending', 'streaming', 'completed', 'error']);

// AI provider enum
export const aiProviderSchema = z.enum(['gemini', 'openai', 'anthropic']);

// UUID schema
export const uuidSchema = z.string().uuid('Invalid UUID format');

// Create chat session schema
export const createChatSessionSchema = z.object({
  connectionId: z.string().uuid('Invalid connection ID'),
  title: z.string().max(255, 'Title is too long').optional(),
  selectedSchema: z.string().max(255, 'Schema name is too long').optional(),
  selectedTables: z.array(z.string()).optional(),
  aiProvider: aiProviderSchema.optional().default('gemini'),
});

// Update chat session schema
export const updateChatSessionSchema = z.object({
  title: z.string().max(255, 'Title is too long').optional(),
  selectedSchema: z.string().max(255, 'Schema name is too long').optional(),
  selectedTables: z.array(z.string()).optional(),
  connectionId: z.string().uuid('Invalid connection ID').optional(),
  aiProvider: aiProviderSchema.optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

// Add message schema
export const addMessageSchema = z.object({
  role: chatMessageRoleSchema,
  content: z.string().min(1, 'Message content is required'),
  toolCalls: z.any().optional(), // JSONB field - flexible schema
  status: chatMessageStatusSchema.optional().default('completed'),
  errorMessage: z.string().optional(),
});

// Update message schema
export const updateMessageSchema = z.object({
  status: chatMessageStatusSchema.optional(),
  toolCalls: z.any().optional(),
  errorMessage: z.string().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

// Context snapshot schema
export const contextSnapshotSchema = z.object({
  schemaName: z.string().max(255).optional(),
  tablesInfo: z.array(z.object({
    tableName: z.string(),
    columns: z.array(z.object({
      name: z.string(),
      type: z.string(),
      nullable: z.boolean().optional(),
    })),
    rowCount: z.number().optional(),
    usageCount: z.number().default(0),
  })).optional(),
  recentCommands: z.array(z.string()).optional(),
});
