// MySQL Database Connector
// Adapted from db-mcp for Node.js using mysql2 library

import mysql from 'mysql2/promise';
import { BaseDatabaseConnection, type DatabaseConfig, type QueryResult } from './base.js';

const DEFAULT_PORT = 3306;
const CONNECTION_DEFAULTS = {
  connectionLimit: 10,
  idleTimeout: 600000,
  queueLimit: 0,
  maxIdle: 10,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  charset: 'UTF8_GENERAL_CI',
  timezone: 'local',
  debug: false,
  multipleStatements: false,
};

export class MySQLConnection extends BaseDatabaseConnection {
  private pool?: mysql.Pool;

  async connect(): Promise<void> {
    try {
      if (this.pool) {
        await this.disconnect();
      }

      // For MySQL, don't require a database name - we can connect without it
      // This allows us to list databases first
      const poolConfig: any = {
        host: this.config.host,
        port: this.config.port || DEFAULT_PORT,
        user: this.config.user || this.config.username,
        password: this.config.password,
        connectionLimit: CONNECTION_DEFAULTS.connectionLimit,
        idleTimeout: CONNECTION_DEFAULTS.idleTimeout,
        queueLimit: CONNECTION_DEFAULTS.queueLimit,
        maxIdle: CONNECTION_DEFAULTS.maxIdle,
        enableKeepAlive: CONNECTION_DEFAULTS.enableKeepAlive,
        keepAliveInitialDelay: CONNECTION_DEFAULTS.keepAliveInitialDelay,
        ssl: this.config.ssl ? { rejectUnauthorized: true } : undefined,
        charset: CONNECTION_DEFAULTS.charset,
        timezone: CONNECTION_DEFAULTS.timezone,
        debug: CONNECTION_DEFAULTS.debug,
        multipleStatements: CONNECTION_DEFAULTS.multipleStatements,
      };

      // Only add database if it's provided and not empty
      if (this.config.database) {
        poolConfig.database = this.config.database;
      }

      this.pool = mysql.createPool(poolConfig);

      // Test the connection
      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();

      this.setConnected(true);
      console.log(`✓ MySQL connection established: ${this.id}`);
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

      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();

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
      throw new Error(`MySQL connection ${this.id} is not initialized`);
    }

    try {
      const [results, fields] = await this.pool.execute(sql, params);

      if (Array.isArray(results)) {
        return {
          results,
          fields: fields as mysql.FieldPacket[],
        };
      } else {
        return {
          results: [],
          fields: fields as mysql.FieldPacket[],
          affectedRows: (results as any).affectedRows,
          insertId: (results as any).insertId,
        };
      }
    } catch (error) {
      this.logError('query', error);
      throw error;
    }
  }

  override async listDatabases(): Promise<string[]> {
    const result = await this.query('SHOW DATABASES');
    return result.results.map((row: any) => Object.values(row)[0] as string);
  }

  async listTables(database?: string): Promise<string[]> {
    let sql = 'SHOW TABLES';
    if (database) {
      sql += ` FROM \`${database}\``;
    }

    const result = await this.query(sql);
    return result.results.map((row: any) => Object.values(row)[0] as string);
  }

  async getTableSchema(table: string, database?: string): Promise<any[]> {
    let sql = `DESCRIBE \`${table}\``;
    if (database) {
      sql = `DESCRIBE \`${database}\`.\`${table}\``;
    }

    const result = await this.query(sql);
    return result.results;
  }

  override async ping(): Promise<boolean> {
    return this.testConnection();
  }

  override async getServerInfo(): Promise<any> {
    try {
      const result = await this.query('SELECT VERSION() as version');
      const versionResult = result.results[0] as any;
      return {
        type: 'mysql',
        version: versionResult?.version || 'unknown',
        host: this.config.host,
        port: this.config.port,
      };
    } catch (error) {
      return {
        type: 'mysql',
        version: 'unknown',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

