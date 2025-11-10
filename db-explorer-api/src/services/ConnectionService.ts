// Connection Service - Business logic for database connections

import { BaseService } from './BaseService.js';
import { supabaseAdmin } from '../utils/database.js';
import { ApiResponse } from '../types/common.js';
import { DataMapper, sanitizeConnectionConfig } from '../utils/mappers.js';
import type {
  DatabaseConnection,
  ConnectionWithRole,
  ConnectionMember,
  ConnectionMemberWithUser,
  ConnectionWithMembers,
  ConnectionInvitation,
  InvitationWithDetails,
  CreateConnectionRequest,
  UpdateConnectionRequest,
  ConnectionRole,
} from '../types/connection.js';

export class ConnectionService extends BaseService {
  constructor() {
    super('database_connections');
  }

  /**
   * Get all connections for a user (owned and shared)
   */
  async getUserConnections(
    userId: string,
    includeShared = true
  ): Promise<ApiResponse<{ owned: ConnectionWithRole[]; shared: ConnectionWithRole[] }>> {
    try {
      // Get all connections where user is a member
      const { data: memberData, error: memberError } = await supabaseAdmin
        .from('connection_members')
        .select(
          `
          connection_id,
          role,
          database_connections (
            id,
            name,
            description,
            db_type,
            config,
            created_by,
            is_active,
            created_at,
            updated_at
          )
        `
        )
        .eq('user_id', userId)
        .order('joined_at', { ascending: false });

      if (memberError) {
        throw new Error(`Database error: ${memberError.message}`);
      }

      const connectionsWithRole: ConnectionWithRole[] = (memberData || []).map((member: any) => {
        const connection = DataMapper.toCamelCase(member.database_connections);
        // Sanitize config to remove sensitive credentials
        if (connection?.config) {
          connection.config = sanitizeConnectionConfig(connection.config);
        }
        return {
          ...connection,
          userRole: member.role,
        };
      });

      // Separate owned and shared connections
      const owned = connectionsWithRole.filter((conn) => conn.userRole === 'owner');
      const shared = includeShared
        ? connectionsWithRole.filter((conn) => conn.userRole !== 'owner')
        : [];

      return {
        success: true,
        data: { owned, shared },
      };
    } catch (error) {
      console.error('Error in getUserConnections:', error);
      throw error;
    }
  }

  /**
   * Get a single connection by ID with user role (sanitized for API responses)
   */
  async getConnectionById(
    connectionId: string,
    userId: string
  ): Promise<ApiResponse<ConnectionWithRole>> {
    try {
      // Check if user has access to this connection
      const { data: memberData, error: memberError } = await supabaseAdmin
        .from('connection_members')
        .select('role')
        .eq('connection_id', connectionId)
        .eq('user_id', userId)
        .single();

      if (memberError) {
        return {
          success: false,
          error: 'Connection not found or access denied',
        };
      }

      // Get connection details
      const { data, error } = await supabaseAdmin
        .from('database_connections')
        .select('*')
        .eq('id', connectionId)
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      const connection = DataMapper.toCamelCase(data);
      // Sanitize config to remove sensitive credentials
      if (connection?.config) {
        connection.config = sanitizeConnectionConfig(connection.config);
      }

      return {
        success: true,
        data: {
          ...connection,
          userRole: memberData.role,
        },
      };
    } catch (error) {
      console.error('Error in getConnectionById:', error);
      throw error;
    }
  }

  /**
   * Get a single connection by ID with unsanitized config (for internal use only)
   * This method should NOT be exposed via API endpoints
   */
  async getConnectionByIdInternal(
    connectionId: string,
    userId: string
  ): Promise<ApiResponse<ConnectionWithRole>> {
    try {
      // Check if user has access to this connection
      const { data: memberData, error: memberError } = await supabaseAdmin
        .from('connection_members')
        .select('role')
        .eq('connection_id', connectionId)
        .eq('user_id', userId)
        .single();

      if (memberError) {
        return {
          success: false,
          error: 'Connection not found or access denied',
        };
      }

      // Get connection details
      const { data, error } = await supabaseAdmin
        .from('database_connections')
        .select('*')
        .eq('id', connectionId)
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      // Return unsanitized config for internal use (e.g., database connections)
      const connection = DataMapper.toCamelCase(data);

      return {
        success: true,
        data: {
          ...connection,
          userRole: memberData.role,
        },
      };
    } catch (error) {
      console.error('Error in getConnectionByIdInternal:', error);
      throw error;
    }
  }

