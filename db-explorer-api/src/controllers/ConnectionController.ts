// Connection Controller - HTTP handlers for database connections

import { Request, Response } from 'express';
import { ConnectionService } from '../services/ConnectionService.js';
import { InvitationService } from '../services/InvitationService.js';
import { EmailService } from '../services/EmailService.js';
import { DatabaseExplorerService } from '../services/DatabaseExplorerService.js';
import { SchemaTrainingService } from '../services/SchemaTrainingService.js';
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
  private databaseExplorerService: DatabaseExplorerService;
  private schemaTrainingService: SchemaTrainingService;

  constructor() {
    this.connectionService = new ConnectionService();
    this.invitationService = new InvitationService();
    this.databaseExplorerService = new DatabaseExplorerService();
    this.schemaTrainingService = new SchemaTrainingService();
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
      const result = await this.connectionService.getUserConnections(userId as string, includeShared);

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

      const result = await this.connectionService.getConnectionById(id as string, userId as string);

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
   * Get full connection config with credentials (for AI chat initialization)
   * GET /api/connections/:id/credentials
   * TODO: This currently returns raw DB credentials (including passwords);
   *       we should replace this with a safer mechanism that doesn't send
   *       secrets back to the client.
   */
  async getConnectionCredentials(req: Request, res: Response) {
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

      // Use internal method to get unsanitized config
      if (typeof id !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Invalid connection ID',
        });
      }
      const result = await this.connectionService.getConnectionByIdInternal(id, userId as string);

      if (!result.success) {
        return res.status(404).json(result);
      }

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Get connection credentials error:', error);

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
      
      // Filter out undefined values to satisfy exactOptionalPropertyTypes
      // Remove undefined from optional config properties
      let cleanConfig: typeof validatedData.config = validatedData.config;
      if (cleanConfig.type === 'mysql' || cleanConfig.type === 'postgresql') {
        const sqlConfig = { ...cleanConfig };
        if (sqlConfig.ssl === undefined) {
          delete (sqlConfig as any).ssl;
        }
        cleanConfig = sqlConfig as typeof validatedData.config;
      }
      if (cleanConfig.type === 'supabase') {
        const supabaseConfig = { ...cleanConfig };
        if (supabaseConfig.db_password === undefined) {
          delete (supabaseConfig as any).db_password;
        }
        cleanConfig = supabaseConfig as typeof validatedData.config;
      }
      
      const connectionData = {
        name: validatedData.name,
        db_type: validatedData.db_type,
        config: cleanConfig,
        ...(validatedData.description !== undefined && { description: validatedData.description }),
      };
      
      const result = await this.connectionService.createConnection(userId as string, connectionData as any);

      // Trigger schema training asynchronously (don't wait for it to complete)
      if (result.success && result.data?.id) {
        const connectionId = result.data.id;
        this.schemaTrainingService.trainSchema(connectionId, userId as string, false)
          .then(() => {
            console.log(`Schema training completed for connection ${connectionId}`);
          })
          .catch((error) => {
            console.error(`Schema training failed for connection ${connectionId}:`, error);
          });
      }

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
      
      // Filter out undefined values to satisfy exactOptionalPropertyTypes
      const updateData: {
        name?: string;
        description?: string;
        config?: typeof validatedData.config;
        is_active?: boolean;
      } = {
        ...(validatedData.name !== undefined && { name: validatedData.name }),
        ...(validatedData.description !== undefined && { description: validatedData.description }),
        ...(validatedData.config !== undefined && { config: validatedData.config }),
        ...(validatedData.is_active !== undefined && { is_active: validatedData.is_active }),
      };
      
      const result = await this.connectionService.updateConnection(id as string, userId as string, updateData as any);

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

      const result = await this.connectionService.deleteConnection(id as string, userId as string);

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

      const result = await this.connectionService.getConnectionMembers(id as string, userId as string);

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
      const result = await this.connectionService.updateMemberRole(id as string, memberId as string, userId as string, role);

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

      const result = await this.connectionService.removeMember(id as string, memberId as string, userId as string);

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
   * Leave a shared connection (remove current user from connection)
   * POST /api/connections/:id/leave
   */
  async leaveConnection(req: Request, res: Response) {
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

      const result = await this.connectionService.leaveConnection(id as string, userId as string);

      if (!result.success) {
        return res.status(403).json(result);
      }

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Leave connection error:', error);

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
   * Invite user(s) to a connection
   * POST /api/connections/:id/invite
   * Supports single email: { email, role }
   * or multiple emails: { emails: [string], role }
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

      const { email, emails, role } = inviteMemberSchema.parse(req.body);
      
      // Determine which emails to invite
      const emailsToInvite = emails || (email ? [email] : []);
      
      // Create invitations for all emails with the same role
      const result = await this.invitationService.createBulkInvitations(
        id as string,
        emailsToInvite.map((email) => ({ email, role })),
        userId as string
      );

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

      const result = await this.invitationService.getConnectionInvitations(id as string, userId as string);

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

      const result = await this.invitationService.getUserInvitations(userId as string);

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

      const result = await this.invitationService.acceptInvitation(id as string, userId as string);

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

      const result = await this.invitationService.declineInvitation(id as string, userId as string);

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

      const result = await this.invitationService.cancelInvitation(id as string, userId as string);

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

  /**
   * Send invitation email
   * POST /api/connections/:id/invitations/:invitationId/send-email
   */
  async sendInvitationEmail(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { id, invitationId } = req.params;
      uuidSchema.parse(id);
      uuidSchema.parse(invitationId);

      // Verify user has permission (owner or admin)
      const invitationsResult = await this.invitationService.getConnectionInvitations(id as string, userId as string);
      if (!invitationsResult.success) {
        return res.status(403).json(invitationsResult);
      }

      // Find the specific invitation
      const invitation = invitationsResult.data?.find((inv) => inv.id === invitationId);
      if (!invitation) {
        return res.status(404).json({
          success: false,
          error: 'Invitation not found',
        });
      }

      // Send email
      const emailResult = await EmailService.sendInvitationEmail(invitation);
      if (!emailResult.success) {
        return res.status(500).json({
          success: false,
          error: emailResult.error || 'Failed to send email',
        });
      }

      res.status(200).json({
        success: true,
        message: 'Invitation email sent successfully',
      });
    } catch (error: any) {
      console.error('Send invitation email error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: 'Invalid parameters',
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
   * Get invitation by token (public endpoint for email links)
   * GET /api/invitations/by-token/:token
   */
  async getInvitationByToken(req: Request, res: Response) {
    try {
      const { token } = req.params;
      if (!token || token.length < 10) {
        return res.status(400).json({
          success: false,
          error: 'Invalid token',
        });
      }

      const result = await this.invitationService.getInvitationByToken(token);
      if (!result.success) {
        return res.status(404).json(result);
      }

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Get invitation by token error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Accept invitation by token
   * POST /api/invitations/accept-by-token
   */
  async acceptInvitationByToken(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { token } = req.body;
      if (!token || typeof token !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Token is required',
        });
      }

      const result = await this.invitationService.acceptInvitationByToken(token, userId as string);
      if (!result.success) {
        return res.status(400).json(result);
      }

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Accept invitation by token error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get all schemas/databases for a connection
   * GET /api/connections/:id/schemas
   */
  async getSchemas(req: Request, res: Response) {
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

      const result = await this.databaseExplorerService.getSchemas(id as string, userId as string);

      if (!result.success) {
        return res.status(404).json(result);
      }

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Get schemas error:', error);

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
   * Get all tables for a schema/database
   * GET /api/connections/:id/tables?schema=public
   */
  async getTables(req: Request, res: Response) {
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

      const schemaName = req.query.schema as string | undefined;

      const result = await this.databaseExplorerService.getTables(id as string, userId as string, schemaName);

      if (!result.success) {
        return res.status(404).json(result);
      }

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Get tables error:', error);

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
   * Get table schema/structure
   * GET /api/connections/:id/schemas/:schemaName/tables/:tableName
   */
  async getTableSchema(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { id, schemaName, tableName } = req.params;
      uuidSchema.parse(id);

      if (!schemaName || !tableName) {
        return res.status(400).json({
          success: false,
          error: 'Schema name and table name are required',
        });
      }

      const result = await this.databaseExplorerService.getTableSchema(
        id as string,
        userId as string,
        schemaName,
        tableName
      );

      if (!result.success) {
        return res.status(404).json(result);
      }

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Get table schema error:', error);

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
   * Execute a structured query
   * POST /api/connections/:id/query
   * Body: { query: { table, database, columns?, where?, orderBy?, limit?, offset?, count? } }
   */
  async executeStructuredQuery(req: Request, res: Response) {
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

      const { query } = req.body;

      if (!query || !query.table || !query.database) {
        return res.status(400).json({
          success: false,
          error: 'Query parameters must include table and database',
        });
      }

      const result = await this.databaseExplorerService.executeStructuredQuery(
        id as string,
        userId as string,
        query
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Execute structured query error:', error);

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
   * Execute raw SQL
   * POST /api/connections/:id/execute
   * Body: { query: string, schema?: string }
   */
  async executeSql(req: Request, res: Response) {
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

      const { query, schema } = req.body;

      if (!query) {
        return res.status(400).json({
          success: false,
          error: 'Query is required',
        });
      }

      const result = await this.databaseExplorerService.executeSql(
        id as string,
        userId as string,
        query,
        schema
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Execute SQL error:', error);

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
   * Trigger schema rebuild as async job
   * POST /api/connections/:id/rebuild
   */
  async rebuildSchema(req: Request, res: Response) {
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

      const { force = false, schemas, config } = req.body;

      // Verify user has access to this connection
      const connection = await this.connectionService.findById(id as string);
      if (!connection.success || !connection.data) {
        return res.status(404).json({
          success: false,
          error: 'Connection not found',
        });
      }

      // Import jobService dynamically to avoid circular dependency
      const { jobService } = await import('../services/JobService.js');

      // Create job for schema rebuild with granular options
      const jobId = await jobService.createJob(
        'schema-rebuild',
        {
          connectionId: id as string,
          userId: userId as string,
          force,
          schemas, // Array of {schema, tables?} for selective training
          config,  // Training configuration options
        },
        {
          singletonKey: `schema-rebuild-${id}`, // Prevent duplicate rebuilds for same connection
        }
      );

      res.status(202).json({
        success: true,
        data: {
          jobId,
          message: 'Schema rebuild job queued successfully',
        },
      });
    } catch (error: any) {
      console.error('Rebuild schema error:', error);

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
}
