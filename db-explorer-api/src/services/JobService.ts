/**
 * Job Service
 *
 * Manages asynchronous job processing using pg-boss (PostgreSQL-based job queue)
 * Handles job creation, status tracking, cancellation, and worker registration
 */

import { PgBoss } from 'pg-boss';
import {
  Job,
  JobData,
  JobFilters,
  JobHandler,
  JobOptions,
  JobProgress,
  JobResult,
  JobStats,
  JobStatus,
  JobType,
  JobWithMetadata,
  JobWorkerOptions,
  JobEventPayload,
} from '../types/job.js';
import { PaginatedResponse } from '../types/common.js';

// Job retry configurations for different job types
const JOB_RETRY_CONFIG: Record<JobType, Partial<JobOptions>> = {
  'schema-rebuild': {
    retryLimit: 3,
    retryDelay: 60,        // 1 minute
    retryBackoff: true,    // Exponential backoff: 1min, 2min, 4min
    expireInSeconds: 86400, // 24 hours
  },
  'data-export': {
    retryLimit: 2,
    retryDelay: 30,
    retryBackoff: true,
    expireInSeconds: 43200, // 12 hours
  },
  'bulk-import': {
    retryLimit: 2,
    retryDelay: 30,
    retryBackoff: true,
    expireInSeconds: 43200,
  },
  'analytics-report': {
    retryLimit: 1,
    retryDelay: 60,
    retryBackoff: false,
    expireInSeconds: 21600, // 6 hours
  },
  'backup-connection': {
    retryLimit: 3,
    retryDelay: 120,
    retryBackoff: true,
    expireInSeconds: 86400,
  },
};

