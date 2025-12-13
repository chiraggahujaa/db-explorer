// Schema Training Scheduler - Handles automatic weekly re-training of database schemas

import * as cron from 'node-cron';
import { SchemaTrainingService } from './SchemaTrainingService.js';

export class SchemaTrainingScheduler {
  private trainingService: SchemaTrainingService;
  private cronJob: cron.ScheduledTask | null = null;

  constructor() {
    this.trainingService = new SchemaTrainingService();
  }

  /**
   * Start the weekly training scheduler
   * Runs every Sunday at 2:00 AM by default
   * Cron format: minute hour day-of-month month day-of-week
   */
  start(cronExpression: string = '0 2 * * 0'): void {
    if (this.cronJob) {
      console.warn('Schema training scheduler is already running');
      return;
    }

    console.log(`Starting schema training scheduler with cron: ${cronExpression}`);

    this.cronJob = cron.schedule(cronExpression, async () => {
      console.log('Running scheduled schema training...');
      await this.runWeeklyTraining();
    });

    console.log('Schema training scheduler started successfully');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('Schema training scheduler stopped');
    }
  }

  /**
   * Run the weekly training job
   */
  private async runWeeklyTraining(): Promise<void> {
    const startTime = new Date();
    console.log(`Weekly schema training started at ${startTime.toISOString()}`);

    try {
      // Get all connections that need training (older than 7 days)
      const connectionIds = await this.trainingService.getConnectionsNeedingTraining();
      console.log(`Found ${connectionIds.length} connections needing training`);

      if (connectionIds.length === 0) {
        console.log('No connections need training at this time');
        return;
      }

      const results = {
        total: connectionIds.length,
        successful: 0,
        failed: 0,
        errors: [] as Array<{ connectionId: string; error: string }>,
      };

      // Process connections in batches to avoid overwhelming the system
      const BATCH_SIZE = 5;
      const DELAY_BETWEEN_BATCHES = 5000; // 5 seconds

      for (let i = 0; i < connectionIds.length; i += BATCH_SIZE) {
        const batch = connectionIds.slice(i, i + BATCH_SIZE);
        console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(connectionIds.length / BATCH_SIZE)}`);

        const batchPromises = batch.map(async (connectionId) => {
          try {
            // Use a system user ID for scheduled training
            // The service should handle this gracefully
            await this.trainingService.trainSchema(connectionId, 'system', true);
            results.successful++;
            console.log(`✓ Schema trained successfully for connection ${connectionId}`);
          } catch (error: any) {
            results.failed++;
            const errorMsg = error.message || 'Unknown error';
            results.errors.push({ connectionId, error: errorMsg });
            console.error(`✗ Schema training failed for connection ${connectionId}:`, errorMsg);
          }
        });

        await Promise.all(batchPromises);

        // Add delay between batches (except for the last batch)
        if (i + BATCH_SIZE < connectionIds.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      const durationMinutes = (duration / 1000 / 60).toFixed(2);

      console.log('=== Weekly Schema Training Summary ===');
      console.log(`Total connections processed: ${results.total}`);
      console.log(`Successful: ${results.successful}`);
      console.log(`Failed: ${results.failed}`);
      console.log(`Duration: ${durationMinutes} minutes`);
      console.log(`Completed at: ${endTime.toISOString()}`);

      if (results.errors.length > 0) {
        console.log('\nErrors:');
        results.errors.forEach(({ connectionId, error }) => {
          console.log(`  - ${connectionId}: ${error}`);
        });
      }
    } catch (error) {
      console.error('Fatal error in weekly schema training:', error);
    }
  }

  /**
   * Manually trigger the weekly training (for testing or admin actions)
   */
  async triggerManual(): Promise<void> {
    console.log('Manually triggering schema training...');
    await this.runWeeklyTraining();
  }
}

// Export a singleton instance
export const schemaTrainingScheduler = new SchemaTrainingScheduler();
