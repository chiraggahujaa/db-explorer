/**
 * Job Controller
 *
 * Handles HTTP requests for job management operations
 */

import { Request, Response } from 'express';
import { jobService } from '../services/JobService.js';
import { JobType, JobData, JobFilters } from '../types/job.js';

export class JobController {
  /**
   * Create a new job
   * POST /api/jobs
   */
  static async createJob(req: Request, res: Response): Promise<void> {
    try {
      const { type, payload, options } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      // Ensure userId is in payload
      const jobPayload = { ...payload, userId };

      const jobId = await jobService.createJob(type as JobType, jobPayload as JobData, options);

      res.status(201).json({
        success: true,
        data: {
          jobId,
          type,
          status: 'queued',
        },
      });
    } catch (error: any) {
      console.error('Error creating job:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create job',
      });
    }
  }

  /**
   * Get job by ID
   * GET /api/jobs/:id
   */
  static async getJob(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      const job = await jobService.getJob(id as string);

      if (!job) {
        res.status(404).json({
          success: false,
          error: 'Job not found',
        });
        return;
      }

      // Check if user owns the job
      if (job.data?.userId !== userId as string) {
        res.status(403).json({
          success: false,
          error: 'Forbidden',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: job,
      });
    } catch (error: any) {
      console.error('Error getting job:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get job',
      });
    }
  }

  /**
   * List user's jobs
   * GET /api/jobs
   */
  static async listJobs(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      const filters: JobFilters = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        status: req.query.status as any,
        type: req.query.type as any,
      };

      const result = await jobService.getUserJobs(userId as string, filters);

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Error listing jobs:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to list jobs',
      });
    }
  }

  /**
   * Cancel a job
   * DELETE /api/jobs/:id
   */
  static async cancelJob(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      // Verify ownership
      const job = await jobService.getJob(id as string);
      if (!job) {
        res.status(404).json({
          success: false,
          error: 'Job not found',
        });
        return;
      }

      if (job.data?.userId !== userId as string) {
        res.status(403).json({
          success: false,
          error: 'Forbidden',
        });
        return;
      }

      await jobService.cancelJob(id as string);

      res.status(200).json({
        success: true,
        message: 'Job cancelled successfully',
      });
    } catch (error: any) {
      console.error('Error cancelling job:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to cancel job',
      });
    }
  }

  /**
   * Retry a failed job
   * POST /api/jobs/:id/retry
   */
  static async retryJob(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      // Verify ownership
      const job = await jobService.getJob(id as string);
      if (!job) {
        res.status(404).json({
          success: false,
          error: 'Job not found',
        });
        return;
      }

      if (job.data?.userId !== userId as string) {
        res.status(403).json({
          success: false,
          error: 'Forbidden',
        });
        return;
      }

      const newJobId = await jobService.retryJob(id as string);

      res.status(200).json({
        success: true,
        data: {
          jobId: newJobId,
          originalJobId: id,
        },
      });
    } catch (error: any) {
      console.error('Error retrying job:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to retry job',
      });
    }
  }

  /**
   * Get job statistics
   * GET /api/jobs/stats
   */
  static async getStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      const stats = await jobService.getStats();

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      console.error('Error getting job stats:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get job stats',
      });
    }
  }
}
