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
   * Get table schema/structure
   */
  async getTableSchema(
    connectionId: string,
    userId: string,
    schemaName: string,
    tableName: string
  ): Promise<ApiResponse<any>> {
    let dbConnection: any = null;

    try {
      const { dbConnection: conn, dbType } = await this.getDatabaseConnection(
        connectionId,
        userId,
        false
      );
      dbConnection = conn;

      // Get table schema based on database type
      const columns = await dbConnection.getTableSchema(tableName, schemaName);

      // Get additional metadata like indexes, foreign keys if supported
      let indexes: any[] = [];
      let foreignKeys: any[] = [];
      let primaryKey: any = null;

      try {
        if (dbType === 'mysql' || dbType === 'postgresql') {
          // Get indexes
          const indexQuery = dbType === 'mysql'
            ? `SHOW INDEX FROM \`${schemaName}\`.\`${tableName}\``
            : `SELECT * FROM pg_indexes WHERE schemaname = '${schemaName}' AND tablename = '${tableName}'`;

          const indexResult = await dbConnection.query(indexQuery);
          indexes = indexResult.results || [];

          // Get foreign keys
          if (dbType === 'mysql') {
            const fkQuery = `
              SELECT
                COLUMN_NAME as column_name,
                REFERENCED_TABLE_NAME as referenced_table,
                REFERENCED_COLUMN_NAME as referenced_column
              FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
              WHERE TABLE_SCHEMA = '${schemaName}'
                AND TABLE_NAME = '${tableName}'
                AND REFERENCED_TABLE_NAME IS NOT NULL
            `;
            const fkResult = await dbConnection.query(fkQuery);
            foreignKeys = fkResult.results || [];
          } else if (dbType === 'postgresql') {
            const fkQuery = `
              SELECT
                kcu.column_name,
                ccu.table_name AS referenced_table,
                ccu.column_name AS referenced_column
              FROM information_schema.table_constraints AS tc
              JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
              JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
              WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_schema = '${schemaName}'
                AND tc.table_name = '${tableName}'
            `;
            const fkResult = await dbConnection.query(fkQuery);
            foreignKeys = fkResult.results || [];
          }

          // Extract primary key from columns
          const pkColumns = columns.filter((col: any) =>
            col.Key === 'PRI' || col.is_primary || (col.column_key && col.column_key === 'PRI')
          );
          if (pkColumns.length > 0) {
            primaryKey = pkColumns.map((col: any) => col.Field || col.column_name || col.name);
          }
        }
      } catch (metadataError) {
        console.error('Error fetching table metadata:', metadataError);
        // Continue without metadata
      }

      return {
        success: true,
        data: {
          table: tableName,
          schema: schemaName,
          columns,
          primaryKey,
          foreignKeys,
          indexes
        }
      };
    } catch (error: any) {
      console.error('Error in getTableSchema:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch table schema',
      };
    } finally {
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
   * Execute a raw SQL query
   */
  async executeSql(
    connectionId: string,
    userId: string,
    sql: string,
    schemaName?: string
  ): Promise<ApiResponse<any>> {
    let dbConnection: any = null;

    try {
      const { dbConnection: conn, dbType } = await this.getDatabaseConnection(
        connectionId,
        userId,
        false
      );
      dbConnection = conn;

      // For MySQL, switch to the database if specified
      if (dbType === 'mysql' && schemaName) {
        await dbConnection.query(`USE \`${schemaName}\``);
      }

      // MySQL compatibility: Rewrite queries with LIMIT inside IN/ALL/ANY/SOME subqueries
      let processedSql = sql;
      if (dbType === 'mysql') {
        processedSql = this.rewriteMySqlLimitInSubquery(sql);
      }

      const result = await dbConnection.query(processedSql);

      return {
        success: true,
        data: result.results || result || []
      };
    } catch (error: any) {
      console.error('Error in executeSql:', error);
      return {
        success: false,
        error: error.message || 'Failed to execute query',
      };
    } finally {
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
   * Rewrite MySQL queries with LIMIT inside IN/ALL/ANY/SOME subqueries for compatibility
   * MySQL doesn't support LIMIT inside IN subqueries in older versions
   * Transforms: WHERE col IN (SELECT ... LIMIT n)
   * To: WHERE col IN (SELECT * FROM (SELECT ... LIMIT n) AS subq)
   */
  private rewriteMySqlLimitInSubquery(sql: string): string {
    // Use a more sophisticated approach to handle nested parentheses
    let result = sql;
    let changed = false;

    // Look for patterns like: IN (SELECT ... LIMIT ...)
    const inSubqueryPattern = /\b(IN|ALL|ANY|SOME)\s*\(\s*(SELECT\s+.+?LIMIT\s+\d+)\s*\)/gi;

    result = result.replace(inSubqueryPattern, (match, operator, subquery) => {
      changed = true;
      // Wrap the subquery in a derived table
      return `${operator} (SELECT * FROM (${subquery}) AS mysql_limit_subq)`;
    });


    return result;
  }

  /**
   * Execute a structured query (SELECT with WHERE, ORDER BY, LIMIT, etc.)
   */
  async executeStructuredQuery(
    connectionId: string,
    userId: string,
    queryParams: {
      table: string;
      database: string;
      columns?: string[];
      where?: string;
      orderBy?: string;
      limit?: number;
      offset?: number;
      count?: boolean;
    }
  ): Promise<ApiResponse<any>> {
    let dbConnection: any = null;

    try {
      const { dbConnection: conn, dbType } = await this.getDatabaseConnection(
        connectionId,
        userId,
        false
      );
      dbConnection = conn;

      const { table, database, columns, where, orderBy, limit, offset, count } = queryParams;

      // Build SQL query
      let sql = '';

      if (count) {
        sql = `SELECT COUNT(*) as count FROM \`${database}\`.\`${table}\``;
        if (where) {
          sql += ` WHERE ${where}`;
        }
      } else {
        const cols = columns && columns.length > 0 ? columns.join(', ') : '*';
        sql = `SELECT ${cols} FROM \`${database}\`.\`${table}\``;

        if (where) {
          sql += ` WHERE ${where}`;
        }

        if (orderBy) {
          sql += ` ORDER BY ${orderBy}`;
        }

        if (limit) {
          sql += ` LIMIT ${limit}`;
        }

        if (offset) {
          sql += ` OFFSET ${offset}`;
        }
      }

      const result = await dbConnection.query(sql);

      if (count) {
        return {
          success: true,
          data: {
            count: result.results[0]?.count || 0
          }
        };
      }

      return {
        success: true,
        data: result.results || []
      };
    } catch (error: any) {
      console.error('Error in executeStructuredQuery:', error);
      return {
        success: false,
        error: error.message || 'Failed to execute query',
      };
    } finally {
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
   * Execute a query on a connection (legacy method, kept for backwards compatibility)
   */
  async executeQuery(
    connectionId: string,
    query: string,
    userId: string,
    includeDatabase: boolean = true
  ): Promise<any[]> {
    let dbConnection: any = null;

    try {
      const { dbConnection: conn } = await this.getDatabaseConnection(
        connectionId,
        userId,
        includeDatabase
      );
      dbConnection = conn;

      const result = await dbConnection.query(query);
      return result.results || result || [];
    } finally {
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

