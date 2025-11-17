import { BaseService } from './BaseService.js';
import { ApiResponse } from '../types/common.js';
import { ChatMessage, ChatMessageRole, ChatMessageStatus } from '../types/chat.js';
import { supabaseAdmin } from '../utils/database.js';
import { DataMapper } from '../utils/mappers.js';

export class ChatMessageService extends BaseService {
  constructor() {
    super('chat_messages');
  }

  /**
   * Sanitize content to remove problematic Unicode characters that PostgreSQL cannot handle
   */
  private sanitizeContent(content: string): string {
    // Replace actual control characters (char codes 0-31) with readable representations
    return content
      .replace(/\x00/g, '[NULL]')  // Null byte
      .replace(/\x01/g, '[SOH]')   // Start of heading
      .replace(/\x02/g, '[STX]')   // Start of text
      .replace(/\x03/g, '[ETX]')   // End of text
      .replace(/\x04/g, '[EOT]')   // End of transmission
      .replace(/\x05/g, '[ENQ]')   // Enquiry
      .replace(/\x06/g, '[ACK]')   // Acknowledge
      .replace(/\x07/g, '[BEL]')   // Bell
      .replace(/\x08/g, '[BS]')    // Backspace
      // Also replace Unicode escape sequences in strings (like \u0000 as text)
      .replace(/\\u0000/g, '[NULL]')
      .replace(/\\u0001/g, '[SOH]')
      .replace(/\\u0002/g, '[STX]')
      .replace(/\\u0003/g, '[ETX]')
      .replace(/\\u0004/g, '[EOT]')
      .replace(/\\u0005/g, '[ENQ]')
      .replace(/\\u0006/g, '[ACK]')
      .replace(/\\u0007/g, '[BEL]')
      .replace(/\\u0008/g, '[BS]')
      // Catch any other control characters (0x00-0x1F except tab, newline, carriage return)
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, (match) => `[0x${match.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}]`)
      // Replace any remaining \uXXXX patterns with [U+XXXX] for safety
      .replace(/\\u([0-9A-Fa-f]{4})/g, '[U+$1]');
  }

  /**
   * Add a message to a chat session
   */
  async addMessage(messageData: {
    chatSessionId: string;
    role: ChatMessageRole;
    content: string;
    toolCalls?: any;
    status?: ChatMessageStatus;
    errorMessage?: string;
  }): Promise<ApiResponse<ChatMessage>> {
    try {
      const data = {
        chat_session_id: messageData.chatSessionId,
        role: messageData.role,
        content: this.sanitizeContent(messageData.content),
        tool_calls: messageData.toolCalls,
        status: messageData.status || 'completed',
        error_message: messageData.errorMessage,
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
        data: DataMapper.toCamelCase(result) as ChatMessage,
        message: 'Message added successfully',
      };
    } catch (error) {
      console.error('Error in ChatMessageService addMessage:', error);
      throw error;
    }
  }

  /**
   * Get all messages for a chat session
   */
  async getMessagesByChatSessionId(chatSessionId: string): Promise<ApiResponse<ChatMessage[]>> {
    try {
      const { data, error } = await supabaseAdmin
        .from(this.tableName)
        .select('*')
        .eq('chat_session_id', chatSessionId)
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return {
        success: true,
        data: DataMapper.toCamelCase(data || []) as ChatMessage[],
      };
    } catch (error) {
      console.error('Error in ChatMessageService getMessagesByChatSessionId:', error);
      throw error;
    }
  }

  /**
   * Update message status
   */
  async updateMessageStatus(
    messageId: string,
    status: ChatMessageStatus,
    errorMessage?: string
  ): Promise<ApiResponse<ChatMessage>> {
    try {
      const data: Record<string, any> = { status };
      if (errorMessage) {
        data.error_message = errorMessage;
      }

      const { data: result, error } = await supabaseAdmin
        .from(this.tableName)
        .update(data)
        .eq('id', messageId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            success: false,
            error: 'Message not found',
          };
        }
        throw new Error(`Database error: ${error.message}`);
      }

      return {
        success: true,
        data: DataMapper.toCamelCase(result) as ChatMessage,
        message: 'Message status updated',
      };
    } catch (error) {
      console.error('Error in ChatMessageService updateMessageStatus:', error);
      throw error;
    }
  }

  /**
   * Update message tool calls
   */
  async updateMessageToolCalls(messageId: string, toolCalls: any): Promise<ApiResponse<ChatMessage>> {
    try {
      const { data: result, error } = await supabaseAdmin
        .from(this.tableName)
        .update({ tool_calls: toolCalls })
        .eq('id', messageId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            success: false,
            error: 'Message not found',
          };
        }
        throw new Error(`Database error: ${error.message}`);
      }

      return {
        success: true,
        data: DataMapper.toCamelCase(result) as ChatMessage,
        message: 'Message tool calls updated',
      };
    } catch (error) {
      console.error('Error in ChatMessageService updateMessageToolCalls:', error);
      throw error;
    }
  }

  /**
   * Delete messages for a chat session
   */
  async deleteMessagesByChatSessionId(chatSessionId: string): Promise<ApiResponse<any>> {
    try {
      const { error } = await supabaseAdmin
        .from(this.tableName)
        .delete()
        .eq('chat_session_id', chatSessionId);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return {
        success: true,
        message: 'Messages deleted successfully',
      };
    } catch (error) {
      console.error('Error in ChatMessageService deleteMessagesByChatSessionId:', error);
      throw error;
    }
  }

  /**
   * Get recent messages (useful for context)
   */
  async getRecentMessages(chatSessionId: string, limit: number = 10): Promise<ApiResponse<ChatMessage[]>> {
    try {
      const { data, error } = await supabaseAdmin
        .from(this.tableName)
        .select('*')
        .eq('chat_session_id', chatSessionId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      // Reverse to get chronological order
      const messages = (data || []).reverse();

      return {
        success: true,
        data: DataMapper.toCamelCase(messages) as ChatMessage[],
      };
    } catch (error) {
      console.error('Error in ChatMessageService getRecentMessages:', error);
      throw error;
    }
  }

  /**
   * Get the first user message (for title generation)
   */
  async getFirstUserMessage(chatSessionId: string): Promise<ApiResponse<ChatMessage | null>> {
    try {
      const { data, error } = await supabaseAdmin
        .from(this.tableName)
        .select('*')
        .eq('chat_session_id', chatSessionId)
        .eq('role', 'user')
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            success: true,
            data: null,
          };
        }
        throw new Error(`Database error: ${error.message}`);
      }

      return {
        success: true,
        data: DataMapper.toCamelCase(data) as ChatMessage,
      };
    } catch (error) {
      console.error('Error in ChatMessageService getFirstUserMessage:', error);
      throw error;
    }
  }

  /**
   * Batch insert messages
   */
  async batchAddMessages(messages: Array<{
    chatSessionId: string;
    role: ChatMessageRole;
    content: string;
    toolCalls?: any;
    status?: ChatMessageStatus;
  }>): Promise<ApiResponse<ChatMessage[]>> {
    try {
      const data = messages.map(msg => ({
        chat_session_id: msg.chatSessionId,
        role: msg.role,
        content: this.sanitizeContent(msg.content),
        tool_calls: msg.toolCalls,
        status: msg.status || 'completed',
      }));

      const { data: result, error } = await supabaseAdmin
        .from(this.tableName)
        .insert(data)
        .select();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return {
        success: true,
        data: DataMapper.toCamelCase(result || []) as ChatMessage[],
        message: `${messages.length} messages added successfully`,
      };
    } catch (error) {
      console.error('Error in ChatMessageService batchAddMessages:', error);
      throw error;
    }
  }
}
