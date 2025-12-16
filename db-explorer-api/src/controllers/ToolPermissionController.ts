import { Request, Response } from 'express';
import { toolPermissionService } from '../services/ToolPermissionService';
import { TOOL_REGISTRY, TOOL_CATEGORIES, getToolsByCategory } from '../config/toolRegistry';

export class ToolPermissionController {
  async getToolRegistry(req: Request, res: Response): Promise<void> {
    try {
      const categories = Object.values(TOOL_CATEGORIES);
      const tools = Object.values(TOOL_REGISTRY);

      const registry = categories.map(category => ({
        ...category,
        tools: tools.filter(t => t.category === category.id),
      }));

      res.json({
        success: true,
        data: {
          categories: registry,
          totalTools: tools.length,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get tool registry',
      });
    }
  }

  async getUserPermissions(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { connectionId } = req.params;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const permissions = await toolPermissionService.getPermissionsByUserAndConnection(
        userId,
        connectionId
      );

      res.json({
        success: true,
        data: permissions,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get permissions',
      });
    }
  }

  async createPermission(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const dto = {
        ...req.body,
        userId,
        grantedBy: userId,
      };

      const permission = await toolPermissionService.createPermission(dto);

      res.status(201).json({
        success: true,
        data: permission,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create permission',
      });
    }
  }

  async updatePermission(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const permission = await toolPermissionService.updatePermission(id, req.body);

      res.json({
        success: true,
        data: permission,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update permission',
      });
    }
  }

  async deletePermission(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await toolPermissionService.deletePermission(id);

      res.json({
        success: true,
        message: 'Permission deleted successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete permission',
      });
    }
  }

  async bulkUpdatePermissions(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const dto = {
        ...req.body,
        userId,
      };

      await toolPermissionService.bulkUpdatePermissions(dto);

      res.json({
        success: true,
        message: 'Permissions updated successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update permissions',
      });
    }
  }

  async checkPermission(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { connectionId, toolName } = req.body;

      const result = await toolPermissionService.checkPermission({
        userId,
        connectionId,
        toolName,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to check permission',
      });
    }
  }

  async getPendingRequests(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { connectionId } = req.params;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const requests = await toolPermissionService.getPendingRequests(userId, connectionId);

      res.json({
        success: true,
        data: requests,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get pending requests',
      });
    }
  }

  async respondToRequest(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { response } = req.body;

      const request = await toolPermissionService.respondToPermissionRequest(id, response);

      res.json({
        success: true,
        data: request,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to respond to request',
      });
    }
  }

  async getAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { connectionId } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const logs = await toolPermissionService.getAuditLogs(userId, connectionId, limit);

      res.json({
        success: true,
        data: logs,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get audit logs',
      });
    }
  }

  async initializeDefaultPermissions(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { connectionId } = req.params;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      await toolPermissionService.initializeDefaultPermissions(userId, connectionId);

      res.json({
        success: true,
        message: 'Default permissions initialized',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to initialize permissions',
      });
    }
  }
}

export const toolPermissionController = new ToolPermissionController();
