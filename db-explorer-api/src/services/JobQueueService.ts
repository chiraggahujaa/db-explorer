/**
 * Generalized Job Queue Service
 *
 * Industry-level job queue implementation using BullMQ.
 * This service provides a centralized way to manage async jobs across the application.
 *
 * Features:
 * - Multiple job queues with different priorities
 * - Job retries with exponential backoff
 * - Job progress tracking
 * - Job timeout handling
 * - Redis-based persistence
 * - Scalable worker architecture
 *
 * Usage:
 * ```typescript
 * const jobQueue = JobQueueService.getInstance();
 * const jobId = await jobQueue.addJob(JobType.SCHEMA_TRAINING, data, userId);
 * ```
 */

import { Queue, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import {
  JobType,
  JobData,
  JobStatus,
  JobPriority,
  JobInfo,
  NotificationEventType,
} from '../types/jobs.js';
import { NotificationService } from './NotificationService.js';

/**
 * Configuration for Redis connection
 */
interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  maxRetriesPerRequest?: number;
}

/**
 * Job options
 */
interface JobOptions {
  priority?: JobPriority;
  delay?: number; // Delay in milliseconds
  attempts?: number; // Number of retry attempts
  backoff?: {
    type: 'exponential' | 'fixed';
    delay: number;
  };
  timeout?: number; // Job timeout in milliseconds
}

/**
 * JobQueueService - Singleton service for managing job queues
 */
export class JobQueueService {
  private static instance: JobQueueService;
  private queues: Map<JobType, Queue>;
  private queueEvents: Map<JobType, QueueEvents>;
  private redisConnection: Redis;
  private notificationService: NotificationService;
  private initialized: boolean = false;

  private constructor() {
    this.queues = new Map();
    this.queueEvents = new Map();
    this.redisConnection = this.createRedisConnection();
    this.notificationService = NotificationService.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): JobQueueService {
    if (!JobQueueService.instance) {
      JobQueueService.instance = new JobQueueService();
    }
    return JobQueueService.instance;
  }

  /**
   * Create Redis connection
   */
  private createRedisConnection(): Redis {
    const config: RedisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      maxRetriesPerRequest: null, // Required for BullMQ
    };

