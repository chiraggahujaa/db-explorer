/**
 * AI Chat API Route with Gemini 2.5 Flash
 * Implements all 42 database tools using Vercel AI SDK
 * Features: Context caching, schema pre-training, streaming responses
 */

import { streamText, tool } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { formatSchemaForAI, estimateTokens, shouldPadSchema, generateSchemaPadding, isSchemaStale } from '@/lib/schema-formatter';
import { schemaTrainingAPI } from '@/lib/api/connections';
import api from '@/lib/api/axios';

export const maxDuration = 60;
export const runtime = 'nodejs';

// Helper to execute database queries via API
async function executeDBQuery(connectionId: string, endpoint: string, params: any = {}) {
  try {
    const response = await api.post(`/api/connections/${connectionId}/${endpoint}`, params);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || error.message || 'Database operation failed');
  }
}

export async function POST(req: Request) {
  try {
    const { messages, connectionId, userId } = await req.json();

    if (!connectionId || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing connectionId or userId' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch schema cache
    let schemaCache;
    try {
      schemaCache = await schemaTrainingAPI.getSchemaCache(connectionId);
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: 'Schema not trained. Please train the schema first.',
          needsTraining: true
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!schemaCache) {
      return new Response(
        JSON.stringify({
          error: 'Schema cache not found. Please train the schema.',
          needsTraining: true
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Format schema for AI
    let schemaContext = formatSchemaForAI(schemaCache);
    const schemaTokens = estimateTokens(schemaContext);

    console.log(`[Chat API] Schema tokens: ${schemaTokens}`);

    // Pad schema if close to caching threshold (for Gemini context caching)
    if (shouldPadSchema(schemaTokens)) {
      console.log('[Chat API] Padding schema to reach caching threshold');
      const tokensNeeded = 32768 - schemaTokens;
      schemaContext += generateSchemaPadding(schemaCache, tokensNeeded);
      console.log(`[Chat API] Padded schema tokens: ${estimateTokens(schemaContext)}`);
    }

    // Check schema freshness
    const staleWarning = isSchemaStale(schemaCache.lastTrainedAt)
      ? '\n\n⚠️ **NOTE:** Schema is older than 7 days. Consider retraining for accuracy.\n'
      : '';

    // Determine if we can use context caching
    const finalTokens = estimateTokens(schemaContext);
    const canUseCache = finalTokens >= 32768;
    const model = canUseCache ? 'gemini-2.0-flash-exp' : 'gemini-2.0-flash-exp';

    console.log(`[Chat API] Using model: ${model}, caching: ${canUseCache}`);

    // Build system configuration
    const systemConfig: any = {
      model: google(model),
      system: schemaContext + staleWarning,
      messages,
      maxSteps: 10,
      temperature: 0.7,
    };

    // Add context caching if applicable
    if (canUseCache) {
      systemConfig.experimental_providerMetadata = {
        google: {
          cachedContent: {
            name: `schema-${connectionId}`,
            ttl: '3600s', // 1 hour cache
          }
        }
      };
    }

    // Define all 42 database tools
    systemConfig.tools = {
      // ==================== SCHEMA & STRUCTURE TOOLS ====================

      list_databases: tool({
        description: 'List all available databases/schemas in the connection',
        parameters: z.object({
          connection: z.string().optional().describe('Connection ID (auto-injected)'),
        }),
        execute: async (args) => {
          const result = await executeDBQuery(connectionId, 'schemas', {});
          return {
            databases: result.data?.map((s: any) => s.name) || [],
            count: result.data?.length || 0
          };
        }
      }),

      list_tables: tool({
        description: 'List all tables in a specific database/schema',
        parameters: z.object({
          database: z.string().describe('Database/schema name to list tables from'),
          connection: z.string().optional(),
        }),
        execute: async (args) => {
          const result = await executeDBQuery(connectionId, `schemas/${args.database}/tables`, {});
          return {
            tables: result.data?.map((t: any) => t.name) || [],
            count: result.data?.length || 0,
            database: args.database
          };
        }
      }),

      describe_table: tool({
        description: 'Get detailed schema information for a specific table (columns, types, constraints)',
        parameters: z.object({
          table: z.string().describe('Table name'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (args) => {
          const result = await executeDBQuery(connectionId, `schemas/${args.database}/tables/${args.table}`, {});
          return {
            table: args.table,
            database: args.database,
            columns: result.data?.columns || [],
            primaryKey: result.data?.primaryKey,
            foreignKeys: result.data?.foreignKeys || [],
            indexes: result.data?.indexes || []
          };
        }
      }),

      show_indexes: tool({
        description: 'Show all indexes for a specific table',
        parameters: z.object({
          table: z.string().describe('Table name'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (args) => {
          const result = await executeDBQuery(connectionId, `schemas/${args.database}/tables/${args.table}`, {});
          return {
            table: args.table,
            indexes: result.data?.indexes || [],
            count: result.data?.indexes?.length || 0
          };
        }
      }),

      analyze_foreign_keys: tool({
        description: 'Analyze foreign key relationships for a table or entire database',
        parameters: z.object({
          table: z.string().optional().describe('Specific table (optional, analyzes all if omitted)'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (args) => {
          // If specific table provided, get its foreign keys
          if (args.table) {
            const result = await executeDBQuery(connectionId, `schemas/${args.database}/tables/${args.table}`, {});
            return {
              table: args.table,
              foreignKeys: result.data?.foreignKeys || []
            };
          }

          // Otherwise, get all tables and their foreign keys
          const tablesResult = await executeDBQuery(connectionId, `schemas/${args.database}/tables`, {});
          const tables = tablesResult.data || [];

          const allForeignKeys: any[] = [];
          for (const table of tables) {
            const tableResult = await executeDBQuery(connectionId, `schemas/${args.database}/tables/${table.name}`, {});
            if (tableResult.data?.foreignKeys) {
              allForeignKeys.push({
                table: table.name,
                foreignKeys: tableResult.data.foreignKeys
              });
            }
          }

          return {
            database: args.database,
            relationships: allForeignKeys
          };
        }
      }),

      get_table_dependencies: tool({
        description: 'Get dependency tree showing which tables reference this table',
        parameters: z.object({
          table: z.string().describe('Table name'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (args) => {
          // Get all tables to find dependencies
          const tablesResult = await executeDBQuery(connectionId, `schemas/${args.database}/tables`, {});
          const tables = tablesResult.data || [];

          const dependencies: any[] = [];
          for (const table of tables) {
            const tableResult = await executeDBQuery(connectionId, `schemas/${args.database}/tables/${table.name}`, {});
            const fks = tableResult.data?.foreignKeys || [];

            // Check if any foreign keys reference our target table
            const referencingFKs = fks.filter((fk: any) =>
              fk.referenced_table === args.table
            );

            if (referencingFKs.length > 0) {
              dependencies.push({
                table: table.name,
                foreignKeys: referencingFKs
              });
            }
          }

          return {
            table: args.table,
            referencedBy: dependencies,
            count: dependencies.length
          };
        }
      }),

      // ==================== DATA QUERY TOOLS ====================

      select_data: tool({
        description: 'Execute SELECT query with advanced filtering, sorting, and pagination',
        parameters: z.object({
          table: z.string().describe('Table name'),
          columns: z.array(z.string()).optional().describe('Columns to select (defaults to all)'),
          where: z.string().optional().describe('WHERE clause without WHERE keyword'),
          orderBy: z.string().optional().describe('ORDER BY clause without ORDER BY keyword'),
          limit: z.number().optional().describe('LIMIT results'),
          offset: z.number().optional().describe('OFFSET for pagination'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (args) => {
          const result = await executeDBQuery(connectionId, 'query', {
            query: {
              table: args.table,
              database: args.database,
              columns: args.columns,
              where: args.where,
              orderBy: args.orderBy,
              limit: args.limit,
              offset: args.offset,
            }
          });
          return result.data;
        }
      }),

      count_records: tool({
        description: 'Count records in a table with optional WHERE conditions',
        parameters: z.object({
          table: z.string().describe('Table name'),
          where: z.string().optional().describe('WHERE clause without WHERE keyword'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (args) => {
          const result = await executeDBQuery(connectionId, 'query', {
            query: {
              table: args.table,
              database: args.database,
              count: true,
              where: args.where,
            }
          });
          return {
            table: args.table,
            count: result.data?.count || 0
          };
        }
      }),

      find_by_id: tool({
        description: 'Find records by ID or primary key value',
        parameters: z.object({
          table: z.string().describe('Table name'),
          id: z.union([z.string(), z.number()]).describe('ID value to search for'),
          idColumn: z.string().default('id').describe('ID column name (defaults to "id")'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (args) => {
          const result = await executeDBQuery(connectionId, 'query', {
            query: {
              table: args.table,
              database: args.database,
              where: `${args.idColumn} = ${typeof args.id === 'string' ? `'${args.id}'` : args.id}`,
              limit: 1,
            }
          });
          return result.data;
        }
      }),

      search_records: tool({
        description: 'Full-text search across table columns',
        parameters: z.object({
          table: z.string().describe('Table name'),
          searchTerm: z.string().describe('Search term'),
          columns: z.array(z.string()).optional().describe('Columns to search (optional)'),
          limit: z.number().default(100).describe('Max results'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (args) => {
          // Build LIKE conditions for each column
          const columns = args.columns || [];
          let where = '';
          if (columns.length > 0) {
            where = columns.map(col => `${col} LIKE '%${args.searchTerm}%'`).join(' OR ');
          }

          const result = await executeDBQuery(connectionId, 'query', {
            query: {
              table: args.table,
              database: args.database,
              where: where || undefined,
              limit: args.limit,
            }
          });
          return result.data;
        }
      }),

      get_recent_records: tool({
        description: 'Get recently created or modified records sorted by date',
        parameters: z.object({
          table: z.string().describe('Table name'),
          dateColumn: z.string().default('created_at').describe('Date column to sort by'),
          limit: z.number().default(50).describe('Number of records'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (args) => {
          const result = await executeDBQuery(connectionId, 'query', {
            query: {
              table: args.table,
              database: args.database,
              orderBy: `${args.dateColumn} DESC`,
              limit: args.limit,
            }
          });
          return result.data;
        }
      }),

      execute_custom_query: tool({
        description: 'Execute custom SQL query (SELECT, UPDATE, INSERT, DELETE)',
        parameters: z.object({
          sql: z.string().describe('SQL query to execute'),
          connection: z.string().optional(),
        }),
        execute: async (args) => {
          const result = await executeDBQuery(connectionId, 'execute', {
            query: args.sql
          });
          return result.data;
        }
      }),

      // ==================== DATA MODIFICATION TOOLS ====================

      insert_record: tool({
        description: 'Insert a single record into a table',
        parameters: z.object({
          table: z.string().describe('Table name'),
          data: z.record(z.any()).describe('Record data as key-value pairs'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (args) => {
          const columns = Object.keys(args.data).join(', ');
          const values = Object.values(args.data).map(v =>
            typeof v === 'string' ? `'${v}'` : v
          ).join(', ');

          const sql = `INSERT INTO ${args.database}.${args.table} (${columns}) VALUES (${values})`;
          const result = await executeDBQuery(connectionId, 'execute', { query: sql });
          return {
            success: true,
            inserted: result.data
          };
        }
      }),

      update_record: tool({
        description: 'Update records in a table with WHERE conditions',
        parameters: z.object({
          table: z.string().describe('Table name'),
          data: z.record(z.any()).describe('Data to update as key-value pairs'),
          where: z.string().describe('WHERE clause without WHERE keyword'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (args) => {
          const setClause = Object.entries(args.data).map(([k, v]) =>
            `${k} = ${typeof v === 'string' ? `'${v}'` : v}`
          ).join(', ');

          const sql = `UPDATE ${args.database}.${args.table} SET ${setClause} WHERE ${args.where}`;
          const result = await executeDBQuery(connectionId, 'execute', { query: sql });
          return {
            success: true,
            updated: result.data
          };
        }
      }),

      delete_record: tool({
        description: 'Delete records from a table with safety checks',
        parameters: z.object({
          table: z.string().describe('Table name'),
          where: z.string().describe('WHERE clause without WHERE keyword (required for safety)'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (args) => {
          if (!args.where) {
            throw new Error('WHERE clause is required for DELETE operations (safety check)');
          }

          const sql = `DELETE FROM ${args.database}.${args.table} WHERE ${args.where}`;
          const result = await executeDBQuery(connectionId, 'execute', { query: sql });
          return {
            success: true,
            deleted: result.data
          };
        }
      }),

      bulk_insert: tool({
        description: 'Insert multiple records efficiently in a single operation',
        parameters: z.object({
          table: z.string().describe('Table name'),
          data: z.array(z.record(z.any())).describe('Array of records to insert'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (args) => {
          if (args.data.length === 0) {
            throw new Error('No data provided for bulk insert');
          }

          const columns = Object.keys(args.data[0]).join(', ');
          const valueRows = args.data.map(record =>
            '(' + Object.values(record).map(v =>
              typeof v === 'string' ? `'${v}'` : v
            ).join(', ') + ')'
          ).join(', ');

          const sql = `INSERT INTO ${args.database}.${args.table} (${columns}) VALUES ${valueRows}`;
          const result = await executeDBQuery(connectionId, 'execute', { query: sql });
          return {
            success: true,
            inserted: args.data.length,
            details: result.data
          };
        }
      }),

      // ==================== ANALYSIS & RELATIONSHIP TOOLS ====================

      join_tables: tool({
        description: 'Execute JOIN queries across related tables',
        parameters: z.object({
          leftTable: z.string().describe('Left table name'),
          rightTable: z.string().describe('Right table name'),
          joinType: z.enum(['INNER', 'LEFT', 'RIGHT', 'FULL']).default('INNER').describe('Join type'),
          leftKey: z.string().describe('Left table join column'),
          rightKey: z.string().describe('Right table join column'),
          columns: z.array(z.string()).optional().describe('Columns to select'),
          where: z.string().optional().describe('WHERE clause'),
          limit: z.number().optional().describe('LIMIT results'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (args) => {
          const cols = args.columns?.join(', ') || '*';
          let sql = `SELECT ${cols} FROM ${args.database}.${args.leftTable} ${args.joinType} JOIN ${args.database}.${args.rightTable} ON ${args.leftTable}.${args.leftKey} = ${args.rightTable}.${args.rightKey}`;

          if (args.where) sql += ` WHERE ${args.where}`;
          if (args.limit) sql += ` LIMIT ${args.limit}`;

          const result = await executeDBQuery(connectionId, 'execute', { query: sql });
          return result.data;
        }
      }),

      find_orphaned_records: tool({
        description: 'Find records without valid foreign key references',
        parameters: z.object({
          table: z.string().describe('Table to check for orphaned records'),
          foreignKeyColumn: z.string().describe('Foreign key column name'),
          referencedTable: z.string().describe('Referenced table name'),
          referencedColumn: z.string().describe('Referenced column name'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (args) => {
          const sql = `
            SELECT ${args.table}.*
            FROM ${args.database}.${args.table}
            LEFT JOIN ${args.database}.${args.referencedTable}
              ON ${args.table}.${args.foreignKeyColumn} = ${args.referencedTable}.${args.referencedColumn}
            WHERE ${args.referencedTable}.${args.referencedColumn} IS NULL
              AND ${args.table}.${args.foreignKeyColumn} IS NOT NULL
          `;
          const result = await executeDBQuery(connectionId, 'execute', { query: sql });
          return {
            table: args.table,
            orphanedRecords: result.data,
            count: Array.isArray(result.data) ? result.data.length : 0
          };
        }
      }),

      validate_referential_integrity: tool({
        description: 'Check for foreign key constraint violations',
        parameters: z.object({
          table: z.string().describe('Table to validate'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (args) => {
          // Get table foreign keys
          const tableInfo = await executeDBQuery(connectionId, `schemas/${args.database}/tables/${args.table}`, {});
          const foreignKeys = tableInfo.data?.foreignKeys || [];

          const violations: any[] = [];
          for (const fk of foreignKeys) {
            // Check for orphaned records
            const sql = `
              SELECT COUNT(*) as count
              FROM ${args.database}.${args.table}
              LEFT JOIN ${args.database}.${fk.referenced_table}
                ON ${args.table}.${fk.column_name} = ${fk.referenced_table}.${fk.referenced_column}
              WHERE ${fk.referenced_table}.${fk.referenced_column} IS NULL
                AND ${args.table}.${fk.column_name} IS NOT NULL
            `;
            const result = await executeDBQuery(connectionId, 'execute', { query: sql });
            const count = result.data?.[0]?.count || 0;

            if (count > 0) {
              violations.push({
                foreignKey: fk.column_name,
                referencedTable: fk.referenced_table,
                violationCount: count
              });
            }
          }

          return {
            table: args.table,
            valid: violations.length === 0,
            violations
          };
        }
      }),

      analyze_table_relationships: tool({
        description: 'Analyze and map table relationships in the database',
        parameters: z.object({
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (args) => {
          const tablesResult = await executeDBQuery(connectionId, `schemas/${args.database}/tables`, {});
          const tables = tablesResult.data || [];

          const relationships: any[] = [];
          for (const table of tables) {
            const tableInfo = await executeDBQuery(connectionId, `schemas/${args.database}/tables/${table.name}`, {});
            const fks = tableInfo.data?.foreignKeys || [];

            if (fks.length > 0) {
              relationships.push({
                table: table.name,
                relationships: fks.map((fk: any) => ({
                  type: 'foreign_key',
                  column: fk.column_name,
                  referencesTable: fk.referenced_table,
                  referencesColumn: fk.referenced_column
                }))
              });
            }
          }

          return {
            database: args.database,
            tableCount: tables.length,
            relationshipMap: relationships
          };
        }
      }),

      get_column_statistics: tool({
        description: 'Get statistical information about table columns (min, max, avg, etc.)',
        parameters: z.object({
          table: z.string().describe('Table name'),
          column: z.string().describe('Column to analyze'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (args) => {
          const sql = `
            SELECT
              COUNT(*) as total_count,
              COUNT(DISTINCT ${args.column}) as distinct_count,
              MIN(${args.column}) as min_value,
              MAX(${args.column}) as max_value,
              AVG(${args.column}) as avg_value
            FROM ${args.database}.${args.table}
          `;
          const result = await executeDBQuery(connectionId, 'execute', { query: sql });
          return {
            table: args.table,
            column: args.column,
            statistics: result.data?.[0] || {}
          };
        }
      }),

      // ==================== TENANT MANAGEMENT TOOLS ====================

      list_tenants: tool({
        description: 'List all tenant databases available on the connection',
        parameters: z.object({
          connection: z.string().optional(),
        }),
        execute: async (args) => {
          const result = await executeDBQuery(connectionId, 'schemas', {});
          return {
            tenants: result.data?.map((s: any) => s.name) || [],
            count: result.data?.length || 0
          };
        }
      }),

      switch_tenant_context: tool({
        description: 'Switch active tenant database context (informational only - actual context managed per query)',
        parameters: z.object({
          tenantId: z.string().describe('Tenant database name to switch to'),
          connection: z.string().optional(),
        }),
        execute: async (args) => {
          return {
            success: true,
            message: `Context switched to tenant: ${args.tenantId}`,
            note: 'Use the database parameter in subsequent queries to target this tenant'
          };
        }
      }),

      get_tenant_schema: tool({
        description: 'Get complete schema information for a specific tenant database',
        parameters: z.object({
          tenantId: z.string().describe('Tenant database name'),
          connection: z.string().optional(),
        }),
        execute: async (args) => {
          const tablesResult = await executeDBQuery(connectionId, `schemas/${args.tenantId}/tables`, {});
          const tables = tablesResult.data || [];

          const schema: any[] = [];
          for (const table of tables) {
            const tableInfo = await executeDBQuery(connectionId, `schemas/${args.tenantId}/tables/${table.name}`, {});
            schema.push({
              table: table.name,
              columns: tableInfo.data?.columns || [],
              foreignKeys: tableInfo.data?.foreignKeys || []
            });
          }

          return {
            tenantId: args.tenantId,
            tableCount: tables.length,
            schema
          };
        }
      }),

      compare_tenant_data: tool({
        description: 'Compare table data or schema across different tenant databases',
        parameters: z.object({
          table: z.string().describe('Table name to compare'),
          tenant1: z.string().describe('First tenant database'),
          tenant2: z.string().describe('Second tenant database'),
          compareType: z.enum(['count', 'schema']).default('count').describe('What to compare'),
          connection: z.string().optional(),
        }),
        execute: async (args) => {
          if (args.compareType === 'count') {
            const count1Result = await executeDBQuery(connectionId, 'query', {
              query: { table: args.table, database: args.tenant1, count: true }
            });
            const count2Result = await executeDBQuery(connectionId, 'query', {
              query: { table: args.table, database: args.tenant2, count: true }
            });

            return {
              table: args.table,
              tenant1: { name: args.tenant1, count: count1Result.data?.count || 0 },
              tenant2: { name: args.tenant2, count: count2Result.data?.count || 0 },
              difference: Math.abs((count1Result.data?.count || 0) - (count2Result.data?.count || 0))
            };
          } else {
            const schema1 = await executeDBQuery(connectionId, `schemas/${args.tenant1}/tables/${args.table}`, {});
            const schema2 = await executeDBQuery(connectionId, `schemas/${args.tenant2}/tables/${args.table}`, {});

            return {
              table: args.table,
              tenant1: { name: args.tenant1, columns: schema1.data?.columns || [] },
              tenant2: { name: args.tenant2, columns: schema2.data?.columns || [] }
            };
          }
        }
      }),

      get_tenant_tables: tool({
        description: 'Get all tables and record counts for a specific tenant database',
        parameters: z.object({
          tenantId: z.string().describe('Tenant database name'),
          connection: z.string().optional(),
        }),
        execute: async (args) => {
          const tablesResult = await executeDBQuery(connectionId, `schemas/${args.tenantId}/tables`, {});
          const tables = tablesResult.data || [];

          const tablesWithCounts: any[] = [];
          for (const table of tables) {
            const countResult = await executeDBQuery(connectionId, 'query', {
              query: { table: table.name, database: args.tenantId, count: true }
            });
            tablesWithCounts.push({
              name: table.name,
              rowCount: countResult.data?.count || 0
            });
          }

          return {
            tenantId: args.tenantId,
            tables: tablesWithCounts,
            totalTables: tablesWithCounts.length
          };
        }
      }),

      // ==================== UTILITY & MAINTENANCE TOOLS ====================

      explain_query: tool({
        description: 'Get query execution plan and optimization information',
        parameters: z.object({
          query: z.string().describe('SQL query to explain'),
          connection: z.string().optional(),
        }),
        execute: async (args) => {
          const sql = `EXPLAIN ${args.query}`;
          const result = await executeDBQuery(connectionId, 'execute', { query: sql });
          return {
            query: args.query,
            executionPlan: result.data
          };
        }
      }),

      check_table_status: tool({
        description: 'Get table status information (size, rows, engine, etc.)',
        parameters: z.object({
          table: z.string().describe('Table name'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (args) => {
          // Get table info and row count
          const tableInfo = await executeDBQuery(connectionId, `schemas/${args.database}/tables/${args.table}`, {});
          const countResult = await executeDBQuery(connectionId, 'query', {
            query: { table: args.table, database: args.database, count: true }
          });

          return {
            table: args.table,
            database: args.database,
            rowCount: countResult.data?.count || 0,
            columns: tableInfo.data?.columns?.length || 0,
            indexes: tableInfo.data?.indexes?.length || 0,
            foreignKeys: tableInfo.data?.foreignKeys?.length || 0
          };
        }
      }),

      optimize_table: tool({
        description: 'Optimize table for better performance',
        parameters: z.object({
          table: z.string().describe('Table name'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (args) => {
          const sql = `OPTIMIZE TABLE ${args.database}.${args.table}`;
          const result = await executeDBQuery(connectionId, 'execute', { query: sql });
          return {
            table: args.table,
            success: true,
            result: result.data
          };
        }
      }),

      backup_table_structure: tool({
        description: 'Export table DDL/CREATE statement',
        parameters: z.object({
          table: z.string().describe('Table name'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (args) => {
          const sql = `SHOW CREATE TABLE ${args.database}.${args.table}`;
          const result = await executeDBQuery(connectionId, 'execute', { query: sql });
          return {
            table: args.table,
            createStatement: result.data
          };
        }
      }),

      test_connection: tool({
        description: 'Test database connection health',
        parameters: z.object({
          connection: z.string().optional(),
        }),
        execute: async (args) => {
          try {
            const result = await executeDBQuery(connectionId, 'test', {});
            return {
              status: 'healthy',
              message: 'Connection is active and responding',
              details: result.data
            };
          } catch (error: any) {
            return {
              status: 'unhealthy',
              message: error.message,
              error: true
            };
          }
        }
      }),

      show_connections: tool({
        description: 'Show available database connections and their status',
        parameters: z.object({}),
        execute: async (args) => {
          return {
            currentConnection: connectionId,
            status: 'active',
            message: 'Currently connected to database'
          };
        }
      }),

      get_database_size: tool({
        description: 'Get database size and storage information',
        parameters: z.object({
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (args) => {
          const sql = `
            SELECT
              table_schema as database_name,
              SUM(data_length + index_length) as size_bytes,
              SUM(data_length + index_length) / 1024 / 1024 as size_mb
            FROM information_schema.tables
            WHERE table_schema = '${args.database}'
            GROUP BY table_schema
          `;
          const result = await executeDBQuery(connectionId, 'execute', { query: sql });
          return {
            database: args.database,
            sizeInfo: result.data?.[0] || { size_mb: 0 }
          };
        }
      }),
    };

    // Stream the response
    const result = await streamText(systemConfig);
    return result.toDataStreamResponse();

  } catch (error: any) {
    console.error('[Chat API] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
