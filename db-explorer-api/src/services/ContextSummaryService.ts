import { BaseService } from './BaseService.js';
import { ApiResponse } from '../types/common.js';
import { ChatContextSnapshot } from '../types/chat.js';
import { supabaseAdmin } from '../utils/database.js';
import { DataMapper } from '../utils/mappers.js';

interface TableInfo {
  tableName: string;
  columns: Array<{
    name: string;
    type: string;
    nullable?: boolean;
  }>;
  rowCount?: number;
  usageCount: number; // How many times this table was queried
}

export class ContextSummaryService extends BaseService {
  constructor() {
    super('chat_context_snapshots');
  }

  /**
   * Create or update context snapshot for a chat session
   */
  async upsertContextSnapshot(data: {
    chatSessionId: string;
    schemaName?: string;
    tablesInfo?: TableInfo[];
    recentCommands?: string[];
  }): Promise<ApiResponse<ChatContextSnapshot>> {
    try {
      // Check if snapshot exists
      const { data: existing, error: checkError } = await supabaseAdmin
        .from(this.tableName)
        .select('*')
        .eq('chat_session_id', data.chatSessionId)
        .single();

      const snapshotData = {
        chat_session_id: data.chatSessionId,
        schema_name: data.schemaName,
        tables_info: data.tablesInfo,
        recent_commands: data.recentCommands || [],
        command_count: data.recentCommands?.length || 0,
      };

      let result;
      let error;

      if (existing && !checkError) {
        // Update existing snapshot
        const updateResult = await supabaseAdmin
          .from(this.tableName)
          .update(snapshotData)
          .eq('chat_session_id', data.chatSessionId)
          .select()
          .single();

        result = updateResult.data;
        error = updateResult.error;
      } else {
        // Create new snapshot
        const insertResult = await supabaseAdmin
          .from(this.tableName)
          .insert(snapshotData)
          .select()
          .single();

        result = insertResult.data;
        error = insertResult.error;
      }

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return {
        success: true,
        data: DataMapper.toCamelCase(result) as ChatContextSnapshot,
        message: 'Context snapshot saved successfully',
      };
    } catch (error) {
      console.error('Error in ContextSummaryService upsertContextSnapshot:', error);
      throw error;
    }
  }