  /**
   * Create a new database connection
   */
  async createConnection(
    userId: string,
    connectionData: CreateConnectionRequest
  ): Promise<ApiResponse<DatabaseConnection>> {
    try {
      // Use PostgreSQL function to bypass RLS policies
      const { data, error } = await supabaseAdmin.rpc('create_database_connection', {
        p_name: connectionData.name,
        p_description: connectionData.description || null,
        p_db_type: connectionData.db_type,
        p_config: connectionData.config,
        p_created_by: userId,
      });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      // The function returns an array, get the first result
      const connectionData_result = Array.isArray(data) && data.length > 0 ? data[0] : data;
      const connection = DataMapper.toCamelCase(connectionData_result);
      
      // Sanitize config to remove sensitive credentials before returning
      if (connection?.config) {
        connection.config = sanitizeConnectionConfig(connection.config);
      }

      return {
        success: true,
        data: connection,
        message: 'Connection created successfully',
      };
    } catch (error) {
      console.error('Error in createConnection:', error);
      throw error;
    }
  }

  /**
   * Update a connection (only owners and admins can update)
   */
  async updateConnection(
    connectionId: string,
    userId: string,
    updateData: UpdateConnectionRequest
  ): Promise<ApiResponse<DatabaseConnection>> {
    try {
      // Check if user is owner or admin
      const hasPermission = await this.checkPermission(connectionId, userId, ['owner', 'admin']);
      if (!hasPermission) {
        return {
          success: false,
          error: 'Permission denied. Only owners and admins can update connections.',
        };
      }

      const { data, error } = await supabaseAdmin
        .from('database_connections')
        .update(DataMapper.toSnakeCase(updateData))
        .eq('id', connectionId)
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      const connection = DataMapper.toCamelCase(data);
      // Sanitize config to remove sensitive credentials before returning
      if (connection?.config) {
        connection.config = sanitizeConnectionConfig(connection.config);
      }

      return {
        success: true,
        data: connection,
        message: 'Connection updated successfully',
      };
    } catch (error) {
      console.error('Error in updateConnection:', error);
      throw error;
    }
  }

  /**
   * Delete a connection (only owners can delete)
   */
  async deleteConnection(connectionId: string, userId: string): Promise<ApiResponse<void>> {
    try {
      // Check if user is owner
      const hasPermission = await this.checkPermission(connectionId, userId, ['owner']);
      if (!hasPermission) {
        return {
          success: false,
          error: 'Permission denied. Only owners can delete connections.',
        };
      }

      const { error } = await supabaseAdmin
        .from('database_connections')
        .delete()
        .eq('id', connectionId);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return {
        success: true,
        message: 'Connection deleted successfully',
      };
    } catch (error) {
      console.error('Error in deleteConnection:', error);
      throw error;
    }
  }

  /**
   * Get all members of a connection
   */
  async getConnectionMembers(
    connectionId: string,
    userId: string
  ): Promise<ApiResponse<ConnectionMemberWithUser[]>> {
    try {
      // Check if user has access to this connection
      const hasAccess = await this.checkPermission(connectionId, userId);
      if (!hasAccess) {
        return {
          success: false,
          error: 'Access denied',
        };
      }

      const { data, error } = await supabaseAdmin
        .from('connection_members')
        .select(
          `
          *,
          users (
            id,
            email,
            full_name,
            avatar_url
          )
        `
        )
        .eq('connection_id', connectionId)
        .order('joined_at', { ascending: true });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      const members: ConnectionMemberWithUser[] = (data || []).map((member: any) => ({
        ...DataMapper.toCamelCase({
          id: member.id,
          connection_id: member.connection_id,
          user_id: member.user_id,
          role: member.role,
          added_by: member.added_by,
          joined_at: member.joined_at,
          updated_at: member.updated_at,
        }),
        user: DataMapper.toCamelCase(member.users),
      }));

      return {
        success: true,
        data: members,
      };
    } catch (error) {
      console.error('Error in getConnectionMembers:', error);
      throw error;
    }
  }

