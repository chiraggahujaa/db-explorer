import api from './axios';
import type {
  CreateConnectionRequest,
  UpdateConnectionRequest,
  InviteMemberRequest,
  UpdateMemberRoleRequest,
  ConnectionsResponse,
  ConnectionResponse,
  MembersResponse,
  InvitationsResponse,
  InvitationResponse,
  ActionResponse,
} from '@/types/connection';

export const connectionsAPI = {
  // Get all connections for the current user
  getMyConnections: async (includeShared = true): Promise<ConnectionsResponse> => {
    const res = await api.get('/api/connections', {
      params: { include_shared: includeShared },
    });
    return res.data;
  },

  // Get a single connection by ID
  getConnection: async (id: string): Promise<ConnectionResponse> => {
    const res = await api.get(`/api/connections/${id}`);
    return res.data;
  },

  // Create a new connection
  createConnection: async (data: CreateConnectionRequest): Promise<ConnectionResponse> => {
    const res = await api.post('/api/connections', data);
    return res.data;
  },

  // Update a connection
  updateConnection: async (
    id: string,
    data: UpdateConnectionRequest
  ): Promise<ConnectionResponse> => {
    const res = await api.patch(`/api/connections/${id}`, data);
    return res.data;
  },

  // Delete a connection
  deleteConnection: async (id: string): Promise<ActionResponse> => {
    const res = await api.delete(`/api/connections/${id}`);
    return res.data;
  },

  // Rebuild schema (async job-based)
  rebuildSchema: async (
    id: string,
    options?: {
      force?: boolean;
      schemas?: Array<{ schema: string; tables?: string[] }>;
      config?: {
        includeSchemaMetadata?: boolean;
        includeTableMetadata?: boolean;
        includeColumnMetadata?: boolean;
        includeIndexes?: boolean;
        includeForeignKeys?: boolean;
        includeConstraints?: boolean;
        includeRowCounts?: boolean;
        includeSampleData?: boolean;
        sampleDataRowCount?: number;
      };
    }
  ): Promise<{ success: boolean; data: { jobId: string; message: string }; error?: string }> => {
    const res = await api.post(`/api/connections/${id}/rebuild`, options || {});
    return res.data;
  },

  // Get all members of a connection
  getConnectionMembers: async (id: string): Promise<MembersResponse> => {
    const res = await api.get(`/api/connections/${id}/members`);
    return res.data;
  },

  // Update a member's role
  updateMemberRole: async (
    connectionId: string,
    memberId: string,
    data: UpdateMemberRoleRequest
  ): Promise<ActionResponse> => {
    const res = await api.patch(`/api/connections/${connectionId}/members/${memberId}`, data);
    return res.data;
  },

  // Remove a member from a connection
  removeMember: async (connectionId: string, memberId: string): Promise<ActionResponse> => {
    const res = await api.delete(`/api/connections/${connectionId}/members/${memberId}`);
    return res.data;
  },

  // Leave a shared connection (remove current user from connection)
  leaveSharedConnection: async (connectionId: string): Promise<ActionResponse> => {
    const res = await api.post(`/api/connections/${connectionId}/leave`);
    return res.data;
  },

  // Invite user(s) to a connection (supports single email or multiple emails with same role)
  inviteMember: async (connectionId: string, data: InviteMemberRequest): Promise<InvitationResponse | { success: boolean; data: { invitations: any[]; errors: Array<{ email: string; error: string }> }; message?: string; error?: string }> => {
    const res = await api.post(`/api/connections/${connectionId}/invite`, data);
    return res.data;
  },

  // Get all invitations for a connection
  getConnectionInvitations: async (connectionId: string): Promise<InvitationsResponse> => {
    const res = await api.get(`/api/connections/${connectionId}/invitations`);
    return res.data;
  },

  // Send invitation email
  sendInvitationEmail: async (
    connectionId: string,
    invitationId: string
  ): Promise<ActionResponse> => {
    const res = await api.post(
      `/api/connections/${connectionId}/invitations/${invitationId}/send-email`
    );
    return res.data;
  },
};

