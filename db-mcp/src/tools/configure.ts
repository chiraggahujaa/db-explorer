/**
 * Configure Connection Tool
 * Allows dynamic configuration of database connections
 */

import { z } from 'zod';
import { getDatabaseManager } from '../database.js';
import { DatabaseFactory } from '../database/factories/database-factory.js';
import type { DatabaseConfig } from '../types/database.js';

export const configureConnectionSchema = z.object({
  connectionId: z.string(),
  config: z.object({
    type: z.enum(['mysql', 'postgresql', 'sqlite', 'supabase', 'planetscale', 'mongodb']),
    host: z.string().optional(),
    port: z.number().optional(),
    user: z.string().optional(),
    password: z.string().optional(),
    database: z.string().optional(),
    file: z.string().optional(),
    projectUrl: z.string().optional(),
    anonKey: z.string().optional(),
    serviceKey: z.string().optional(),
    ssl: z.boolean().optional(),
    connectionString: z.string().optional(),
  }),
});

export async function configureConnection(args: z.infer<typeof configureConnectionSchema>) {
  try {
    const { connectionId, config } = args;
    console.log('[configure_connection] Received request:', { connectionId, configType: config.type });
    
    const manager = await getDatabaseManager();
    const connectionExists = manager.getDatabaseList().includes(connectionId);
    
    console.log('[configure_connection] Connection exists:', connectionExists);
    console.log('[configure_connection] Current connections:', manager.getDatabaseList());
    
    if (connectionExists) {
      await manager.updateConnection(connectionId, config as DatabaseConfig);
      console.log('[configure_connection] Updated existing connection:', connectionId);
    } else {
      await manager.addConnection(connectionId, config as DatabaseConfig);
      console.log('[configure_connection] Added new connection:', connectionId);
    }

    manager.switchDatabase(connectionId);
    console.log('[configure_connection] Switched to connection:', connectionId);
    console.log('[configure_connection] All connections now:', manager.getDatabaseList());
    
    return {
      content: [{
        type: 'text' as const,
        text: `Connection ${connectionId} configured successfully. Type: ${config.type}`,
      }],
    };
  } catch (error) {
    console.error('[configure_connection] ERROR:', error);
    return {
      content: [{
        type: 'text' as const,
        text: `Error configuring connection: ${error instanceof Error ? error.message : String(error)}`,
      }],
      isError: true,
    };
  }
}

