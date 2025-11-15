/**
 * MCP Config Mapper
 * Maps frontend connection config to MCP database config format
 */

import type { ConnectionConfig } from '@/types/connection';
import type { MCPDatabaseConfig } from '@/services/MCPService';

export function mapConnectionConfigToMCP(
  config: ConnectionConfig
): MCPDatabaseConfig {
  const baseConfig: MCPDatabaseConfig = {
    type: config.type,
  };

  switch (config.type) {
    case 'mysql':
    case 'postgresql':
      return {
        ...baseConfig,
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password,
        // database: config.database, // establish without selecting a database name
        ssl: config.ssl || false,
      };
    
    case 'sqlite':
      return {
        ...baseConfig,
        file: config.filePath,
      };
    
    case 'supabase':
      return {
        ...baseConfig,
        projectUrl: config.url,
        anonKey: config.anonKey,
        serviceKey: config.serviceRoleKey,
        password: config.dbPassword,
      };
    
    default:
      throw new Error(`Unsupported database type for MCP: ${(config as any).type}`);
  }
}




