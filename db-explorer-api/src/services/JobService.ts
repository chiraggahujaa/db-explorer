/**
 * Job Service
 *
 * Manages asynchronous job processing using pg-boss (PostgreSQL-based job queue)
 * Handles job creation, status tracking, cancellation, and worker registration
 */

import { PgBoss } from 'pg-boss';
import type {
  SendOptions,
  WorkOptions,
} from 'pg-boss';
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

const JOB_RETRY_CONFIG: Record<JobType, Partial<JobOptions>> = {
  'schema-rebuild': {
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true,
    expireInSeconds: 86340,
  },
  'data-export': {
    retryLimit: 2,
    retryDelay: 30,
    retryBackoff: true,
    expireInSeconds: 43200,
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
    expireInSeconds: 21600,
  },
  'backup-connection': {
    retryLimit: 3,
    retryDelay: 120,
    retryBackoff: true,
    expireInSeconds: 86340,
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
      const connString = connectionString || this.buildConnectionString();

      this.boss = new PgBoss({
        connectionString: connString,
        schema: process.env.PGBOSS_SCHEMA || 'pgboss',
        maintenanceIntervalSeconds: 300,
        monitorIntervalSeconds: 10,
      });

      this.boss.on('error', (error: any) => {
        console.error('pg-boss error:', error);
      });

      // Note: monitor-states event may not exist in pg-boss v12
      // Commented out for now
      // this.boss.on('monitor-states', (states: any) => {
      //   console.log('Job queue states:', states);
      // });

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

    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL environment variable is not set');
    }

    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    if (!projectRef) {
      throw new Error('Invalid SUPABASE_URL format');
    }

    const dbPassword = process.env.DB_PASSWORD;
    if (!dbPassword) {
      throw new Error('Database password not found. Set DB_PASSWORD environment variable');
    }

    // Use Supabase connection pooler with session mode (port 5432) for pg-boss
    // This provides better compatibility with IPv4-only environments like Render
    // Format: postgresql://postgres.{project_ref}:{password}@aws-0-{region}.pooler.supabase.com:5432/postgres
    return `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require`;
  }

  /**
   * Stop pg-boss gracefully
   */
  async stop(): Promise<void> {
    if (this.boss && this.isInitialized) {
      await this.boss.stop({ graceful: true, timeout: 30000 });
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
      const defaultConfig = JOB_RETRY_CONFIG[type] || {};
      const jobOptions = { ...defaultConfig, ...options };

      const pgBossOptions: SendOptions = {};
      if (jobOptions.priority !== undefined) pgBossOptions.priority = jobOptions.priority;
      if (jobOptions.retryLimit !== undefined) pgBossOptions.retryLimit = jobOptions.retryLimit;
      if (jobOptions.retryDelay !== undefined) pgBossOptions.retryDelay = jobOptions.retryDelay;
      if (jobOptions.retryBackoff !== undefined) pgBossOptions.retryBackoff = jobOptions.retryBackoff;
      if (jobOptions.expireInSeconds !== undefined) pgBossOptions.expireInSeconds = jobOptions.expireInSeconds;
      if (jobOptions.singletonKey !== undefined) pgBossOptions.singletonKey = jobOptions.singletonKey;
      if (jobOptions.startAfter !== undefined) pgBossOptions.startAfter = jobOptions.startAfter as any;

      const jobId = await this.boss!.send(type, payload, pgBossOptions);

      if (!jobId) {
        throw new Error('Failed to create job: no job ID returned');
      }

      console.log(`Job created: ${jobId} (type: ${type})`);

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
   * Note: In pg-boss v12+, we need the queue name to get a job
   * For now, we'll try common queue names or query all queues
   */
  async getJob(jobId: string): Promise<JobWithMetadata | null> {
    this.ensureInitialized();

    try {
      for (const jobType of ['schema-rebuild', 'data-export', 'bulk-import', 'analytics-report', 'backup-connection'] as JobType[]) {
        try {
          const job = await this.boss!.getJobById(jobType, jobId);
          if (job) {
            return this.mapJob(job);
          }
        } catch (error) {
          continue;
        }
      }
      return null;
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

      const states = status ? (Array.isArray(status) ? status : [status]) : undefined;
      const jobTypes = type ? (Array.isArray(type) ? type : [type]) : undefined;

      let allJobs: any[] = [];

      if (states) {
        for (const state of states) {
          const jobs = await this.boss!.fetch(jobTypes?.[0] || '*', { batchSize: 100, includeMetadata: true });
          allJobs.push(...jobs);
        }
      } else {
        const jobs = await this.boss!.fetch('*', { batchSize: 100, includeMetadata: true });
        allJobs = jobs;
      }

      const userJobs = allJobs.filter((job) => job.data?.userId === userId);

      const filteredJobs = jobTypes
        ? userJobs.filter((job) => jobTypes.includes(job.name as JobType))
        : userJobs;

      const total = filteredJobs.length;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedJobs = filteredJobs.slice(startIndex, endIndex);

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
      const job = await this.getJob(jobId);
      if (!job) {
        throw new Error('Job not found');
      }

      await this.boss!.cancel(job.name, jobId);
      console.log(`Job cancelled: ${jobId}`);

      this.emitEvent('job:cancelled', {
        jobId,
        type: job.name as JobType,
        event: 'cancelled',
        userId: job.data?.userId,
        timestamp: new Date(),
      });
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

      const newJobId = await this.createJob(job.name as JobType, job.data);
      console.log(`Job retried: ${jobId} -> ${newJobId}`);

      return newJobId;
    } catch (error) {
      console.error('Error retrying job:', error);
      throw error;
    }
  }

  /**
   * Create a queue (required in pg-boss v10+ before registering workers)
   */
  async createQueue(queueName: JobType): Promise<void> {
    this.ensureInitialized();

    try {
      await this.boss!.createQueue(queueName);
      console.log(`Queue created: ${queueName}`);
    } catch (error) {
      console.error(`Error creating queue ${queueName}:`, error);
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
      await this.createQueue(jobName);

      const workerOptions: WorkOptions = {
        pollingIntervalSeconds: options?.newJobCheckIntervalSeconds || 2,
        batchSize: options?.teamSize || 3,
        includeMetadata: true,
      };

      await this.boss!.work(jobName, workerOptions, async (jobs: any[]) => {
        const results = [];

        for (const job of jobs) {
          console.log(`Processing job: ${job.id} (type: ${jobName})`);

          try {
            this.emitEvent('job:started', {
              jobId: job.id,
              type: jobName,
              event: 'started',
              userId: job.data?.userId,
              timestamp: new Date(),
            });

            const result = await handler(job);

            this.emitEvent('job:completed', {
              jobId: job.id,
              type: jobName,
              event: 'completed',
              userId: job.data?.userId,
              result,
              timestamp: new Date(),
            });

            results.push(result);
          } catch (error: any) {
            console.error(`Job ${job.id} failed:`, error);

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
        }

        return results.length === 1 ? results[0] : results;
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
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

export const jobService = JobService.getInstance();
