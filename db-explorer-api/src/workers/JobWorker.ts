/**
 * Job Worker
 *
 * This worker processes async jobs from the job queue.
 * It's designed to be scalable and can run multiple instances.
 *
 * Features:
 * - Processes jobs from BullMQ queues
 * - Supports multiple job types
 * - Progress reporting
 * - Error handling and retries
 * - Graceful shutdown
 *
 * Usage:
 * ```typescript
 * const worker = new JobWorker();
 * await worker.start();
 * ```
 */

import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { JobType, JobData, SchemaTrainingJobData } from '../types/jobs.js';
import { SchemaTrainingService } from '../services/SchemaTrainingService.js';

/**
 * Redis configuration
 */
interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  maxRetriesPerRequest?: number;
}

/**
 * JobWorker - Processes jobs from the queue
 */
export class JobWorker {
  private workers: Map<JobType, Worker>;
  private redisConnection: Redis;
  private schemaTrainingService: SchemaTrainingService;

  constructor() {
    this.workers = new Map();
    this.redisConnection = this.createRedisConnection();
    this.schemaTrainingService = SchemaTrainingService.getInstance();
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
      maxRetriesPerRequest: null,
    };

    return new Redis(config);
  }

  /**
   * Start the worker
   */
  public async start(): Promise<void> {
    console.log('Starting JobWorker...');

    // Create workers for each job type
    await this.createWorker(JobType.SCHEMA_TRAINING, this.processSchemaTraining.bind(this));

    // Add more workers as needed:
    // await this.createWorker(JobType.DATA_EXPORT, this.processDataExport.bind(this));

    console.log('JobWorker started successfully');
  }

  /**
   * Create a worker for a specific job type
   */
  private async createWorker(
    jobType: JobType,
    processor: (job: Job) => Promise<any>
  ): Promise<void> {
    const worker = new Worker(jobType, processor, {
      connection: this.redisConnection,
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5'),
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    });

    // Worker event listeners
    worker.on('completed', (job: Job) => {
      console.log(`Job ${job.id} completed successfully - ${jobType}`);
    });

    worker.on('failed', (job: Job | undefined, error: Error) => {
      console.error(`Job ${job?.id} failed - ${jobType}:`, error.message);
    });

    worker.on('error', (error: Error) => {
      console.error(`Worker error - ${jobType}:`, error);
    });

    this.workers.set(jobType, worker);
    console.log(`Worker created for job type: ${jobType}`);
  }

  /**
   * Process schema training job
   */
  private async processSchemaTraining(job: Job<SchemaTrainingJobData>): Promise<any> {
    const { connectionId, userId, force, options } = job.data;

    console.log(`Processing schema training job ${job.id} for connection ${connectionId}`);

    try {
      // Update progress: 0%
      await job.updateProgress(0);

      // Get connection info
      await job.updateProgress(10);

      // Fetch schema data based on options
      const result = await this.schemaTrainingService.trainSchemaWithOptions(
        connectionId,
        userId,
        force || false,
        options,
        async (progress: number) => {
          // Progress callback
          await job.updateProgress(progress);
        }
      );

      // Update progress: 100%
      await job.updateProgress(100);

      console.log(`Schema training completed for connection ${connectionId}`);

      return {
        success: true,
        connectionId,
        trainedAt: new Date().toISOString(),
        options,
        ...result,
      };
    } catch (error: any) {
      console.error(
        `Schema training failed for connection ${connectionId}:`,
        error.message
      );
      throw error;
    }
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    console.log('Shutting down JobWorker...');

    // Close all workers
    for (const [jobType, worker] of this.workers) {
      await worker.close();
      console.log(`Worker closed for: ${jobType}`);
    }

    // Close Redis connection
    await this.redisConnection.quit();
    console.log('Redis connection closed');

    console.log('JobWorker shut down successfully');
  }
}

export default JobWorker;
