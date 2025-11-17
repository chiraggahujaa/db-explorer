import { BaseService, QueryOptions } from './BaseService.js';
import { ApiResponse, PaginatedResponse } from '../types/common.js';
import { ChatSession } from '../types/chat.js';
import { supabaseAdmin } from '../utils/database.js';
import { DataMapper } from '../utils/mappers.js';

export class ChatSessionService extends BaseService {
  constructor() {
    super('chat_sessions');
  }

  /**
   * Get all chat sessions for a user with pagination
   */
  async findByUserId(
    userId: string,
    options: QueryOptions = { page: 1, limit: 50 }
  ): Promise<PaginatedResponse<ChatSession>> {
    try {
      const { page, limit, orderBy = 'last_message_at', orderDirection = 'desc' } = options;
      const offset = (page - 1) * limit;

      const { data, error, count } = await supabaseAdmin
        .from(this.tableName)
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order(orderBy, { ascending: orderDirection === 'asc' })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      const totalPages = Math.ceil((count || 0) / limit);

      return {
        success: true,
        data: DataMapper.toCamelCase(data || []) as ChatSession[],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      console.error('Error in ChatSessionService findByUserId:', error);
      throw error;
    }
  }

  /**
   * Get a chat session with all its messages
   */
  async findByIdWithMessages(id: string, userId: string): Promise<ApiResponse<any>> {
    try {
      const { data, error } = await supabaseAdmin
        .from(this.tableName)
        .select(`
          *,
          chat_messages (
            id,
            role,
            content,
            tool_calls,
            status,
            error_message,
            created_at
          )
        `)
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            success: false,
            error: 'Chat session not found',
          };
        }
        throw new Error(`Database error: ${error.message}`);
      }

      return {
        success: true,
        data: DataMapper.toCamelCase(data),
      };
    } catch (error) {
      console.error('Error in ChatSessionService findByIdWithMessages:', error);
      throw error;
    }
  }

  /**
   * Create a new chat session
   */
  async createSession(sessionData: {
    userId: string;
    connectionId: string;
    title?: string;
    selectedSchema?: string;
    selectedTables?: string[];
    aiProvider?: string;
  }): Promise<ApiResponse<ChatSession>> {
    try {
      const data = {
        user_id: sessionData.userId,
        connection_id: sessionData.connectionId,
        title: sessionData.title,
        selected_schema: sessionData.selectedSchema,
        selected_tables: sessionData.selectedTables,
        ai_provider: sessionData.aiProvider || 'gemini',
      };

      const { data: result, error } = await supabaseAdmin
        .from(this.tableName)
        .insert(data)
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return {
        success: true,
        data: DataMapper.toCamelCase(result) as ChatSession,
        message: 'Chat session created successfully',
      };
    } catch (error) {
      console.error('Error in ChatSessionService createSession:', error);
      throw error;
    }
  }

  /**
   * Update chat session metadata
   */
  async updateSession(
    id: string,
    userId: string,
    updates: {
      title?: string;
      selectedSchema?: string;
      selectedTables?: string[];
      connectionId?: string;
      aiProvider?: string;
    }
  ): Promise<ApiResponse<ChatSession>> {
    try {
      const data: Record<string, any> = {};
      if (updates.title !== undefined) data.title = updates.title;
      if (updates.selectedSchema !== undefined) data.selected_schema = updates.selectedSchema;
      if (updates.selectedTables !== undefined) data.selected_tables = updates.selectedTables;
      if (updates.connectionId !== undefined) data.connection_id = updates.connectionId;
      if (updates.aiProvider !== undefined) data.ai_provider = updates.aiProvider;

      const { data: result, error } = await supabaseAdmin
        .from(this.tableName)
        .update(data)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            success: false,
            error: 'Chat session not found',
          };
        }
        throw new Error(`Database error: ${error.message}`);
      }

      return {
        success: true,
        data: DataMapper.toCamelCase(result) as ChatSession,
        message: 'Chat session updated successfully',
      };
    } catch (error) {
      console.error('Error in ChatSessionService updateSession:', error);
      throw error;
    }
  }

  /**
   * Delete a chat session (cascades to messages and context)
   */
  async deleteSession(id: string, userId: string): Promise<ApiResponse<any>> {
    try {
      const { error } = await supabaseAdmin
        .from(this.tableName)
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return {
        success: true,
        message: 'Chat session deleted successfully',
      };
    } catch (error) {
      console.error('Error in ChatSessionService deleteSession:', error);
      throw error;
    }
  }

  /**
   * Get chat sessions by connection ID
   */
  async findByConnectionId(
    connectionId: string,
    userId: string,
    options: QueryOptions = { page: 1, limit: 50 }
  ): Promise<PaginatedResponse<ChatSession>> {
    try {
      const { page, limit, orderBy = 'last_message_at', orderDirection = 'desc' } = options;
      const offset = (page - 1) * limit;

      const { data, error, count } = await supabaseAdmin
        .from(this.tableName)
        .select('*', { count: 'exact' })
        .eq('connection_id', connectionId)
        .eq('user_id', userId)
        .order(orderBy, { ascending: orderDirection === 'asc' })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      const totalPages = Math.ceil((count || 0) / limit);

      return {
        success: true,
        data: DataMapper.toCamelCase(data || []) as ChatSession[],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      console.error('Error in ChatSessionService findByConnectionId:', error);
      throw error;
    }
  }

  /**
   * Update last message timestamp
   */
  async updateLastMessageAt(id: string): Promise<ApiResponse<any>> {
    try {
      const { error } = await supabaseAdmin
        .from(this.tableName)
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return {
        success: true,
        message: 'Last message timestamp updated',
      };
    } catch (error) {
      console.error('Error in ChatSessionService updateLastMessageAt:', error);
      throw error;
    }
  }
}
