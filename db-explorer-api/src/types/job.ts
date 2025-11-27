/**
 * Job Management System Types
 *
 * Types for the pg-boss job queue system handling async operations
 */

// Job status enum
export type JobStatus = 'created' | 'retry' | 'active' | 'completed' | 'expired' | 'cancelled' | 'failed';

// Job types enum
export type JobType =
  | 'schema-rebuild'
  | 'data-export'
  | 'bulk-import'
  | 'analytics-report'
  | 'backup-connection';

// Job priority levels
export type JobPriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * Job progress tracking
 */
export interface JobProgress {
  current: number;      // Current step (e.g., 2)
  total: number;        // Total steps (e.g., 4)
  percentage: number;   // Progress percentage (0-100)
  message?: string;     // Optional status message (e.g., "Processing table: users")
}

/**
 * Base job data structure
 */
export interface BaseJobData {
  userId: string;       // User who initiated the job
  connectionId?: string; // Optional connection ID
  metadata?: Record<string, any>; // Additional metadata
}

/**
 * Schema/table selection for granular training
 */
export interface SchemaTableSelection {
  schema: string;
  tables?: string[];  // If undefined/empty, train all tables in schema
}

/**
 * Training configuration options
 */
export interface TrainingConfig {
  includeSchemaMetadata?: boolean;    // Include schema-level metadata (default: true)
  includeTableMetadata?: boolean;     // Include table-level metadata (default: true)
  includeColumnMetadata?: boolean;    // Include column details (default: true)
  includeIndexes?: boolean;           // Include index information (default: true)
  includeForeignKeys?: boolean;       // Include foreign key relationships (default: true)
  includeConstraints?: boolean;       // Include constraints (default: true)
  includeRowCounts?: boolean;         // Include approximate row counts (default: true)
  includeSampleData?: boolean;        // Include sample data rows (default: false)
  sampleDataRowCount?: number;        // Number of sample rows per table (default: 5)
}

/**
 * Schema rebuild job data
 */
export interface SchemaRebuildJobData extends BaseJobData {
  connectionId: string;
  force?: boolean;                    // Force rebuild even if cache is fresh
  schemas?: SchemaTableSelection[];   // Specific schemas/tables to train (undefined = all)
  config?: TrainingConfig;            // Training configuration options
}

/**
 * Data export job data (future)
 */
export interface DataExportJobData extends BaseJobData {
  connectionId: string;
  query: string;
  format: 'csv' | 'json' | 'xlsx';
  fileName?: string;
}

/**
 * Bulk import job data (future)
 */
export interface BulkImportJobData extends BaseJobData {
  connectionId: string;
  fileUrl: string;
  tableName: string;
  mapping?: Record<string, string>;
}

/**
 * Union type for all job data types
 */
export type JobData = SchemaRebuildJobData | DataExportJobData | BulkImportJobData;

/**
 * Job options for queue configuration
 */
export interface JobOptions {
  priority?: number;          // 0-100, higher = more important
  retryLimit?: number;        // Max retry attempts
  retryDelay?: number;        // Delay between retries (seconds)
  retryBackoff?: boolean;     // Use exponential backoff
  expireInSeconds?: number;   // Job expiration time
  singletonKey?: string;      // Prevent duplicate jobs
  startAfter?: Date | string; // Delayed job start
}

/**
 * Job creation request
 */
export interface CreateJobRequest {
  type: JobType;
  payload: JobData;
  options?: JobOptions;
}

/**
 * Job information from pg-boss
 */
export interface Job<T = any> {
  id: string;
  name: string;           // Job type
  data: T;                // Job payload
  state: JobStatus;
  priority: number;
  retryLimit: number;
  retryCount: number;
  retryDelay: number;
  retryBackoff: boolean;
  startAfter: Date;
  startedOn?: Date;
  singletonKey?: string;
  singletonOn?: Date;
  expireInSeconds: number;
  createdOn: Date;
  completedOn?: Date;
  output?: any;           // Job result
}

/**
 * Job with additional metadata
 */
export interface JobWithMetadata extends Job {
  progress?: JobProgress;
  error?: string;
  result?: any;
}

/**
 * Job filters for listing
 */
export interface JobFilters {
  status?: JobStatus | JobStatus[];
  type?: JobType | JobType[];
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

/**
 * Job result for schema rebuild
 */
export interface SchemaRebuildResult {
  success: boolean;
  connectionId: string;
  totalTables: number;
  totalColumns: number;
  schemas: string[];
  duration: number; // in milliseconds
  error?: string;
}

/**
 * Job result for data export (future)
 */
export interface DataExportResult {
  success: boolean;
  fileUrl: string;
  fileName: string;
  rowCount: number;
  fileSize: number; // in bytes
  duration: number;
}

/**
 * Generic job result
 */
export interface JobResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

/**
 * Job statistics
 */
export interface JobStats {
  total: number;
  created: number;
  active: number;
  completed: number;
  failed: number;
  cancelled: number;
  queued: number;
}

/**
 * Job handler function type
 */
export type JobHandler<T = any, R = any> = (job: Job<T>) => Promise<R>;

/**
 * Job worker options
 */
export interface JobWorkerOptions {
  teamSize?: number;        // Number of concurrent jobs
  teamConcurrency?: number; // Jobs per worker
  newJobCheckInterval?: number; // Polling interval in ms
  newJobCheckIntervalSeconds?: number; // Polling interval in seconds
}

/**
 * Job event types
 */
export type JobEvent = 'created' | 'started' | 'progress' | 'completed' | 'failed' | 'cancelled';

/**
 * Job event payload
 */
export interface JobEventPayload {
  jobId: string;
  type: JobType;
  event: JobEvent;
  userId: string;
  progress?: JobProgress;
  result?: any;
  error?: string;
  timestamp: Date;
}
