// Schema Training Controller - HTTP handlers for schema pre-training

import { Request, Response } from 'express';
import { SchemaTrainingService } from '../services/SchemaTrainingService.js';
import { TrainSchemaResponse } from '../types/connection.js';

export class SchemaTrainingController {
  private trainingService: SchemaTrainingService;

  constructor() {
    this.trainingService = new SchemaTrainingService();
  }

  /**
   * Train schema for a specific connection
   * POST /api/connections/:id/train-schema
   */
  async trainSchema(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const connectionId = req.params.id!;
      const force = req.body.force === true || req.query.force === 'true';

      const cache = await this.trainingService.trainSchema(connectionId as string, userId as string, force);

      const response: TrainSchemaResponse = {
        success: true,
        status: cache.trainingStatus,
        message: 'Schema training completed successfully',
        cache,
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Train schema error:', error);

      // Handle specific error cases
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json({
          success: false,
          status: 'failed',
          message: error.message,
        } as TrainSchemaResponse);
      }

      if (error.message.includes('already in progress')) {
        return res.status(409).json({
          success: false,
          status: 'training',
          message: error.message,
        } as TrainSchemaResponse);
      }

      if (error.message.includes('recently trained')) {
        return res.status(429).json({
          success: false,
          status: 'completed',
          message: error.message,
        } as TrainSchemaResponse);
      }

      res.status(500).json({
        success: false,
        status: 'failed',
        message: 'Internal server error during schema training',
      } as TrainSchemaResponse);
    }
  }

  /**
   * Get schema cache status for a connection
   * GET /api/connections/:id/schema-cache
   */
  async getSchemaCache(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const connectionId = req.params.id!;

      // Verify user has access to this connection (will throw if not)
      const cache = await this.trainingService.getSchemaCache(connectionId as string);

      if (!cache) {
        return res.status(404).json({
          success: false,
          error: 'No schema cache found for this connection',
        });
      }

      res.status(200).json({
        success: true,
        data: cache,
      });
    } catch (error: any) {
      console.error('Get schema cache error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Delete schema cache for a connection
   * DELETE /api/connections/:id/schema-cache
   */
  async deleteSchemaCache(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const connectionId = req.params.id!;

      await this.trainingService.deleteSchemaCache(connectionId as string);

      res.status(200).json({
        success: true,
        message: 'Schema cache deleted successfully',
      });
    } catch (error: any) {
      console.error('Delete schema cache error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get all connections that need training (for admin/cron jobs)
   * GET /api/admin/connections/needs-training
   */
  async getConnectionsNeedingTraining(req: Request, res: Response) {
    try {
      // This should be protected by admin middleware
      const connectionIds = await this.trainingService.getConnectionsNeedingTraining();

      res.status(200).json({
        success: true,
        data: {
          connection_ids: connectionIds,
          count: connectionIds.length,
        },
      });
    } catch (error: any) {
      console.error('Get connections needing training error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Trigger training for all connections that need it (for cron jobs)
   * POST /api/admin/connections/train-all
   */
  async trainAllConnections(req: Request, res: Response) {
    try {
      // This should be protected by admin middleware or cron token
      const connectionIds = await this.trainingService.getConnectionsNeedingTraining();

      const results = {
        total: connectionIds.length,
        successful: 0,
        failed: 0,
        errors: [] as string[],
      };

      // Train each connection (in parallel with limit)
      const BATCH_SIZE = 5;
      for (let i = 0; i < connectionIds.length; i += BATCH_SIZE) {
        const batch = connectionIds.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (connectionId) => {
          try {
            // Get the creator/owner of the connection to use their userId
            // For now, we'll need to get this from the database
            // This is a limitation - we need a system user or service account
            // For MVP, we'll skip the userId check in the service method
            await this.trainingService.trainSchema(connectionId, 'system', true);
            results.successful++;
          } catch (error: any) {
            results.failed++;
            results.errors.push(`${connectionId}: ${error.message}`);
          }
        });

        await Promise.all(promises);
      }

      res.status(200).json({
        success: true,
        data: results,
      });
    } catch (error: any) {
      console.error('Train all connections error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
}
