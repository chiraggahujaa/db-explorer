// SQLite Database Connector
// Database connector for Node.js using better-sqlite3 library

import Database from 'better-sqlite3';
import { BaseDatabaseConnection, type DatabaseConfig, type QueryResult } from './base.js';

export class SQLiteConnection extends BaseDatabaseConnection {
  private db?: Database.Database;

  async connect(): Promise<void> {
    try {
      if (this.db) {
        await this.disconnect();
      }

      const filename = this.config.file || this.config.filePath || this.config.database || ':memory:';

      this.db = new Database(filename);

      // Test the connection
      this.db.prepare('SELECT 1').get();

      this.setConnected(true);
      console.log(`✓ SQLite connection established: ${this.id} (${filename})`);
    } catch (error) {
      this.logError('connect', error);
      this.setConnected(false, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.db) {
        this.db.close();
        this.db = undefined as any;
      }
      this.setConnected(false);
    } catch (error) {
      this.logError('disconnect', error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.db) {
        return false;
      }

      this.db.prepare('SELECT 1').get();
      this.setConnected(true);
      return true;
    } catch (error) {
      this.logError('testConnection', error);
      this.setConnected(false, error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  async query(sql: string, params: any[] = []): Promise<QueryResult> {
    if (!this.db) {
      throw new Error(`SQLite connection ${this.id} is not initialized`);
    }

    try {
      const stmt = this.db.prepare(sql);

      if (sql.trim().toLowerCase().startsWith('select') || sql.trim().toLowerCase().startsWith('pragma')) {
        const results = stmt.all(...params);
        return {
          results: Array.isArray(results) ? results : [results],
          fields: this.extractFields(results),
        };
      } else {
        const result = stmt.run(...params);
        return {
          results: [],
          affectedRows: result.changes,
          insertId: Number(result.lastInsertRowid),
        };
      }
    } catch (error) {
      this.logError('query', error);
      throw error;
    }
  }

  async listTables(_database?: string): Promise<string[]> {
    const result = await this.query(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);
    return result.results.map((row: any) => row.name);
  }

  async getTableSchema(table: string, _database?: string): Promise<any[]> {
    const result = await this.query(`PRAGMA table_info(${table})`);

    return result.results.map((row: any) => ({
      Field: row.name,
      Type: row.type,
      Null: row.notnull ? 'NO' : 'YES',
      Default: row.dflt_value,
      Key: row.pk ? 'PRI' : '',
      Extra: row.pk ? 'PRIMARY KEY' : '',
    }));
  }

  override async ping(): Promise<boolean> {
    return this.testConnection();
  }

  override async getServerInfo(): Promise<any> {
    try {
      const result = await this.query('SELECT sqlite_version() as version');
      const versionResult = result.results[0] as any;
      return {
        type: 'sqlite',
        version: versionResult?.version || 'unknown',
        filename: this.config.file || this.config.filePath || this.config.database || ':memory:',
      };
    } catch (error) {
      return {
        type: 'sqlite',
        version: 'unknown',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private extractFields(results: any): any[] {
    if (!results || !Array.isArray(results) || results.length === 0) {
      return [];
    }

    const firstRow = results[0];
    if (typeof firstRow !== 'object') {
      return [];
    }

    return Object.keys(firstRow).map(key => ({
      name: key,
      type: typeof firstRow[key],
    }));
  }
}

