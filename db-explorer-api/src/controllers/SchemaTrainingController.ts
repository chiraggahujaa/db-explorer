// Schema Training Controller - HTTP handlers for schema pre-training

import { Request, Response } from 'express';
import { SchemaTrainingService } from '../services/SchemaTrainingService.js';
import { JobQueueService } from '../services/JobQueueService.js';
import { NotificationService } from '../services/NotificationService.js';
import { TrainSchemaResponse } from '../types/connection.js';
import {
  JobType,
  JobPriority,
  SchemaTrainingJobData,
} from '../types/jobs.js';

export class SchemaTrainingController {
  private trainingService: SchemaTrainingService;
  private jobQueue: JobQueueService;
  private notificationService: NotificationService;

  constructor() {
    this.trainingService = SchemaTrainingService.getInstance();
    this.jobQueue = JobQueueService.getInstance();
    this.notificationService = NotificationService.getInstance();
  }

  /**
   * Train schema for a specific connection (ASYNC)
   * POST /api/connections/:id/train-schema
   *
   * This endpoint queues a schema training job and returns immediately.
   * The job will be processed asynchronously, and the client will receive
   * notifications via SSE when the job completes.
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

      const connectionId = req.params.id;
      const force = req.body.force === true || req.query.force === 'true';
      const options = req.body.options;

      // Validate options if provided
      if (options) {
        if (options.schemas && !Array.isArray(options.schemas)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid options: schemas must be an array',
          });
        }
        if (options.tables && !Array.isArray(options.tables)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid options: tables must be an array',
          });
        }
      }

      // Check if training is already in progress
      const existingCache = await this.trainingService.getSchemaCache(connectionId);
      if (existingCache && existingCache.training_status === 'training' && !force) {
        return res.status(409).json({
          success: false,
          status: 'training',
          message: 'Schema training is already in progress',
        } as TrainSchemaResponse);
      }

      // Check if recently trained (within last hour) and force is not set
      if (existingCache && existingCache.last_trained_at && !force) {
        const lastTrained = new Date(existingCache.last_trained_at);
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (lastTrained > oneHourAgo) {
          return res.status(429).json({
            success: false,
            status: 'completed',
            message: 'Schema was recently trained. Use force=true to re-train.',
          } as TrainSchemaResponse);
        }
      }

      // Create job data
      const jobData: SchemaTrainingJobData = {
        type: JobType.SCHEMA_TRAINING,
        userId,
        connectionId,
        force,
        options,
      };

      // Add job to queue
      const jobId = await this.jobQueue.addJob(
        JobType.SCHEMA_TRAINING,
        jobData,
        userId,
        {
          priority: JobPriority.NORMAL,
          attempts: 3,
          timeout: 10 * 60 * 1000, // 10 minutes
        }
      );

      // Return immediately with job ID
      const response: TrainSchemaResponse = {
        success: true,
        status: 'queued',
        message: 'Schema training job queued successfully',
        jobId,
      };

      res.status(202).json(response);
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

      res.status(500).json({
        success: false,
        status: 'failed',
        message: 'Internal server error during schema training',
      } as TrainSchemaResponse);
    }
  }

  /**
   * Get job status
   * GET /api/jobs/:jobId
   */
  async getJobStatus(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { jobId } = req.params;
      const { jobType } = req.query;

      if (!jobType) {
        return res.status(400).json({
          success: false,
          error: 'Job type is required',
        });
      }

      const jobInfo = await this.jobQueue.getJobInfo(
        jobType as JobType,
        jobId
      );

      if (!jobInfo) {
        return res.status(404).json({
          success: false,
          error: 'Job not found',
        });
      }

      // Verify user owns this job
      if (jobInfo.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
        });
      }

      res.status(200).json({
        success: true,
        data: jobInfo,
      });
    } catch (error: any) {
      console.error('Get job status error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get all jobs for current user
   * GET /api/jobs
   */
  async getUserJobs(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { jobType, limit } = req.query;
      const parsedLimit = limit ? parseInt(limit as string) : 50;

      const jobs = await this.jobQueue.getUserJobs(
        userId,
        jobType as JobType | undefined,
        parsedLimit
      );

      res.status(200).json({
        success: true,
        data: jobs,
      });
    } catch (error: any) {
      console.error('Get user jobs error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * SSE endpoint for real-time notifications
   * GET /api/notifications/stream
   */
  async streamNotifications(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      // Register SSE client
      this.notificationService.registerClient(userId, res);

      console.log(`SSE stream established for user ${userId}`);
    } catch (error: any) {
      console.error('Stream notifications error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      }
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

      const connectionId = req.params.id;

      // Verify user has access to this connection (will throw if not)
      const cache = await this.trainingService.getSchemaCache(connectionId);

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

      const connectionId = req.params.id;

      await this.trainingService.deleteSchemaCache(connectionId);

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

      // Queue jobs for each connection
      for (const connectionId of connectionIds) {
        try {
          const jobData: SchemaTrainingJobData = {
            type: JobType.SCHEMA_TRAINING,
            userId: 'system',
            connectionId,
            force: true,
          };

          await this.jobQueue.addJob(
            JobType.SCHEMA_TRAINING,
            jobData,
            'system',
            {
              priority: JobPriority.LOW,
              attempts: 3,
            }
          );

          results.successful++;
        } catch (error: any) {
          results.failed++;
          results.errors.push(`${connectionId}: ${error.message}`);
        }
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
