import api from './axios';
import type {
  ToolPermission,
  ToolRegistry,
  BulkUpdatePermissionsDto,
  PermissionCheckResult,
} from '@/types/toolPermission';

export const toolPermissionsApi = {
  async getToolRegistry(): Promise<ToolRegistry> {
    const response = await api.get('/api/tool-permissions/registry');
    return response.data.data;
  },

  async getUserPermissions(connectionId: string): Promise<ToolPermission[]> {
    const response = await api.get(`/api/tool-permissions/connections/${connectionId}`);
    return response.data.data;
  },

  async createPermission(data: {
    connectionId: string;
    scope: 'tool' | 'category';
    toolName?: string;
    categoryName?: string;
    allowed: boolean;
    autoApprove?: boolean;
  }): Promise<ToolPermission> {
    const response = await api.post('/api/tool-permissions', data);
    return response.data.data;
  },

  async updatePermission(
    id: string,
    data: {
      allowed?: boolean;
      autoApprove?: boolean;
    }
  ): Promise<ToolPermission> {
    const response = await api.put(`/api/tool-permissions/${id}`, data);
    return response.data.data;
  },

  async deletePermission(id: string): Promise<void> {
    await api.delete(`/api/tool-permissions/${id}`);
  },

  async bulkUpdatePermissions(data: BulkUpdatePermissionsDto): Promise<void> {
    await api.post('/api/tool-permissions/bulk-update', data);
  },

  async checkPermission(
    toolName: string,
    connectionId: string
  ): Promise<PermissionCheckResult> {
    const response = await api.post('/api/tool-permissions/check', {
      toolName,
      connectionId,
    });
    return response.data.data;
  },

  async initializeDefaultPermissions(connectionId: string): Promise<void> {
    await api.post(`/api/tool-permissions/connections/${connectionId}/initialize`);
  },
};
