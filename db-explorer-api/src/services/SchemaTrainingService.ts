import { supabaseAdmin } from '../lib/supabase.js';
import { ConnectionService } from './ConnectionService.js';
import { DatabaseExplorerService } from './DatabaseExplorerService.js';
import {
  ConnectionSchemaCache,
  CachedSchemaData,
  SchemaMetadata,
  TableMetadata,
  ColumnMetadata,
  IndexMetadata,
  ForeignKeyMetadata,
  DatabaseType
} from '../types/connection.js';
import { DataMapper } from '../utils/mappers.js';

export class SchemaTrainingService {
  private static instance: SchemaTrainingService;
  private connectionService: ConnectionService;
  private explorerService: DatabaseExplorerService;

  constructor() {
    this.connectionService = new ConnectionService();
    this.explorerService = new DatabaseExplorerService();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): SchemaTrainingService {
    if (!SchemaTrainingService.instance) {
      SchemaTrainingService.instance = new SchemaTrainingService();
    }
    return SchemaTrainingService.instance;
  }

  /**
   * Train schema for a specific connection
   * This will fetch all schema metadata and store it in the cache
   */
  async trainSchema(
    connectionId: string,
    userId: string,
    force: boolean = false
  ): Promise<ConnectionSchemaCache> {
    // Check if user has access to this connection
    const connection = await this.connectionService.getConnectionById(connectionId, userId);
    if (!connection) {
      throw new Error('Connection not found or access denied');
    }

    // Check if training is already in progress
    const existingCache = await this.getSchemaCache(connectionId);
    if (existingCache && existingCache.training_status === 'training' && !force) {
      throw new Error('Schema training is already in progress');
    }

    // Check if recently trained (within last hour) and force is not set
    if (existingCache && existingCache.last_trained_at && !force) {
      const lastTrained = new Date(existingCache.last_trained_at);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (lastTrained > oneHourAgo) {
        throw new Error('Schema was recently trained. Use force=true to re-train.');
      }
    }

    // Update status to training
    await this.updateTrainingStatus(connectionId, 'training', new Date().toISOString());

    try {
      // Fetch all schema metadata
      const schemaData = await this.fetchAllSchemaMetadata(connectionId, userId);

      // Store in cache
      const cache = await this.saveSchemaCache(connectionId, schemaData, 'completed');

      return cache;
    } catch (error) {
      // Update status to failed with error message
      await this.updateTrainingStatus(
        connectionId,
        'failed',
        undefined,
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
      throw error;
    }
  }

  /**
   * Train schema with granular options
   * Allows selective training of schemas, tables, and metadata types
   */
  async trainSchemaWithOptions(
    connectionId: string,
    userId: string,
    force: boolean = false,
    options?: {
      schemas?: string[];
      tables?: Array<{ schema: string; table: string }>;
      includeColumns?: boolean;
      includeTypes?: boolean;
      includeConstraints?: boolean;
      includeIndexes?: boolean;
      includeForeignKeys?: boolean;
    },
    progressCallback?: (progress: number) => Promise<void>
  ): Promise<{ schemaData: CachedSchemaData; cache: ConnectionSchemaCache }> {
    // Check if user has access to this connection
    const connection = await this.connectionService.getConnectionById(connectionId, userId);
    if (!connection) {
      throw new Error('Connection not found or access denied');
    }

    // Check if training is already in progress
    const existingCache = await this.getSchemaCache(connectionId);
    if (existingCache && existingCache.training_status === 'training' && !force) {
      throw new Error('Schema training is already in progress');
    }

    // Update status to training
    await this.updateTrainingStatus(connectionId, 'training', new Date().toISOString());
    await progressCallback?.(10);

    try {
      // Fetch schema metadata with options
      const schemaData = await this.fetchSchemaMetadataWithOptions(
        connectionId,
        userId,
        options,
        progressCallback
      );

      await progressCallback?.(90);

      // Store in cache
      const cache = await this.saveSchemaCache(connectionId, schemaData, 'completed');

      await progressCallback?.(100);

      return { schemaData, cache };
    } catch (error) {
      // Update status to failed with error message
      await this.updateTrainingStatus(
        connectionId,
        'failed',
        undefined,
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
      throw error;
    }
  }

  /**
   * Fetch schema metadata with granular options
   */
  private async fetchSchemaMetadataWithOptions(
    connectionId: string,
    userId: string,
    options?: {
      schemas?: string[];
      tables?: Array<{ schema: string; table: string }>;
      includeColumns?: boolean;
      includeTypes?: boolean;
      includeConstraints?: boolean;
      includeIndexes?: boolean;
      includeForeignKeys?: boolean;
    },
    progressCallback?: (progress: number) => Promise<void>
  ): Promise<CachedSchemaData> {
    // Get connection config
    const connectionResponse = await this.connectionService.getConnectionByIdInternal(connectionId, userId);
    if (!connectionResponse.success || !connectionResponse.data) {
      throw new Error('Connection not found');
    }
    const connection = connectionResponse.data;

    // Default: include everything if not specified
    const includeColumns = options?.includeColumns ?? true;
    const includeIndexes = options?.includeIndexes ?? true;
    const includeForeignKeys = options?.includeForeignKeys ?? true;

    const schemas: SchemaMetadata[] = [];
    let totalTables = 0;
    let totalColumns = 0;

    // Get all schemas/databases
    const schemasResponse = await this.explorerService.getSchemas(connectionId, userId);
    if (!schemasResponse.success || !schemasResponse.data) {
      throw new Error(schemasResponse.error || 'Failed to fetch schemas');
    }
    let schemaList = schemasResponse.data.map(s => s.name);

    // Filter by selected schemas if specified
    if (options?.schemas && options.schemas.length > 0) {
      schemaList = schemaList.filter(s => options.schemas!.includes(s));
    }

    const totalSchemas = schemaList.length;
    let processedSchemas = 0;

    // For each schema, get tables and their metadata
    for (const schemaName of schemaList) {
      const tables: TableMetadata[] = [];

      // Get tables in this schema
      const tablesResponse = await this.explorerService.getTables(connectionId, userId, schemaName);
      if (!tablesResponse.success || !tablesResponse.data) {
        processedSchemas++;
        continue;
      }
      let tableList = tablesResponse.data.map(t => t.name);

      // Filter by selected tables if specified
      if (options?.tables && options.tables.length > 0) {
        const selectedTablesInSchema = options.tables
          .filter(t => t.schema === schemaName)
          .map(t => t.table);
        if (selectedTablesInSchema.length > 0) {
          tableList = tableList.filter(t => selectedTablesInSchema.includes(t));
        }
      }

      const totalTables = tableList.length;
      let processedTables = 0;

      for (const tableName of tableList) {
        try {
          const tableMetadata: TableMetadata = {
            name: tableName,
            schema: schemaName,
            columns: [],
            indexes: [],
            foreign_keys: []
          };

          // Get table columns (if enabled)
          if (includeColumns) {
            tableMetadata.columns = await this.fetchTableColumns(
              connection,
              schemaName,
              tableName,
              connectionId,
              userId
            );
            totalColumns += tableMetadata.columns.length;
          }

          // Get table indexes (if enabled)
          if (includeIndexes) {
            tableMetadata.indexes = await this.fetchTableIndexes(
              connection,
              schemaName,
              tableName,
              connectionId,
              userId
            );
          }

          // Get foreign keys (if enabled)
          if (includeForeignKeys) {
            tableMetadata.foreign_keys = await this.fetchTableForeignKeys(
              connection,
              schemaName,
              tableName,
              connectionId,
              userId
            );
          }

          // Get approximate row count (optional)
          try {
            const rowCount = await this.fetchTableRowCount(
              connection,
              schemaName,
              tableName,
              connectionId,
              userId
            );
            if (rowCount !== undefined) {
              tableMetadata.row_count = rowCount;
            }
          } catch (error) {
            // Row count is optional, continue if it fails
          }

          tables.push(tableMetadata);
          processedTables++;

          // Report progress
          if (progressCallback) {
            const schemaProgress = (processedSchemas / totalSchemas) * 100;
            const tableProgress = (processedTables / totalTables) * (100 / totalSchemas);
            await progressCallback(Math.min(10 + schemaProgress + tableProgress, 90));
          }
        } catch (error) {
          // Continue with other tables even if one fails
          console.error(`Error fetching metadata for table ${schemaName}.${tableName}:`, error);
        }
      }

      totalTables += tables.length;
      schemas.push({
        name: schemaName,
        tables
      });

      processedSchemas++;
    }

    const version = await this.fetchDatabaseVersion(connectionId, userId);
    const dbType = (connection as any).dbType || connection.db_type;
    const schemaData: CachedSchemaData = {
      schemas,
      total_tables: totalTables,
      total_columns: totalColumns,
      database_type: dbType
    };

    if (version !== undefined) {
      schemaData.version = version;
    }

    return schemaData;
  }

  /**
   * Fetch all schema metadata for a connection
   */
  private async fetchAllSchemaMetadata(
    connectionId: string,
    userId: string
  ): Promise<CachedSchemaData> {
    // Get connection config
    const connectionResponse = await this.connectionService.getConnectionByIdInternal(connectionId, userId);
    if (!connectionResponse.success || !connectionResponse.data) {
      throw new Error('Connection not found');
    }
    const connection = connectionResponse.data;

    const schemas: SchemaMetadata[] = [];
    let totalTables = 0;
    let totalColumns = 0;

    // Get all schemas/databases
    const schemasResponse = await this.explorerService.getSchemas(connectionId, userId);
    if (!schemasResponse.success || !schemasResponse.data) {
      throw new Error(schemasResponse.error || 'Failed to fetch schemas');
    }
    const schemaList = schemasResponse.data.map(s => s.name);

    // For each schema, get all tables and their metadata
    for (const schemaName of schemaList) {
      const tables: TableMetadata[] = [];

      // Get tables in this schema
      const tablesResponse = await this.explorerService.getTables(connectionId, userId, schemaName);
      if (!tablesResponse.success || !tablesResponse.data) {
        continue;
      }
      const tableList = tablesResponse.data.map(t => t.name);

      for (const tableName of tableList) {
        try {
          // Get table columns
          const columns = await this.fetchTableColumns(connection, schemaName, tableName, connectionId, userId);

          // Get table indexes
          const indexes = await this.fetchTableIndexes(connection, schemaName, tableName, connectionId, userId);

          // Get foreign keys
          const foreignKeys = await this.fetchTableForeignKeys(connection, schemaName, tableName, connectionId, userId);

          // Get approximate row count (optional, can be slow for large tables)
          let rowCount: number | undefined;
          try {
            rowCount = await this.fetchTableRowCount(connection, schemaName, tableName, connectionId, userId);
          } catch (error) {
            // Row count is optional, continue if it fails
          }

          const tableMetadata: TableMetadata = {
            name: tableName,
            schema: schemaName,
            columns,
            indexes,
            foreign_keys: foreignKeys
          };

          if (rowCount !== undefined) {
            tableMetadata.row_count = rowCount;
          }

          tables.push(tableMetadata);
          totalColumns += columns.length;
        } catch (error) {
          // Continue with other tables even if one fails
        }
      }

      totalTables += tables.length;
      schemas.push({
        name: schemaName,
        tables
      });
    }

    const version = await this.fetchDatabaseVersion(connectionId, userId);
    const dbType = (connection as any).dbType || connection.db_type;
    const schemaData: CachedSchemaData = {
      schemas,
      total_tables: totalTables,
      total_columns: totalColumns,
      database_type: dbType
    };

    if (version !== undefined) {
      schemaData.version = version;
    }

    return schemaData;
  }

  /**
   * Fetch column metadata for a table
   */
  private async fetchTableColumns(
    connection: any,
    schema: string,
    table: string,
    connectionId: string,
    userId: string
  ): Promise<ColumnMetadata[]> {
    let query: string;
    const dbType = (connection as any).dbType || connection.db_type;
    const fullTableName = dbType === 'sqlite' ? table : `${schema}.${table}`;

    switch (dbType) {
      case 'mysql':
        query = `
          SELECT
            COLUMN_NAME as name,
            COLUMN_TYPE as type,
            IS_NULLABLE = 'YES' as nullable,
            COLUMN_DEFAULT as default_value,
            COLUMN_KEY = 'PRI' as is_primary_key,
            COLUMN_KEY = 'MUL' as is_foreign_key,
            EXTRA as extra
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = '${schema}' AND TABLE_NAME = '${table}'
          ORDER BY ORDINAL_POSITION
        `;
        break;

      case 'postgresql':
      case 'supabase':
        query = `
          SELECT
            column_name as name,
            data_type as type,
            is_nullable = 'YES' as nullable,
            column_default as default_value,
            (SELECT COUNT(*) > 0
             FROM information_schema.table_constraints tc
             JOIN information_schema.key_column_usage kcu
               ON tc.constraint_name = kcu.constraint_name
             WHERE tc.constraint_type = 'PRIMARY KEY'
               AND kcu.table_schema = '${schema}'
               AND kcu.table_name = '${table}'
               AND kcu.column_name = c.column_name) as is_primary_key,
            (SELECT COUNT(*) > 0
             FROM information_schema.table_constraints tc
             JOIN information_schema.key_column_usage kcu
               ON tc.constraint_name = kcu.constraint_name
             WHERE tc.constraint_type = 'FOREIGN KEY'
               AND kcu.table_schema = '${schema}'
               AND kcu.table_name = '${table}'
               AND kcu.column_name = c.column_name) as is_foreign_key,
            '' as extra
          FROM information_schema.columns c
          WHERE table_schema = '${schema}' AND table_name = '${table}'
          ORDER BY ordinal_position
        `;
        break;

      case 'sqlite':
        query = `PRAGMA table_info(${table})`;
        break;

      default:
        throw new Error(`Unsupported database type: ${dbType}`);
    }

    // For MySQL, don't include database in connection when querying INFORMATION_SCHEMA
    const includeDatabase = dbType !== 'mysql';
    const results = await this.explorerService.executeQuery(connectionId, query, userId, includeDatabase);

    // Transform SQLite results to match our format
    if (dbType === 'sqlite') {
      return results.map((row: any) => ({
        name: row.name,
        type: row.type,
        nullable: row.notnull === 0,
        default_value: row.dflt_value,
        is_primary_key: row.pk === 1,
        is_foreign_key: false, // Will be determined from foreign key query
        extra: ''
      }));
    }

    return results.map((row: any) => ({
      name: row.name,
      type: row.type,
      nullable: row.nullable,
      default_value: row.default_value,
      is_primary_key: row.is_primary_key,
      is_foreign_key: row.is_foreign_key,
      extra: row.extra || ''
    }));
  }

  /**
   * Fetch index metadata for a table
   */
  private async fetchTableIndexes(
    connection: any,
    schema: string,
    table: string,
    connectionId: string,
    userId: string
  ): Promise<IndexMetadata[]> {
    const dbType = (connection as any).dbType || connection.db_type;
    let query: string;

    switch (dbType) {
      case 'mysql':
        query = `SHOW INDEX FROM \`${schema}\`.\`${table}\``;
        break;

      case 'postgresql':
      case 'supabase':
        query = `
          SELECT
            i.relname as index_name,
            a.attname as column_name,
            ix.indisunique as is_unique,
            am.amname as index_type
          FROM pg_class t
          JOIN pg_index ix ON t.oid = ix.indrelid
          JOIN pg_class i ON i.oid = ix.indexrelid
          JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
          JOIN pg_namespace n ON n.oid = t.relnamespace
          JOIN pg_am am ON i.relam = am.oid
          WHERE n.nspname = '${schema}' AND t.relname = '${table}'
        `;
        break;

      case 'sqlite':
        query = `PRAGMA index_list(${table})`;
        break;

      default:
        return [];
    }

    try {
      // For MySQL, don't include database in connection when querying INFORMATION_SCHEMA
      const includeDatabase = dbType !== 'mysql';
      const results = await this.explorerService.executeQuery(connectionId, query, userId, includeDatabase);

      if (dbType === 'mysql') {
        return results.map((row: any) => ({
          name: row.Key_name,
          column_name: row.Column_name,
          is_unique: row.Non_unique === 0,
          index_type: row.Index_type
        }));
      } else if (dbType === 'postgresql' || dbType === 'supabase') {
        return results.map((row: any) => ({
          name: row.index_name,
          column_name: row.column_name,
          is_unique: row.is_unique,
          index_type: row.index_type
        }));
      } else if (dbType === 'sqlite') {
        return results.map((row: any) => ({
          name: row.name,
          column_name: '', // SQLite needs additional query for column info
          is_unique: row.unique === 1,
          index_type: ''
        }));
      }

      return [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Fetch foreign key metadata for a table
   */
  private async fetchTableForeignKeys(
    connection: any,
    schema: string,
    table: string,
    connectionId: string,
    userId: string
  ): Promise<ForeignKeyMetadata[]> {
    const dbType = (connection as any).dbType || connection.db_type;
    let query: string;

    switch (dbType) {
      case 'mysql':
        query = `
          SELECT
            kcu.COLUMN_NAME as column_name,
            kcu.REFERENCED_TABLE_NAME as referenced_table,
            kcu.REFERENCED_COLUMN_NAME as referenced_column,
            kcu.CONSTRAINT_NAME as constraint_name,
            rc.UPDATE_RULE as update_rule,
            rc.DELETE_RULE as delete_rule
          FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
          LEFT JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
            ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
            AND kcu.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
          WHERE kcu.TABLE_SCHEMA = '${schema}'
            AND kcu.TABLE_NAME = '${table}'
            AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
        `;
        break;

      case 'postgresql':
      case 'supabase':
        query = `
          SELECT
            kcu.column_name,
            ccu.table_name AS referenced_table,
            ccu.column_name AS referenced_column,
            tc.constraint_name,
            rc.update_rule,
            rc.delete_rule
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
          JOIN information_schema.referential_constraints rc
            ON tc.constraint_name = rc.constraint_name
            AND tc.table_schema = rc.constraint_schema
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = '${schema}'
            AND tc.table_name = '${table}'
        `;
        break;

      case 'sqlite':
        query = `PRAGMA foreign_key_list(${table})`;
        break;

      default:
        return [];
    }

    try {
      // For MySQL, don't include database in connection when querying INFORMATION_SCHEMA
      const includeDatabase = dbType !== 'mysql';
      const results = await this.explorerService.executeQuery(connectionId, query, userId, includeDatabase);

      if (dbType === 'sqlite') {
        return results.map((row: any) => ({
          column_name: row.from,
          referenced_table: row.table,
          referenced_column: row.to,
          constraint_name: `fk_${table}_${row.id}`,
          update_rule: row.on_update,
          delete_rule: row.on_delete
        }));
      }

      return results.map((row: any) => ({
        column_name: row.column_name,
        referenced_table: row.referenced_table,
        referenced_column: row.referenced_column,
        constraint_name: row.constraint_name,
        update_rule: row.update_rule,
        delete_rule: row.delete_rule
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Fetch approximate row count for a table
   */
  private async fetchTableRowCount(
    connection: any,
    schema: string,
    table: string,
    connectionId: string,
    userId: string
  ): Promise<number | undefined> {
    const dbType = (connection as any).dbType || connection.db_type;
    let query: string;

    switch (dbType) {
      case 'mysql':
        query = `
          SELECT TABLE_ROWS as count
          FROM INFORMATION_SCHEMA.TABLES
          WHERE TABLE_SCHEMA = '${schema}' AND TABLE_NAME = '${table}'
        `;
        break;

      case 'postgresql':
      case 'supabase':
        query = `
          SELECT reltuples::bigint as count
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = '${schema}' AND c.relname = '${table}'
        `;
        break;

      case 'sqlite':
        // For SQLite, we need to do an actual count which can be slow
        query = `SELECT COUNT(*) as count FROM ${table}`;
        break;

      default:
        return undefined;
    }

    try {
      // For MySQL, don't include database in connection when querying INFORMATION_SCHEMA
      const includeDatabase = dbType !== 'mysql';
      const results = await this.explorerService.executeQuery(connectionId, query, userId, includeDatabase);
      return results[0]?.count || 0;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Fetch database version
   */
  private async fetchDatabaseVersion(
    connectionId: string,
    userId: string
  ): Promise<string | undefined> {
    const connectionResponse = await this.connectionService.getConnectionByIdInternal(connectionId, userId);
    if (!connectionResponse.success || !connectionResponse.data) {
      return undefined;
    }
    const connection = connectionResponse.data;
    const dbType = (connection as any).dbType || connection.db_type;

    let query: string;

    switch (dbType) {
      case 'mysql':
        query = 'SELECT VERSION() as version';
        break;

      case 'postgresql':
      case 'supabase':
        query = 'SELECT version() as version';
        break;

      case 'sqlite':
        query = 'SELECT sqlite_version() as version';
        break;

      default:
        return undefined;
    }

    try {
      // For MySQL, don't include database in connection
      const includeDatabase = dbType !== 'mysql';
      const results = await this.explorerService.executeQuery(connectionId, query, userId, includeDatabase);
      return results[0]?.version;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Get schema cache for a connection
   */
  async getSchemaCache(connectionId: string): Promise<ConnectionSchemaCache | null> {
    const { data, error } = await supabaseAdmin
      .from('connection_schema_cache')
      .select('*')
      .eq('connection_id', connectionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // Not found
        return null;
      }
      throw error;
    }

    return DataMapper.toCamelCase(data) as ConnectionSchemaCache;
  }

  /**
   * Update training status
   */
  private async updateTrainingStatus(
    connectionId: string,
    status: 'pending' | 'training' | 'completed' | 'failed',
    trainingStartedAt?: string,
    errorMessage?: string
  ): Promise<void> {
    const updateData: any = {
      training_status: status
    };

    if (trainingStartedAt) {
      updateData.training_started_at = trainingStartedAt;
    }

    if (status === 'completed') {
      updateData.last_trained_at = new Date().toISOString();
      updateData.error_message = null;
    }

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    // Check if cache exists
    const existing = await this.getSchemaCache(connectionId);

    if (existing) {
      // Update existing
      const { error } = await supabaseAdmin
        .from('connection_schema_cache')
        .update(DataMapper.toSnakeCase(updateData))
        .eq('connection_id', connectionId);

      if (error) throw error;
    } else {
      // Create new
      const { error } = await supabaseAdmin
        .from('connection_schema_cache')
        .insert(DataMapper.toSnakeCase({
          connection_id: connectionId,
          schema_data: { schemas: [], total_tables: 0, total_columns: 0, database_type: 'mysql' },
          ...updateData
        }));

      if (error) throw error;
    }
  }

  /**
   * Save schema cache
   */
  private async saveSchemaCache(
    connectionId: string,
    schemaData: CachedSchemaData,
    status: 'completed' | 'failed'
  ): Promise<ConnectionSchemaCache> {
    const cacheData = {
      connection_id: connectionId,
      schema_data: schemaData,
      training_status: status,
      last_trained_at: new Date().toISOString(),
      error_message: null
    };

    // Check if cache exists
    const existing = await this.getSchemaCache(connectionId);

    let result;
    if (existing) {
      // Update existing
      const { data, error } = await supabaseAdmin
        .from('connection_schema_cache')
        .update(DataMapper.toSnakeCase(cacheData))
        .eq('connection_id', connectionId)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Create new
      const { data, error } = await supabaseAdmin
        .from('connection_schema_cache')
        .insert(DataMapper.toSnakeCase(cacheData))
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return DataMapper.toCamelCase(result) as ConnectionSchemaCache;
  }

  /**
   * Get all connections that need re-training (older than 7 days)
   */
  async getConnectionsNeedingTraining(): Promise<string[]> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Get all active connections
    const { data: connections, error: connError } = await supabaseAdmin
      .from('database_connections')
      .select('id')
      .eq('is_active', true);

    if (connError) throw connError;

    const connectionIds = connections?.map(c => c.id) || [];
    if (connectionIds.length === 0) return [];

    // Get caches that are older than 7 days or don't exist
    const { data: caches, error: cacheError } = await supabaseAdmin
      .from('connection_schema_cache')
      .select('connection_id, last_trained_at')
      .in('connection_id', connectionIds)
      .or(`last_trained_at.is.null,last_trained_at.lt.${sevenDaysAgo}`);

    if (cacheError) throw cacheError;

    const cachedConnectionIds = caches?.map(c => c.connection_id) || [];

    // Connections that have no cache or old cache
    const needTraining = connectionIds.filter(
      id => !cachedConnectionIds.includes(id) ||
            caches?.some(c => c.connection_id === id &&
                             (!c.last_trained_at || c.last_trained_at < sevenDaysAgo))
    );

    return needTraining;
  }

  /**
   * Delete schema cache for a connection
   */
  async deleteSchemaCache(connectionId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('connection_schema_cache')
      .delete()
      .eq('connection_id', connectionId);

    if (error) throw error;
  }
}
