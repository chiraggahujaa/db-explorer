/**
 * Schema Rebuild Worker
 *
 * Job worker for processing schema rebuild/training jobs
 * Fetches database schema metadata and caches it for improved performance
 */

import { jobService } from '../services/JobService.js';
import { notificationService } from '../services/NotificationService.js';
import { webSocketService } from '../services/WebSocketService.js';
import { SchemaTrainingService } from '../services/SchemaTrainingService.js';
import { SchemaRebuildJobData, SchemaRebuildResult } from '../types/job.js';

const schemaTrainingService = new SchemaTrainingService();

/**
 * Register schema rebuild worker
 */
export async function registerSchemaRebuildWorker(): Promise<void> {
  console.log('Registering schema rebuild worker...');

  await jobService.work<SchemaRebuildJobData, SchemaRebuildResult>(
    'schema-rebuild',
    async (job) => {
      const startTime = Date.now();
      const { connectionId, userId, force, schemas, config } = job.data;

      console.log(`[Job ${job.id}] Starting schema rebuild for connection ${connectionId}`);
      if (schemas && schemas.length > 0) {
        console.log(`[Job ${job.id}] Selective training: ${schemas.length} schema(s) selected`);
      }
      if (config) {
        console.log(`[Job ${job.id}] Custom config:`, config);
      }

      try {
        // Step 1: Validate connection (10%)
        await jobService.updateProgress(job.id, {
          current: 1,
          total: 5,
          percentage: 10,
          message: 'Validating connection...',
        });

        // Send notification: Job started
        await notificationService.sendJobNotification(userId, 'job_started', {
          jobId: job.id,
          jobType: 'Schema Rebuild',
          connectionId,
        });

        // Emit WebSocket event
        webSocketService.sendJobUpdate({
          jobId: job.id,
          type: 'schema-rebuild',
          event: 'started',
          userId,
          timestamp: new Date(),
        });

        // Small delay to simulate validation
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Step 2: Connect to database (30%)
        await jobService.updateProgress(job.id, {
          current: 2,
          total: 5,
          percentage: 30,
          message: 'Connecting to database...',
        });

        // Emit progress update
        webSocketService.sendJobUpdate({
          jobId: job.id,
          type: 'schema-rebuild',
          event: 'progress',
          userId,
          progress: {
            current: 2,
            total: 5,
            percentage: 30,
            message: 'Connecting to database...',
          },
          timestamp: new Date(),
        });

        await new Promise((resolve) => setTimeout(resolve, 500));

        // Step 3: Fetch schema metadata (60%)
        await jobService.updateProgress(job.id, {
          current: 3,
          total: 5,
          percentage: 60,
          message: 'Fetching schema metadata...',
        });

        // Emit progress update
        webSocketService.sendJobUpdate({
          jobId: job.id,
          type: 'schema-rebuild',
          event: 'progress',
          userId,
          progress: {
            current: 3,
            total: 5,
            percentage: 60,
            message: 'Fetching schema metadata...',
          },
          timestamp: new Date(),
        });

        // Execute actual schema training with selective schemas and config
        const schemaData = await schemaTrainingService.trainSchema(
          connectionId,
          userId,
          force || false,
          schemas,
          config
        );

        if (!schemaData) {
          throw new Error('Failed to fetch schema data');
        }

        // Step 4: Process and cache schema (80%)
        const totalTables = (schemaData.schemaData as any)?.total_tables || 0;
        await jobService.updateProgress(job.id, {
          current: 4,
          total: 5,
          percentage: 80,
          message: `Processing ${totalTables} tables...`,
        });

        // Emit progress update
        webSocketService.sendJobUpdate({
          jobId: job.id,
          type: 'schema-rebuild',
          event: 'progress',
          userId,
          progress: {
            current: 4,
            total: 5,
            percentage: 80,
            message: `Processing ${totalTables} tables...`,
          },
          timestamp: new Date(),
        });

        await new Promise((resolve) => setTimeout(resolve, 500));

        // Step 5: Complete (100%)
        await jobService.updateProgress(job.id, {
          current: 5,
          total: 5,
          percentage: 100,
          message: 'Schema rebuild completed',
        });

        const duration = Date.now() - startTime;
        const schemaDataObj = schemaData.schemaData as any;
        const result: SchemaRebuildResult = {
          success: true,
          connectionId,
          totalTables: schemaDataObj?.total_tables || 0,
          totalColumns: schemaDataObj?.total_columns || 0,
          schemas: schemaDataObj?.schemas?.map((s: any) => s.schema_name) || [],
          duration,
        };

        // Send completion notification
        await notificationService.sendJobNotification(userId, 'job_completed', {
          jobId: job.id,
          jobType: 'Schema Rebuild',
          connectionId,
          result: {
            tablesCount: result.totalTables,
            columnsCount: result.totalColumns,
            duration: `${(duration / 1000).toFixed(1)}s`,
          },
        });

        // Emit completion event
        webSocketService.sendJobUpdate({
          jobId: job.id,
          type: 'schema-rebuild',
          event: 'completed',
          userId,
          result,
          timestamp: new Date(),
        });

        console.log(`[Job ${job.id}] Schema rebuild completed successfully in ${duration}ms`);

        return result;
      } catch (error: any) {
        const duration = Date.now() - startTime;

        console.error(`[Job ${job.id}] Schema rebuild failed:`, error);

        // Send failure notification
        await notificationService.sendJobNotification(userId, 'job_failed', {
          jobId: job.id,
          jobType: 'Schema Rebuild',
          connectionId,
          error: error.message || 'Unknown error',
        });

        // Emit failure event
        webSocketService.sendJobUpdate({
          jobId: job.id,
          type: 'schema-rebuild',
          event: 'failed',
          userId,
          error: error.message,
          timestamp: new Date(),
        });

        // Return error result
        const result: SchemaRebuildResult = {
          success: false,
          connectionId,
          totalTables: 0,
          totalColumns: 0,
          schemas: [],
          duration,
          error: error.message,
        };

        // Re-throw error for pg-boss retry mechanism
        throw error;
      }
    },
    {
      teamSize: 3, // Process up to 3 jobs concurrently
      teamConcurrency: 1, // Each worker processes 1 job at a time
      newJobCheckIntervalSeconds: 2, // Check for new jobs every 2 seconds
    }
  );

  console.log('Schema rebuild worker registered successfully');
}
