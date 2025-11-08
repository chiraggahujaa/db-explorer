// Base Database Connection Interface
// Adapted from db-mcp for Node.js

export interface DatabaseConfig {
  type: 'mysql' | 'postgresql' | 'sqlite' | 'supabase';
  host?: string;
  port?: number;
  user?: string;
  username?: string;
  password?: string;
  database?: string;
  file?: string; // For SQLite
  filePath?: string; // For SQLite (alternative)
  url?: string; // For Supabase
  projectUrl?: string; // For Supabase (alternative)
  anonKey?: string; // For Supabase
  serviceRoleKey?: string; // For Supabase
  serviceKey?: string; // For Supabase (alternative)
  ssl?: boolean;
  connectionString?: string;
}

export interface QueryResult {
  results: any[];
  fields?: any[];
  affectedRows?: number;
  insertId?: number;
}

export interface ConnectionStatus {
  id: string;
  type: string;
  isConnected: boolean;
  lastConnected?: Date;
  lastError?: string;
  host?: string;
  port?: number;
  database?: string;
}

export abstract class BaseDatabaseConnection {
  public readonly id: string;
  public readonly type: string;
  public readonly config: DatabaseConfig;

  protected _isConnected: boolean = false;
  protected _lastError?: string;
  protected _lastConnected?: Date;

  constructor(id: string, config: DatabaseConfig) {
    this.id = id;
    this.type = config.type;
    this.config = { ...config };
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  get lastError(): string | undefined {
    return this._lastError;
  }

  get lastConnected(): Date | undefined {
    return this._lastConnected;
  }

  getStatus(): ConnectionStatus {
    const status: ConnectionStatus = {
      id: this.id,
      type: this.type,
      isConnected: this._isConnected,
    };
    
    if (this._lastConnected) {
      status.lastConnected = this._lastConnected;
    }
    
    if (this._lastError) {
      status.lastError = this._lastError;
    }
    
    if (this.config.host) {
      status.host = this.config.host;
    }
    
    if (this.config.port) {
      status.port = this.config.port;
    }
    
    if (this.config.database) {
      status.database = this.config.database;
    }
    
    return status;
  }

  protected setConnected(connected: boolean, error?: string): void {
    this._isConnected = connected;
    if (connected) {
      this._lastConnected = new Date();
      delete this._lastError;
    } else {
      if (error) {
        this._lastError = error;
      } else {
        delete this._lastError;
      }
    }
  }

  protected logError(operation: string, error: any): void {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${this.id}:${this.type}] ${operation} failed:`, errorMsg);
    this._lastError = errorMsg;
  }

  // Abstract methods that must be implemented
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract testConnection(): Promise<boolean>;
  abstract query(sql: string, params?: any[]): Promise<QueryResult>;
  abstract listTables(database?: string): Promise<string[]>;
  abstract getTableSchema(table: string, database?: string): Promise<any[]>;

  // Optional methods
  async listDatabases?(): Promise<string[]>;
  async ping?(): Promise<boolean>;
  async getServerInfo?(): Promise<any>;
}