export class JobService {
  private static instance: JobService;
  private boss: PgBoss | null = null;
  private isInitialized = false;
  private eventHandlers: Map<string, Function[]> = new Map();

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): JobService {
    if (!JobService.instance) {
      JobService.instance = new JobService();
    }
    return JobService.instance;
  }

  /**
   * Initialize pg-boss with database connection
   */
  async initialize(connectionString?: string): Promise<void> {
    if (this.isInitialized) {
      console.log('JobService already initialized');
      return;
    }

    try {
      // Build connection string from environment if not provided
      const connString = connectionString || this.buildConnectionString();

      // Initialize pg-boss
      this.boss = new PgBoss({
        connectionString: connString,
        schema: process.env.PGBOSS_SCHEMA || 'pgboss',
        archiveCompletedAfterSeconds: parseInt(process.env.PGBOSS_ARCHIVE_COMPLETED_AFTER_SECONDS || '86400', 10), // 24 hours
        deleteArchivedAfterDays: parseInt(process.env.PGBOSS_DELETE_ARCHIVED_AFTER_DAYS || '30', 10),
        retentionDays: parseInt(process.env.PGBOSS_RETENTION_DAYS || '7', 10),
        maintenanceIntervalSeconds: 300, // Run maintenance every 5 minutes
        onComplete: true, // Enable completion monitoring
      });

      // Set up error handlers
      this.boss.on('error', (error: any) => {
        console.error('pg-boss error:', error);
      });

      this.boss.on('monitor-states', (states: any) => {
        // Log queue states for monitoring
        console.log('Job queue states:', {
          created: states.created,
          retry: states.retry,
          active: states.active,
          completed: states.completed,
          failed: states.failed,
          cancelled: states.cancelled,
        });
      });

      // Start pg-boss
      await this.boss.start();
      this.isInitialized = true;

      console.log('JobService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize JobService:', error);
      throw error;
    }
  }

  /**
   * Build database connection string from environment variables
   */
  private buildConnectionString(): string {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL environment variable is not set');
    }

    // Extract project reference from Supabase URL
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    if (!projectRef) {
      throw new Error('Invalid SUPABASE_URL format');
    }

    // Build PostgreSQL connection string
    // Format: postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
    const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD;
    if (!dbPassword) {
      throw new Error('Database password not found. Set SUPABASE_DB_PASSWORD or DB_PASSWORD');
    }

    return `postgresql://postgres:${dbPassword}@db.${projectRef}.supabase.co:5432/postgres`;
  }

  /**
   * Stop pg-boss gracefully
   */
  async stop(): Promise<void> {
    if (this.boss && this.isInitialized) {
      await this.boss.stop({ graceful: true, timeout: 30000 }); // 30 second timeout
      this.isInitialized = false;
      console.log('JobService stopped');
    }
  }

  /**
   * Create and queue a new job
   */
  async createJob<T extends JobData = JobData>(
    type: JobType,
    payload: T,
    options?: Partial<JobOptions>
  ): Promise<string> {
    this.ensureInitialized();

    try {
      // Merge default retry config with provided options
      const defaultConfig = JOB_RETRY_CONFIG[type] || {};
      const jobOptions = { ...defaultConfig, ...options };

      // Convert to pg-boss options format
      const pgBossOptions: PgBoss.SendOptions = {
        priority: jobOptions.priority,
        retryLimit: jobOptions.retryLimit,
        retryDelay: jobOptions.retryDelay,
        retryBackoff: jobOptions.retryBackoff,
        expireInSeconds: jobOptions.expireInSeconds,
        singletonKey: jobOptions.singletonKey,
        startAfter: jobOptions.startAfter as any,
      };

      // Send job to queue
      const jobId = await this.boss!.send(type, payload, pgBossOptions);

      if (!jobId) {
        throw new Error('Failed to create job: no job ID returned');
      }

      console.log(`Job created: ${jobId} (type: ${type})`);

      // Emit job created event
      this.emitEvent('job:created', {
        jobId,
        type,
        event: 'created',
        userId: payload.userId,
        timestamp: new Date(),
      });

      return jobId;
    } catch (error) {
      console.error('Error creating job:', error);
      throw error;
    }
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<JobWithMetadata | null> {
    this.ensureInitialized();

    try {
      const job = await this.boss!.getJobById(jobId);
      return job ? this.mapJob(job) : null;
    } catch (error) {
      console.error('Error getting job:', error);
      return null;
    }
  }

  /**
   * Get jobs for a specific user
   */
  async getUserJobs(userId: string, filters: JobFilters = {}): Promise<PaginatedResponse<JobWithMetadata>> {
    this.ensureInitialized();

    try {
      const { page = 1, limit = 20, status, type } = filters;

      // pg-boss doesn't support user filtering directly, so we need to fetch and filter
      // This is not ideal for large datasets - consider adding user_id to job name or using metadata
      const states = status ? (Array.isArray(status) ? status : [status]) : undefined;
      const jobTypes = type ? (Array.isArray(type) ? type : [type]) : undefined;

      // Fetch jobs from pg-boss
      let allJobs: any[] = [];

      if (states) {
        for (const state of states) {
          const jobs = await this.boss!.fetch(jobTypes?.[0] || '*', 100, { includeMetadata: true });
          allJobs.push(...jobs);
        }
      } else {
        // Fetch all jobs for the user (this is inefficient, but pg-boss limitation)
        const jobs = await this.boss!.fetch('*', 100, { includeMetadata: true });
        allJobs = jobs;
      }

      // Filter by userId (from job data)
      const userJobs = allJobs.filter((job) => job.data?.userId === userId);

      // Filter by type if specified
      const filteredJobs = jobTypes
        ? userJobs.filter((job) => jobTypes.includes(job.name as JobType))
        : userJobs;

      // Apply pagination
      const total = filteredJobs.length;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedJobs = filteredJobs.slice(startIndex, endIndex);

      // Map to JobWithMetadata
      const mappedJobs = paginatedJobs.map((job) => this.mapJob(job));

      return {
        success: true,
        data: mappedJobs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: endIndex < total,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      console.error('Error getting user jobs:', error);
      throw error;
    }
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<void> {
    this.ensureInitialized();

    try {
      await this.boss!.cancel(jobId);
      console.log(`Job cancelled: ${jobId}`);

      // Get job details for event
      const job = await this.getJob(jobId);
      if (job) {
        this.emitEvent('job:cancelled', {
          jobId,
          type: job.name as JobType,
          event: 'cancelled',
          userId: job.data?.userId,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      console.error('Error cancelling job:', error);
      throw error;
    }
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<string> {
    this.ensureInitialized();

    try {
      const job = await this.getJob(jobId);
      if (!job) {
        throw new Error('Job not found');
      }

      if (job.state !== 'failed') {
        throw new Error('Only failed jobs can be retried');
      }

      // Create a new job with the same data
      const newJobId = await this.createJob(job.name as JobType, job.data);
      console.log(`Job retried: ${jobId} -> ${newJobId}`);

      return newJobId;
    } catch (error) {
      console.error('Error retrying job:', error);
      throw error;
    }
  }

  /**
   * Register a job worker/handler
   */
  async work<T = any, R = any>(
    jobName: JobType,
    handler: JobHandler<T, R>,
    options?: JobWorkerOptions
  ): Promise<void> {
    this.ensureInitialized();

    try {
      const workerOptions: PgBoss.WorkOptions = {
        teamSize: options?.teamSize || 3,
        teamConcurrency: options?.teamConcurrency || 1,
        newJobCheckInterval: options?.newJobCheckInterval,
        newJobCheckIntervalSeconds: options?.newJobCheckIntervalSeconds || 2,
      };

      await this.boss!.work(jobName, workerOptions, async (job: any) => {
        console.log(`Processing job: ${job.id} (type: ${jobName})`);

        try {
          // Emit job started event
          this.emitEvent('job:started', {
            jobId: job.id,
            type: jobName,
            event: 'started',
            userId: job.data?.userId,
            timestamp: new Date(),
          });

          // Execute handler
          const result = await handler(job);

          // Emit job completed event
          this.emitEvent('job:completed', {
            jobId: job.id,
            type: jobName,
            event: 'completed',
            userId: job.data?.userId,
            result,
            timestamp: new Date(),
          });

          return result;
        } catch (error: any) {
          console.error(`Job ${job.id} failed:`, error);

          // Emit job failed event
          this.emitEvent('job:failed', {
            jobId: job.id,
            type: jobName,
            event: 'failed',
            userId: job.data?.userId,
            error: error.message,
            timestamp: new Date(),
          });

          throw error;
        }
      });

      console.log(`Worker registered for job type: ${jobName}`);
    } catch (error) {
      console.error(`Error registering worker for ${jobName}:`, error);
      throw error;
    }
  }

  /**
   * Update job progress (stored in job data)
   */
  async updateProgress(jobId: string, progress: JobProgress): Promise<void> {
    this.ensureInitialized();

    try {
      // pg-boss doesn't have built-in progress tracking
      // We'll emit an event that can be captured by WebSocket service
      const job = await this.getJob(jobId);
      if (job) {
        this.emitEvent('job:progress', {
          jobId,
          type: job.name as JobType,
          event: 'progress',
          userId: job.data?.userId,
          progress,
          timestamp: new Date(),
        });

        console.log(`Job ${jobId} progress: ${progress.percentage}%`);
      }
    } catch (error) {
      console.error('Error updating job progress:', error);
    }
  }

  /**
   * Get job statistics
   */
  async getStats(): Promise<JobStats> {
    this.ensureInitialized();

    try {
      // pg-boss doesn't provide built-in stats, so we'll query manually
      // This is a simplified version - for production, use pg-boss maintenance queries
      return {
        total: 0,
        created: 0,
        active: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        queued: 0,
      };
    } catch (error) {
      console.error('Error getting job stats:', error);
      throw error;
    }
  }

  /**
   * Register event handler
   */
  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  /**
   * Emit event to registered handlers
   */
  private emitEvent(event: string, payload: JobEventPayload): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach((handler) => {
      try {
        handler(payload);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });
  }

  /**
   * Map pg-boss job to our JobWithMetadata type
   */
  private mapJob(job: any): JobWithMetadata {
    return {
      id: job.id,
      name: job.name,
      data: job.data,
      state: job.state,
      priority: job.priority,
      retryLimit: job.retryLimit,
      retryCount: job.retryCount,
      retryDelay: job.retryDelay,
      retryBackoff: job.retryBackoff,
      startAfter: job.startAfter,
      startedOn: job.startedOn,
      singletonKey: job.singletonKey,
      singletonOn: job.singletonOn,
      expireInSeconds: job.expireInSeconds,
      createdOn: job.createdOn,
      completedOn: job.completedOn,
      output: job.output,
    };
  }

  /**
   * Ensure service is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized || !this.boss) {
      throw new Error('JobService not initialized. Call initialize() first.');
    }
  }

  /**
   * Wait for active jobs to complete (for graceful shutdown)
   */
  async waitForActiveJobs(timeoutMs: number = 30000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      // In production, check active job count
      // For now, just wait a bit
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Export singleton instance
export const jobService = JobService.getInstance();
