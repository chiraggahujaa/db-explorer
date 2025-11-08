// Database Explorer Service - Handles schema and table operations

import type { ApiResponse } from '../types/api.js';
import { ConnectionService } from './ConnectionService.js';
import type { ConnectionConfig } from '../types/connection.js';
import { DatabaseConnectionFactory } from '../database/factory.js';
import type { DatabaseConfig } from '../database/connectors/base.js';

export interface Schema {
  name: string;
  tables?: string[];
}

export interface Table {
  name: string;
  schema?: string;
}

export class DatabaseExplorerService {
  private connectionService: ConnectionService;

  constructor() {
    this.connectionService = new ConnectionService();
  }

  /**
   * Helper method to get connection and create database connection
   */
  private async getDatabaseConnection(
    connectionId: string,
    userId: string,
    includeDatabase: boolean = true
  ): Promise<{ connection: any; dbConnection: any; dbType: string }> {
    // Get connection details with unsanitized config (for internal database operations)
    const connectionResult = await this.connectionService.getConnectionByIdInternal(connectionId, userId);
    if (!connectionResult.success || !connectionResult.data) {
      throw new Error('Connection not found or access denied');
    }

    const connection = connectionResult.data;

    // Extract database type (handle both camelCase and snake_case)
    const dbType = (connection as any).dbType || (connection as any).db_type;
    if (!dbType) {
      throw new Error('Database type not found in connection data');
    }

    // Convert ConnectionConfig to DatabaseConfig format
    const dbConfig = this.convertToDatabaseConfig(connection.config, dbType, includeDatabase);

    // Create and connect to database
    const dbConnection = DatabaseConnectionFactory.createConnection(connectionId, dbConfig);
    await dbConnection.connect();

    return { connection, dbConnection, dbType };
  }

  /**
   * Get all schemas/databases for a connection
   */
  async getSchemas(connectionId: string, userId: string): Promise<ApiResponse<Schema[]>> {
    let dbConnection: any = null;

    try {
      // Get connection first to determine dbType (using internal method to get unsanitized config)
      const connectionResult = await this.connectionService.getConnectionByIdInternal(connectionId, userId);
      if (!connectionResult.success || !connectionResult.data) {
        return {
          success: false,
          error: 'Connection not found or access denied',
        };
      }

      const connection = connectionResult.data;
      const dbType = (connection as any).dbType || (connection as any).db_type;
      
      // For MySQL, don't pass database name when listing databases
      const { dbConnection: conn } = await this.getDatabaseConnection(
        connectionId,
        userId,
        dbType === 'mysql' ? false : true
      );
      dbConnection = conn;

      // Fetch schemas/databases based on database type
      const schemas = await this.fetchSchemas(dbConnection, dbType);

      return {
        success: true,
        data: schemas,
      };
    } catch (error: any) {
      console.error('Error in getSchemas:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch schemas',
      };
    } finally {
      // Always disconnect
      if (dbConnection) {
        try {
          await dbConnection.disconnect();
        } catch (disconnectError) {
          console.error('Error disconnecting database:', disconnectError);
        }
      }
    }
  }

  /**
   * Fetch schemas based on database type
   */
  private async fetchSchemas(dbConnection: any, dbType: string): Promise<Schema[]> {
    if (dbType === 'mysql') {
      // MySQL: list databases
      const databases = await dbConnection.listDatabases();
      return databases
        .filter((db: string) => !['information_schema', 'performance_schema', 'mysql', 'sys'].includes(db.toLowerCase()))
        .map((db: string) => ({ name: db }));
    } else if (dbType === 'postgresql') {
      // PostgreSQL: list schemas
      const result = await dbConnection.query(`
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        ORDER BY schema_name
      `);
      return result.results.map((row: any) => ({ name: row.schema_name }));
    } else if (dbType === 'sqlite') {
      // SQLite: single database, return default schema
      return [{ name: 'main' }];
    } else if (dbType === 'supabase') {
      // Supabase: typically uses 'public' schema
      const databases = await dbConnection.listDatabases();
      return databases.map((db: string) => ({ name: db }));
    }

    return [];
  }

  /**
   * Get all tables for a specific schema/database
   */
  async getTables(
    connectionId: string,
    userId: string,
    schemaName?: string
  ): Promise<ApiResponse<Table[]>> {
    let dbConnection: any = null;

    try {
      // For MySQL, don't pass database name when connecting
      const { dbConnection: conn, dbType } = await this.getDatabaseConnection(
        connectionId,
        userId,
        false
      );
      dbConnection = conn;

      // Fetch tables for the specified schema/database
      const tables = await this.fetchTables(dbConnection, dbType, schemaName);

      const tableObjects: Table[] = tables.map((table: string) => {
        const tableObj: Table = { name: table };
        if (schemaName) {
          tableObj.schema = schemaName;
        }
        return tableObj;
      });

      return {
        success: true,
        data: tableObjects,
      };
    } catch (error: any) {
      console.error('Error in getTables:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch tables',
      };
    } finally {
      // Always disconnect
      if (dbConnection) {
        try {
          await dbConnection.disconnect();
        } catch (disconnectError) {
          console.error('Error disconnecting database:', disconnectError);
        }
      }
    }
  }

  /**
   * Fetch tables based on database type
   */
  private async fetchTables(dbConnection: any, dbType: string, schemaName?: string): Promise<string[]> {
    if (dbType === 'mysql') {
      // MySQL: use schemaName as database name
      if (!schemaName) {
        throw new Error('Schema name is required for MySQL');
      }
      return await dbConnection.listTables(schemaName);
    } else if (dbType === 'postgresql') {
      // PostgreSQL: use schemaName as schema name
      return await dbConnection.listTables(schemaName || 'public');
    } else if (dbType === 'sqlite') {
      // SQLite: no schema concept, just list tables
      return await dbConnection.listTables();
    } else if (dbType === 'supabase') {
      // Supabase: list tables (typically from public schema)
      return await dbConnection.listTables();
    }

    return [];
  }

  /**
   * Convert ConnectionConfig to DatabaseConfig format
   */
  private convertToDatabaseConfig(config: ConnectionConfig, dbType: string, includeDatabase: boolean = true): DatabaseConfig {
    if (dbType === 'mysql' || dbType === 'postgresql') {
      const sqlConfig = config as any;
      const dbConfig: DatabaseConfig = {
        type: dbType as 'mysql' | 'postgresql',
        host: sqlConfig.host,
        port: sqlConfig.port,
        user: sqlConfig.username,
        password: sqlConfig.password,
        ssl: sqlConfig.ssl,
      };
      
      // Only include database if includeDatabase is true
      if (includeDatabase && sqlConfig.database) {
        dbConfig.database = sqlConfig.database;
      }
      
      return dbConfig;
    } else if (dbType === 'sqlite') {
      const sqliteConfig = config as any;
      return {
        type: 'sqlite',
        file: sqliteConfig.filePath,
        database: sqliteConfig.filePath, // Fallback
      };
    } else if (dbType === 'supabase') {
      const supabaseConfig = config as any;
      return {
        type: 'supabase',
        url: supabaseConfig.url,
        anonKey: supabaseConfig.anonKey,
        serviceRoleKey: supabaseConfig.serviceRoleKey,
      };
    }

    throw new Error(`Unsupported database type: ${dbType}`);
  }
}

