/**
 * Job Workers Index
 *
 * Registers all job workers with the job service
 */

import { registerSchemaRebuildWorker } from './schemaRebuildWorker.js';

/**
 * Register all job workers
 */
export async function registerAllWorkers(): Promise<void> {
  console.log('Registering all job workers...');

  try {
    // Register schema rebuild worker
    await registerSchemaRebuildWorker();

    // Future workers can be registered here:
    // await registerDataExportWorker();
    // await registerBulkImportWorker();
    // await registerAnalyticsReportWorker();

    console.log('All job workers registered successfully');
  } catch (error) {
    console.error('Failed to register job workers:', error);
    throw error;
  }
}
