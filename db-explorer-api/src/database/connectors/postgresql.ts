// PostgreSQL Database Connector
// Adapted from db-mcp for Node.js using pg library

import { Pool, Client } from 'pg';
import { BaseDatabaseConnection, type DatabaseConfig, type QueryResult } from './base.js';

const DEFAULT_PORT = 5432;

export class PostgreSQLConnection extends BaseDatabaseConnection {
  private pool?: Pool;
  private client?: Client;

  async connect(): Promise<void> {
    try {
      if (this.pool) {
        await this.disconnect();
      }

      const connectionString = this.config.connectionString || this.buildConnectionString();

      // Use connection pool for better performance
      this.pool = new Pool({
        connectionString,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      // Test the connection
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();

      this.setConnected(true);
      console.log(`✓ PostgreSQL connection established: ${this.id}`);
    } catch (error) {
      this.logError('connect', error);
      this.setConnected(false, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.pool) {
        await this.pool.end();
        this.pool = undefined as any;
      }
      if (this.client) {
        await this.client.end();
        this.client = undefined as any;
      }
      this.setConnected(false);
    } catch (error) {
      this.logError('disconnect', error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.pool) {
        return false;
      }

      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      this.setConnected(true);
      return true;
    } catch (error) {
      this.logError('testConnection', error);
      this.setConnected(false, error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  async query(sql: string, params: any[] = []): Promise<QueryResult> {
    if (!this.pool) {
      throw new Error(`PostgreSQL connection ${this.id} is not initialized`);
    }

    try {
      const result = await this.pool.query(sql, params);

      return {
        results: result.rows || [],
        fields: result.fields?.map(f => ({ name: f.name, type: f.dataTypeID })),
        affectedRows: result.rowCount || 0,
      };
    } catch (error) {
      this.logError('query', error);
      throw error;
    }
  }

  override async listDatabases(): Promise<string[]> {
    const result = await this.query(`
      SELECT datname
      FROM pg_database
      WHERE datistemplate = false
      ORDER BY datname
    `);
    return result.results.map((row: any) => row.datname);
  }

  async listTables(database?: string): Promise<string[]> {
    // For PostgreSQL, schemas are like databases
    // If database is specified, we'll list tables in that schema
    const schemaName = database || 'public';
    
    const result = await this.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = $1
      ORDER BY tablename
    `, [schemaName]);
    
    return result.results.map((row: any) => row.tablename);
  }

  async getTableSchema(table: string, database?: string): Promise<any[]> {
    const schemaName = database || 'public';
    
    const result = await this.query(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length,
        numeric_precision,
        numeric_scale
      FROM information_schema.columns
      WHERE table_name = $1
        AND table_schema = $2
      ORDER BY ordinal_position
    `, [table, schemaName]);

    return result.results.map((row: any) => ({
      Field: row.column_name,
      Type: this.mapPostgreSQLType(row),
      Null: row.is_nullable === 'YES' ? 'YES' : 'NO',
      Default: row.column_default,
      Key: '',
      Extra: '',
    }));
  }

  override async ping(): Promise<boolean> {
    return this.testConnection();
  }

  override async getServerInfo(): Promise<any> {
    try {
      const result = await this.query('SELECT version() as version');
      const versionResult = result.results[0] as any;
      return {
        type: 'postgresql',
        version: versionResult?.version || 'unknown',
        host: this.config.host,
        port: this.config.port,
      };
    } catch (error) {
      return {
        type: 'postgresql',
        version: 'unknown',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private buildConnectionString(): string {
    const user = this.config.user || this.config.username || 'postgres';
    const password = this.config.password || '';
    const host = this.config.host || 'localhost';
    const port = this.config.port || DEFAULT_PORT;
    const database = this.config.database || 'postgres';

    let connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}`;

    if (this.config.ssl) {
      connectionString += '?sslmode=require';
    }

    return connectionString;
  }

  private mapPostgreSQLType(column: any): string {
    const type = column.data_type.toLowerCase();

    if (column.character_maximum_length) {
      return `${type}(${column.character_maximum_length})`;
    }

    if (column.numeric_precision && column.numeric_scale !== null) {
      return `${type}(${column.numeric_precision},${column.numeric_scale})`;
    }

    if (column.numeric_precision) {
      return `${type}(${column.numeric_precision})`;
    }

    return type;
  }
}

