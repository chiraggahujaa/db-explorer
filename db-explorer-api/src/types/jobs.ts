/**
 * Generalized Job Queue System Types
 *
 * This module provides type definitions for a generalized, industry-level
 * job queue system that can be used across the application for any async
 * processing needs.
 */

/**
 * Supported job types in the system
 * Add new job types here as needed
 */
export enum JobType {
  SCHEMA_TRAINING = 'schema_training',
  // Add more job types as needed:
  // DATA_EXPORT = 'data_export',
  // BATCH_IMPORT = 'batch_import',
  // REPORT_GENERATION = 'report_generation',
}

/**
 * Job status enum
 */
export enum JobStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Job priority levels
 */
export enum JobPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4,
}

/**
 * Base job data interface
 * All specific job types should extend this
 */
export interface BaseJobData {
  type: JobType;
  userId: string;
  metadata?: Record<string, any>;
}

/**
 * Schema training specific job data
 */
export interface SchemaTrainingJobData extends BaseJobData {
  type: JobType.SCHEMA_TRAINING;
  connectionId: string;
  force?: boolean;
  options?: {
    schemas?: string[];
    tables?: Array<{ schema: string; table: string }>;
    includeColumns?: boolean;
    includeTypes?: boolean;
    includeConstraints?: boolean;
    includeIndexes?: boolean;
    includeForeignKeys?: boolean;
  };
}

/**
 * Union type of all job data types
 * Add new job data types here
 */
export type JobData = SchemaTrainingJobData;

/**
 * Job result interface
 */
export interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
  completedAt?: Date;
}

/**
 * Job info interface (returned to client)
 */
export interface JobInfo {
  jobId: string;
  type: JobType;
  status: JobStatus;
  userId: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: JobResult;
  progress?: number;
}

/**
 * Notification event types
 */
export enum NotificationEventType {
  JOB_QUEUED = 'job_queued',
  JOB_STARTED = 'job_started',
  JOB_PROGRESS = 'job_progress',
  JOB_COMPLETED = 'job_completed',
  JOB_FAILED = 'job_failed',
}

/**
 * Notification payload interface
 */
export interface NotificationPayload {
  eventType: NotificationEventType;
  jobId: string;
  jobType: JobType;
  userId: string;
  data?: any;
  timestamp: Date;
}