  /**
   * Get context snapshot for a chat session
   */
  async getContextSnapshot(chatSessionId: string): Promise<ApiResponse<ChatContextSnapshot | null>> {
    try {
      const { data, error } = await supabaseAdmin
        .from(this.tableName)
        .select('*')
        .eq('chat_session_id', chatSessionId)
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
        data: DataMapper.toCamelCase(data) as ChatContextSnapshot,
      };
    } catch (error) {
      console.error('Error in ContextSummaryService getContextSnapshot:', error);
      throw error;
    }
  }

  /**
   * Add a command to the recent commands list
   */
  async addCommand(chatSessionId: string, command: string, maxCommands: number = 10): Promise<ApiResponse<any>> {
    try {
      // Get existing snapshot
      const snapshotResult = await this.getContextSnapshot(chatSessionId);
      const existingSnapshot = snapshotResult.data;

      let recentCommands: string[] = [];

      if (existingSnapshot && existingSnapshot.recentCommands) {
        recentCommands = Array.isArray(existingSnapshot.recentCommands)
          ? existingSnapshot.recentCommands
          : [];
      }

      // Add new command and keep only last N commands
      recentCommands.push(command);
      if (recentCommands.length > maxCommands) {
        recentCommands = recentCommands.slice(-maxCommands);
      }

      // Update snapshot
      const { error } = await supabaseAdmin
        .from(this.tableName)
        .upsert({
          chat_session_id: chatSessionId,
          recent_commands: recentCommands,
          command_count: recentCommands.length,
        })
        .eq('chat_session_id', chatSessionId);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return {
        success: true,
        message: 'Command added to context',
      };
    } catch (error) {
      console.error('Error in ContextSummaryService addCommand:', error);
      throw error;
    }
  }

  /**
   * Update table usage information
   */
  async updateTableUsage(
    chatSessionId: string,
    tableInfo: TableInfo
  ): Promise<ApiResponse<any>> {
    try {
      const snapshotResult = await this.getContextSnapshot(chatSessionId);
      const existingSnapshot = snapshotResult.data;

      let tablesInfo: TableInfo[] = [];

      if (existingSnapshot && existingSnapshot.tablesInfo) {
        tablesInfo = Array.isArray(existingSnapshot.tablesInfo)
          ? existingSnapshot.tablesInfo
          : [];
      }

      // Find existing table or add new one
      const existingTableIndex = tablesInfo.findIndex(
        t => t.tableName === tableInfo.tableName
      );

      if (existingTableIndex >= 0) {
        // Update existing table info
        tablesInfo[existingTableIndex] = {
          ...tablesInfo[existingTableIndex],
          ...tableInfo,
          usageCount: (tablesInfo[existingTableIndex].usageCount || 0) + 1,
        };
      } else {
        // Add new table info
        tablesInfo.push({
          ...tableInfo,
          usageCount: 1,
        });
      }

      // Keep only top 5 most used tables
      tablesInfo.sort((a, b) => b.usageCount - a.usageCount);
      if (tablesInfo.length > 5) {
        tablesInfo = tablesInfo.slice(0, 5);
      }

      // Update snapshot
      await this.upsertContextSnapshot({
        chatSessionId,
        tablesInfo,
        schemaName: existingSnapshot?.schemaName,
        recentCommands: existingSnapshot?.recentCommands as string[],
      });

      return {
        success: true,
        message: 'Table usage updated',
      };
    } catch (error) {
      console.error('Error in ContextSummaryService updateTableUsage:', error);
      throw error;
    }
  }

  /**
   * Generate a human-readable summary of the context
   */
  async generateContextSummary(chatSessionId: string): Promise<ApiResponse<string>> {
    try {
      const snapshotResult = await this.getContextSnapshot(chatSessionId);
      const snapshot = snapshotResult.data;

      if (!snapshot) {
        return {
          success: true,
          data: 'No context available for this chat session.',
        };
      }

      const parts: string[] = [];

      // Schema info
      if (snapshot.schemaName) {
        parts.push(`Schema: ${snapshot.schemaName}`);
      }

      // Tables info
      if (snapshot.tablesInfo && Array.isArray(snapshot.tablesInfo)) {
        const tablesInfo = snapshot.tablesInfo as TableInfo[];
        if (tablesInfo.length > 0) {
          const tableDescriptions = tablesInfo.map(table => {
            const columnNames = table.columns?.map(c => c.name).join(', ') || '';
            return `${table.tableName} (${columnNames})`;
          });
          parts.push(`Tables: ${tableDescriptions.join(', ')}`);
        }
      }

      // Recent commands
      if (snapshot.recentCommands && Array.isArray(snapshot.recentCommands)) {
        const commands = snapshot.recentCommands as string[];
        if (commands.length > 0) {
          const commandList = commands.slice(-3).join('; '); // Last 3 commands
          parts.push(`Recent queries: ${commandList}`);
        }
      }

      const summary = parts.length > 0
        ? `This chat discussed: ${parts.join('. ')}.`
        : 'No context available for this chat session.';

      return {
        success: true,
        data: summary,
      };
    } catch (error) {
      console.error('Error in ContextSummaryService generateContextSummary:', error);
      throw error;
    }
  }

  /**
   * Delete context snapshot for a chat session
   */
  async deleteContextSnapshot(chatSessionId: string): Promise<ApiResponse<any>> {
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
        message: 'Context snapshot deleted successfully',
      };
    } catch (error) {
      console.error('Error in ContextSummaryService deleteContextSnapshot:', error);
      throw error;
    }
  }
}
