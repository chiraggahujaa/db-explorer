// Connection Controller - HTTP handlers for database connections

import { Request, Response } from 'express';
import { ConnectionService } from '../services/ConnectionService.js';
import { InvitationService } from '../services/InvitationService.js';
import {
  createConnectionSchema,
  updateConnectionSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  uuidSchema,
} from '../validations/connection.js';

export class ConnectionController {
  private connectionService: ConnectionService;
  private invitationService: InvitationService;

  constructor() {
    this.connectionService = new ConnectionService();
    this.invitationService = new InvitationService();
  }

  /**
   * Get all connections for the current user
   * GET /api/connections
   */
  async getMyConnections(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const includeShared = req.query.include_shared !== 'false';
      const result = await this.connectionService.getUserConnections(userId, includeShared);

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Get my connections error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get a single connection by ID
   * GET /api/connections/:id
   */
  async getConnection(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { id } = req.params;
      uuidSchema.parse(id);

      const result = await this.connectionService.getConnectionById(id, userId);

      if (!result.success) {
        return res.status(404).json(result);
      }

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Get connection error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: 'Invalid connection ID',
          details: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Create a new connection
   * POST /api/connections
   */
  async createConnection(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const validatedData = createConnectionSchema.parse(req.body);
      const result = await this.connectionService.createConnection(userId, validatedData);

      res.status(201).json(result);
    } catch (error: any) {
      console.error('Create connection error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Update a connection
   * PATCH /api/connections/:id
   */
  async updateConnection(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { id } = req.params;
      uuidSchema.parse(id);

      const validatedData = updateConnectionSchema.parse(req.body);
      const result = await this.connectionService.updateConnection(id, userId, validatedData);

      if (!result.success) {
        return res.status(403).json(result);
      }

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Update connection error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Delete a connection
   * DELETE /api/connections/:id
   */
  async deleteConnection(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { id } = req.params;
      uuidSchema.parse(id);

      const result = await this.connectionService.deleteConnection(id, userId);

      if (!result.success) {
        return res.status(403).json(result);
      }

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Delete connection error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: 'Invalid connection ID',
          details: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get all members of a connection
   * GET /api/connections/:id/members
   */
  async getConnectionMembers(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { id } = req.params;
      uuidSchema.parse(id);

      const result = await this.connectionService.getConnectionMembers(id, userId);

      if (!result.success) {
        return res.status(403).json(result);
      }

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Get connection members error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: 'Invalid connection ID',
          details: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Update a member's role
   * PATCH /api/connections/:id/members/:memberId
   */
  async updateMemberRole(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { id, memberId } = req.params;
      uuidSchema.parse(id);
      uuidSchema.parse(memberId);

      const { role } = updateMemberRoleSchema.parse(req.body);
      const result = await this.connectionService.updateMemberRole(id, memberId, userId, role);

      if (!result.success) {
        return res.status(403).json(result);
      }

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Update member role error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Remove a member from a connection
   * DELETE /api/connections/:id/members/:memberId
   */
  async removeMember(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { id, memberId } = req.params;
      uuidSchema.parse(id);
      uuidSchema.parse(memberId);

      const result = await this.connectionService.removeMember(id, memberId, userId);

      if (!result.success) {
        return res.status(403).json(result);
      }

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Remove member error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Invite a user to a connection
   * POST /api/connections/:id/invite
   */
  async inviteMember(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { id } = req.params;
      uuidSchema.parse(id);

      const { email, role } = inviteMemberSchema.parse(req.body);
      const result = await this.invitationService.createInvitation(id, email, role, userId);

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.status(201).json(result);
    } catch (error: any) {
      console.error('Invite member error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get all invitations for a connection
   * GET /api/connections/:id/invitations
   */
  async getConnectionInvitations(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { id } = req.params;
      uuidSchema.parse(id);

      const result = await this.invitationService.getConnectionInvitations(id, userId);

      if (!result.success) {
        return res.status(403).json(result);
      }

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Get connection invitations error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: 'Invalid connection ID',
          details: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get all invitations for the current user
   * GET /api/invitations
   */
  async getMyInvitations(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const result = await this.invitationService.getUserInvitations(userId);

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Get my invitations error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Accept an invitation
   * POST /api/invitations/:id/accept
   */
  async acceptInvitation(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { id } = req.params;
      uuidSchema.parse(id);

      const result = await this.invitationService.acceptInvitation(id, userId);

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Accept invitation error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: 'Invalid invitation ID',
          details: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Decline an invitation
   * POST /api/invitations/:id/decline
   */
  async declineInvitation(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { id } = req.params;
      uuidSchema.parse(id);

      const result = await this.invitationService.declineInvitation(id, userId);

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Decline invitation error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: 'Invalid invitation ID',
          details: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Cancel an invitation
   * DELETE /api/invitations/:id
   */
  async cancelInvitation(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { id } = req.params;
      uuidSchema.parse(id);

      const result = await this.invitationService.cancelInvitation(id, userId);

      if (!result.success) {
        return res.status(403).json(result);
      }

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Cancel invitation error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: 'Invalid invitation ID',
          details: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
}