export const invitationsAPI = {
  // Get all invitations for the current user
  getMyInvitations: async (): Promise<InvitationsResponse> => {
    const res = await api.get('/api/invitations');
    return res.data;
  },

  // Get invitation by token (public endpoint)
  getInvitationByToken: async (token: string): Promise<InvitationResponse> => {
    const res = await api.get(`/api/invitations/by-token/${token}`);
    return res.data;
  },

  // Accept an invitation
  acceptInvitation: async (id: string): Promise<ActionResponse> => {
    const res = await api.post(`/api/invitations/${id}/accept`);
    return res.data;
  },

  // Accept an invitation by token
  acceptInvitationByToken: async (token: string): Promise<ActionResponse> => {
    const res = await api.post('/api/invitations/accept-by-token', { token });
    return res.data;
  },

  // Decline an invitation
  declineInvitation: async (id: string): Promise<ActionResponse> => {
    const res = await api.post(`/api/invitations/${id}/decline`);
    return res.data;
  },

  // Cancel an invitation
  cancelInvitation: async (id: string): Promise<ActionResponse> => {
    const res = await api.delete(`/api/invitations/${id}`);
    return res.data;
  },
};

export interface Schema {
  name: string;
  tables?: string[];
}

export interface Table {
  name: string;
  schema?: string;
}

export interface SchemasResponse {
  success: boolean;
  data: Schema[];
  error?: string;
}

export interface TablesResponse {
  success: boolean;
  data: Table[];
  error?: string;
}

export const databaseExplorerAPI = {
  // Get all schemas/databases for a connection
  getSchemas: async (connectionId: string): Promise<SchemasResponse> => {
    const res = await api.get(`/api/connections/${connectionId}/schemas`);
    return res.data;
  },

  // Get all tables for a schema/database
  getTables: async (connectionId: string, schemaName?: string): Promise<TablesResponse> => {
    const res = await api.get(`/api/connections/${connectionId}/tables`, {
      params: schemaName ? { schema: schemaName } : {},
    });
    return res.data;
  },
};

export interface TrainSchemaRequest {
  force?: boolean;
}

export interface TrainSchemaResponse {
  success: boolean;
  status: 'pending' | 'training' | 'completed' | 'failed';
  message: string;
  cache?: any;
}

export interface SchemaCacheResponse {
  success: boolean;
  data?: {
    id: string;
    connection_id: string;
    schema_data: any;
    last_trained_at?: string;
    training_status?: string;
    created_at: string;
    updated_at: string;
  };
  error?: string;
}

export const schemaTrainingAPI = {
  // Train schema for a connection
  trainSchema: async (
    connectionId: string,
    force: boolean = false
  ): Promise<TrainSchemaResponse> => {
    const res = await api.post(`/api/connections/${connectionId}/train-schema`, { force });
    return res.data;
  },

  // Get schema cache status
  getSchemaCache: async (connectionId: string): Promise<any> => {
    const res = await api.get(`/api/connections/${connectionId}/schema-cache`);
    const responseData = res.data;

    // Transform snake_case to camelCase for frontend
    if (responseData.data) {
      return {
        id: responseData.data.id,
        connection_id: responseData.data.connection_id,
        schemaData: responseData.data.schema_data,
        lastTrainedAt: responseData.data.last_trained_at,
        training_status: responseData.data.training_status,
        created_at: responseData.data.created_at,
        updated_at: responseData.data.updated_at,
      };
    }

    return null;
  },

  // Delete schema cache
  deleteSchemaCache: async (connectionId: string): Promise<ActionResponse> => {
    const res = await api.delete(`/api/connections/${connectionId}/schema-cache`);
    return res.data;
  },
};