    return new Redis(config);
  }

  /**
   * Initialize job queues and event listeners
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('JobQueueService already initialized');
      return;
    }

    console.log('Initializing JobQueueService...');

    // Initialize queues for each job type
    for (const jobType of Object.values(JobType)) {
      await this.createQueue(jobType as JobType);
    }

    this.initialized = true;
    console.log('JobQueueService initialized successfully');
  }

  /**
   * Create a queue for a specific job type
   */
  private async createQueue(jobType: JobType): Promise<void> {
    const queue = new Queue(jobType, {
      connection: this.redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: {
          age: 24 * 3600, // Keep completed jobs for 24 hours
          count: 1000, // Keep last 1000 completed jobs
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        },
      },
    });

    this.queues.set(jobType, queue);

    // Create queue events listener
    const queueEvents = new QueueEvents(jobType, {
      connection: this.redisConnection.duplicate(),
    });

    this.queueEvents.set(jobType, queueEvents);

    // Set up event listeners
    this.setupEventListeners(jobType, queueEvents);

    console.log(`Queue created for job type: ${jobType}`);
  }

  /**
   * Set up event listeners for a queue
   */
  private setupEventListeners(
    jobType: JobType,
    queueEvents: QueueEvents
  ): void {
    // Job added to queue
    queueEvents.on('added', async ({ jobId }) => {
      console.log(`Job ${jobId} added to queue: ${jobType}`);
      const job = await this.getJob(jobType, jobId);
      if (job) {
        await this.notificationService.sendNotification(job.userId, {
          eventType: NotificationEventType.JOB_QUEUED,
          jobId,
          jobType,
          userId: job.userId,
          data: { status: JobStatus.QUEUED },
          timestamp: new Date(),
        });
      }
    });

    // Job started processing
    queueEvents.on('active', async ({ jobId }) => {
      console.log(`Job ${jobId} started processing: ${jobType}`);
      const job = await this.getJob(jobType, jobId);
      if (job) {
        await this.notificationService.sendNotification(job.userId, {
          eventType: NotificationEventType.JOB_STARTED,
          jobId,
          jobType,
          userId: job.userId,
          data: { status: JobStatus.PROCESSING },
          timestamp: new Date(),
        });
      }
    });

    // Job completed successfully
    queueEvents.on('completed', async ({ jobId, returnvalue }) => {
      console.log(`Job ${jobId} completed: ${jobType}`);
      const job = await this.getJob(jobType, jobId);
      if (job) {
        await this.notificationService.sendNotification(job.userId, {
          eventType: NotificationEventType.JOB_COMPLETED,
          jobId,
          jobType,
          userId: job.userId,
          data: {
            status: JobStatus.COMPLETED,
            result: returnvalue,
          },
          timestamp: new Date(),
        });
      }
    });

    // Job failed
    queueEvents.on('failed', async ({ jobId, failedReason }) => {
      console.error(`Job ${jobId} failed: ${jobType}`, failedReason);
      const job = await this.getJob(jobType, jobId);
      if (job) {
        await this.notificationService.sendNotification(job.userId, {
          eventType: NotificationEventType.JOB_FAILED,
          jobId,
          jobType,
          userId: job.userId,
          data: {
            status: JobStatus.FAILED,
            error: failedReason,
          },
          timestamp: new Date(),
        });
      }
    });

    // Job progress update
    queueEvents.on('progress', async ({ jobId, data }) => {
      const job = await this.getJob(jobType, jobId);
      if (job) {
        await this.notificationService.sendNotification(job.userId, {
          eventType: NotificationEventType.JOB_PROGRESS,
          jobId,
          jobType,
          userId: job.userId,
          data: {
            status: JobStatus.PROCESSING,
            progress: data,
          },
          timestamp: new Date(),
        });
      }
    });
  }

  /**
   * Add a job to the queue
   */
  public async addJob<T extends JobData>(
    jobType: JobType,
    data: T,
    userId: string,
    options?: JobOptions
  ): Promise<string> {
    const queue = this.queues.get(jobType);
    if (!queue) {
      throw new Error(`Queue not found for job type: ${jobType}`);
    }

    const jobData: T = {
      ...data,
      userId,
    };

    const job = await queue.add(jobType, jobData, {
      priority: options?.priority,
      delay: options?.delay,
      attempts: options?.attempts,
      backoff: options?.backoff,
      timeout: options?.timeout,
    });

    console.log(`Job ${job.id} added to queue: ${jobType}`);
    return job.id!;
  }

  /**
   * Get job by ID
   */
  public async getJob(jobType: JobType, jobId: string): Promise<any> {
    const queue = this.queues.get(jobType);
    if (!queue) {
      throw new Error(`Queue not found for job type: ${jobType}`);
    }

    return await queue.getJob(jobId);
  }

  /**
   * Get job info by ID
   */
  public async getJobInfo(jobType: JobType, jobId: string): Promise<JobInfo | null> {
    const job = await this.getJob(jobType, jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();
    const statusMap: Record<string, JobStatus> = {
      waiting: JobStatus.QUEUED,
      active: JobStatus.PROCESSING,
      completed: JobStatus.COMPLETED,
      failed: JobStatus.FAILED,
    };

    return {
      jobId: job.id!,
      type: jobType,
      status: statusMap[state] || JobStatus.QUEUED,
      userId: job.data.userId,
      createdAt: new Date(job.timestamp),
      startedAt: job.processedOn ? new Date(job.processedOn) : undefined,
      completedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
      result: job.returnvalue
        ? {
            success: true,
            data: job.returnvalue,
            completedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
          }
        : undefined,
      progress: job.progress as number | undefined,
    };
  }

  /**
   * Get all jobs for a user
   */
  public async getUserJobs(
    userId: string,
    jobType?: JobType,
    limit: number = 50
  ): Promise<JobInfo[]> {
    const jobInfos: JobInfo[] = [];

    const jobTypes = jobType ? [jobType] : Array.from(this.queues.keys());

    for (const type of jobTypes) {
      const queue = this.queues.get(type);
      if (!queue) continue;

      const jobs = await queue.getJobs(['waiting', 'active', 'completed', 'failed'], 0, limit);

      for (const job of jobs) {
        if (job.data.userId === userId) {
          const info = await this.getJobInfo(type, job.id!);
          if (info) {
            jobInfos.push(info);
          }
        }
      }
    }

    return jobInfos.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Cancel a job
   */
  public async cancelJob(jobType: JobType, jobId: string): Promise<void> {
    const job = await this.getJob(jobType, jobId);
    if (job) {
      await job.remove();
      console.log(`Job ${jobId} cancelled`);
    }
  }

  /**
   * Clean up old jobs
   */
  public async cleanup(): Promise<void> {
    console.log('Cleaning up job queues...');

    for (const [jobType, queue] of this.queues) {
      await queue.clean(24 * 3600 * 1000, 1000, 'completed'); // Clean completed jobs older than 24h
      await queue.clean(7 * 24 * 3600 * 1000, 1000, 'failed'); // Clean failed jobs older than 7d
      console.log(`Cleaned up old jobs for: ${jobType}`);
    }
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    console.log('Shutting down JobQueueService...');

    // Close all queue events
    for (const [jobType, queueEvents] of this.queueEvents) {
      await queueEvents.close();
      console.log(`Queue events closed for: ${jobType}`);
    }

    // Close all queues
    for (const [jobType, queue] of this.queues) {
      await queue.close();
      console.log(`Queue closed for: ${jobType}`);
    }

    // Close Redis connection
    await this.redisConnection.quit();
    console.log('Redis connection closed');

    this.initialized = false;
    console.log('JobQueueService shut down successfully');
  }
}

export default JobQueueService;