  /**
   * Update a member's role (only owners and admins can update)
   */
  async updateMemberRole(
    connectionId: string,
    memberId: string,
    userId: string,
    newRole: ConnectionRole
  ): Promise<ApiResponse<ConnectionMember>> {
    try {
      // Check if user is owner or admin
      const hasPermission = await this.checkPermission(connectionId, userId, ['owner', 'admin']);
      if (!hasPermission) {
        return {
          success: false,
          error: 'Permission denied',
        };
      }

      // Prevent changing owner role (must transfer ownership instead)
      const { data: currentMember } = await supabaseAdmin
        .from('connection_members')
        .select('role')
        .eq('id', memberId)
        .single();

      if (currentMember?.role === 'owner' || newRole === 'owner') {
        return {
          success: false,
          error: 'Cannot change owner role. Use transfer ownership instead.',
        };
      }

      const { data, error } = await supabaseAdmin
        .from('connection_members')
        .update({ role: newRole })
        .eq('id', memberId)
        .eq('connection_id', connectionId)
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return {
        success: true,
        data: DataMapper.toCamelCase(data),
        message: 'Member role updated successfully',
      };
    } catch (error) {
      console.error('Error in updateMemberRole:', error);
      throw error;
    }
  }

  /**
   * Remove a member from a connection
   */
  async removeMember(
    connectionId: string,
    memberId: string,
    userId: string
  ): Promise<ApiResponse<void>> {
    try {
      // Check if user is owner or admin
      const hasPermission = await this.checkPermission(connectionId, userId, ['owner', 'admin']);
      if (!hasPermission) {
        return {
          success: false,
          error: 'Permission denied',
        };
      }

      const { error } = await supabaseAdmin
        .from('connection_members')
        .delete()
        .eq('id', memberId)
        .eq('connection_id', connectionId);

      if (error) {
        // Check if it's the last owner error
        if (error.message.includes('last owner')) {
          return {
            success: false,
            error: 'Cannot remove the last owner of a connection',
          };
        }
        throw new Error(`Database error: ${error.message}`);
      }

      return {
        success: true,
        message: 'Member removed successfully',
      };
    } catch (error) {
      console.error('Error in removeMember:', error);
      throw error;
    }
  }

  /**
   * Leave a shared connection (remove current user from connection)
   */
  async leaveConnection(
    connectionId: string,
    userId: string
  ): Promise<ApiResponse<void>> {
    try {
      // Check if user is a member of the connection
      const { data: memberData, error: memberError } = await supabaseAdmin
        .from('connection_members')
        .select('id, role')
        .eq('connection_id', connectionId)
        .eq('user_id', userId)
        .single();

      if (memberError || !memberData) {
        return {
          success: false,
          error: 'You are not a member of this connection',
        };
      }

      // Prevent owners from leaving (they should delete the connection instead)
      if (memberData.role === 'owner') {
        return {
          success: false,
          error: 'Owners cannot leave their own connection. Please delete the connection instead.',
        };
      }

      // Remove the user from the connection
      const { error } = await supabaseAdmin
        .from('connection_members')
        .delete()
        .eq('id', memberData.id)
        .eq('connection_id', connectionId)
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return {
        success: true,
        message: 'Successfully left the connection',
      };
    } catch (error) {
      console.error('Error in leaveConnection:', error);
      throw error;
    }
  }

  /**
   * Check if user has permission for a connection
   */
  private async checkPermission(
    connectionId: string,
    userId: string,
    allowedRoles?: ConnectionRole[]
  ): Promise<boolean> {
    try {
      const { data, error } = await supabaseAdmin
        .from('connection_members')
        .select('role')
        .eq('connection_id', connectionId)
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return false;
      }

      if (allowedRoles) {
        return allowedRoles.includes(data.role as ConnectionRole);
      }

      return true;
    } catch (error) {
      return false;
    }
  }
}
