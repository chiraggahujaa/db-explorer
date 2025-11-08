// Database Connection Factory
// Creates appropriate database connector based on type

import type { DatabaseConfig } from './connectors/base.js';
import { PostgreSQLConnection } from './connectors/postgresql.js';
import { MySQLConnection } from './connectors/mysql.js';
import { SQLiteConnection } from './connectors/sqlite.js';
import { SupabaseConnection } from './connectors/supabase.js';
import type { BaseDatabaseConnection } from './connectors/base.js';

export class DatabaseConnectionFactory {
  static createConnection(id: string, config: DatabaseConfig): BaseDatabaseConnection {
    // Normalize config to match connector expectations
    const normalizedConfig: DatabaseConfig = {
      ...config,
    };
    
    // Map username to user for consistency (only if user is not already set)
    if (!normalizedConfig.user && normalizedConfig.username) {
      normalizedConfig.user = normalizedConfig.username;
    }

    switch (config.type) {
      case 'postgresql':
        return new PostgreSQLConnection(id, normalizedConfig);
      case 'mysql':
        return new MySQLConnection(id, normalizedConfig);
      case 'sqlite':
        return new SQLiteConnection(id, normalizedConfig);
      case 'supabase':
        return new SupabaseConnection(id, normalizedConfig);
      default:
        throw new Error(`Unsupported database type: ${config.type}`);
    }
  }
}

