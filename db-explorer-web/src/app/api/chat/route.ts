/**
 * AI Chat API Route with Gemini 2.5 Flash
 * Implements all 42 database tools using Vercel AI SDK
 * Features: Context caching, schema pre-training, streaming responses
 */

import { streamText, tool, convertToCoreMessages } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { formatSchemaForAI, formatSchemaForAIConcise, estimateTokens, isSchemaStale } from '@/lib/schema-formatter';
import api from '@/lib/api/axios';
import { getDatabaseAssistantPrompt } from '@/lib/prompts/database-assistant-prompt';

export const maxDuration = 60;
export const runtime = 'nodejs';

// Helper to execute database queries via API
async function executeDBQuery(connectionId: string, endpoint: string, params: any = {}, accessToken?: string, method: 'GET' | 'POST' = 'POST') {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add authorization header if token is provided
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const url = `/api/connections/${connectionId}/${endpoint}`;

    const response = method === 'GET'
      ? await api.get(url, { headers, params })
      : await api.post(url, params, { headers });

    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || error.message || 'Database operation failed');
  }
}

export async function POST(req: Request) {
  try {
    // Extract access token from Authorization header
    const authHeader = req.headers.get('Authorization');
    const accessToken = authHeader?.replace('Bearer ', '');

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Access token required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { messages, connectionId, userId, selectedSchema, selectedTables, chatConfig } = await req.json();

    if (!connectionId || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing connectionId or userId' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch schema cache (optional) - this provides detailed database structure
    let schemaCache;
    let schemaDataContext = '';
    let canUseCache = false;

    try {
      // server-side API call
      const schemaCacheResponse = await executeDBQuery(connectionId, 'schema-cache', {}, accessToken, 'GET');
      if (schemaCacheResponse.success && schemaCacheResponse.data) {
        schemaCache = schemaCacheResponse.data;
      }
    } catch (error) {
      console.log('[Chat API] Schema not trained, continuing without schema context');
    }

    if (schemaCache) {
      // Format schema for AI - using CONCISE version to reduce token usage by 95-99%
      schemaDataContext = formatSchemaForAIConcise(schemaCache);
      const schemaTokens = estimateTokens(schemaDataContext);

      console.log(`[Chat API] Schema data tokens: ${schemaTokens}`);

      // Add stale warning if needed
      if (isSchemaStale(schemaCache.lastTrainedAt)) {
        schemaDataContext += '\n\n⚠️ **NOTE:** Schema is older than 7 days. Consider retraining for accuracy.\n';
      }

      // Gemini 2.5 Flash supports implicit caching (75% discount on cached prefixes)
      // Minimum tokens for caching: 1,024 tokens for Flash
      const finalTokens = estimateTokens(schemaDataContext);
      canUseCache = finalTokens >= 1024;

      console.log(`[Chat API] Schema eligible for caching: ${canUseCache}`);
    } else {
      console.log('[Chat API] No schema context, AI will discover schema dynamically');
    }

    // Build comprehensive system prompt with chat config
    const systemPrompt = getDatabaseAssistantPrompt(selectedSchema, selectedTables, chatConfig);

    // If we have trained schema data, append it to the prompt
    const fullSystemPrompt = schemaDataContext
      ? `${systemPrompt}\n\n## PRE-LOADED DATABASE SCHEMA\n\n${schemaDataContext}`
      : systemPrompt;

    console.log(`[Chat API] System prompt length: ${fullSystemPrompt.length} chars, selected schema: ${selectedSchema || 'none'}`);
    console.log(`[Chat API] Using comprehensive prompt with ${schemaDataContext ? 'pre-loaded schema' : 'dynamic schema discovery'}`);


    const model = 'gemini-2.5-flash';

    console.log(`[Chat API] Using model: ${model}, caching: ${canUseCache}`);
    console.log('[Chat API] Received messages!');

    // Transform UIMessages to CoreMessages using AI SDK utility
    const coreMessages = convertToCoreMessages(messages);

    console.log('[Chat API] Transformed to core messages!');

    // Build system configuration
    // Note: Gemini 2.5 Flash automatically uses implicit caching for repeated prefixes
    // providing 75% cost reduction on cached content (min 1,024 tokens)
    const systemConfig: any = {
      model: google(model),
      system: fullSystemPrompt,
      messages: coreMessages,
      // CRITICAL: Use maxSteps to allow multi-step tool execution
      // This enables the AI to call tools AND generate text responses in the same turn
      maxSteps: 10,
      temperature: 0.7,
    };

    // TODO: Implement explicit caching using GoogleAICacheManager for better control
    // This would require storing cache IDs in the database and managing cache lifecycle

    // Define all 42 database tools
    systemConfig.tools = {
      // ==================== SCHEMA & STRUCTURE TOOLS ====================

      list_databases: tool({
        description: 'List all available databases/schemas in the connection',
        inputSchema: z.object({
          connection: z.string().optional().describe('Connection ID (auto-injected)'),
        }),
        execute: async (input, options) => {
          const result = await executeDBQuery(connectionId, 'schemas', {}, accessToken, 'GET');
          return {
            databases: result.data?.map((s: any) => s.name) || [],
            count: result.data?.length || 0
          };
        }
      }),

      list_tables: tool({
        description: 'List all tables in a specific database/schema',
        inputSchema: z.object({
          database: z.string().describe('Database/schema name to list tables from'),
          connection: z.string().optional(),
        }),
        execute: async (input, options) => {
          const result = await executeDBQuery(connectionId, 'tables', { schema: input.database }, accessToken, 'GET');
          return {
            tables: result.data?.map((t: any) => t.name) || [],
            count: result.data?.length || 0,
            database: input.database
          };
        }
      }),

      describe_table: tool({
        description: 'Get detailed schema information for a specific table (columns, types, constraints)',
        inputSchema: z.object({
          table: z.string().describe('Table name'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (input, options) => {
          const result = await executeDBQuery(connectionId, `schemas/${input.database}/tables/${input.table}`, {}, accessToken, 'GET');
          return {
            table: input.table,
            database: input.database,
            columns: result.data?.columns || [],
            primaryKey: result.data?.primaryKey,
            foreignKeys: result.data?.foreignKeys || [],
            indexes: result.data?.indexes || []
          };
        }
      }),

      show_indexes: tool({
        description: 'Show all indexes for a specific table',
        inputSchema: z.object({
          table: z.string().describe('Table name'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (input, options) => {
          const result = await executeDBQuery(connectionId, `schemas/${input.database}/tables/${input.table}`, {}, accessToken, 'GET');
          return {
            table: input.table,
            indexes: result.data?.indexes || [],
            count: result.data?.indexes?.length || 0
          };
        }
      }),

      analyze_foreign_keys: tool({
        description: 'Analyze foreign key relationships for a table or entire database',
        inputSchema: z.object({
          table: z.string().optional().describe('Specific table (optional, analyzes all if omitted)'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (input, options) => {
          // If specific table provided, get its foreign keys
          if (input.table) {
            const result = await executeDBQuery(connectionId, `schemas/${input.database}/tables/${input.table}`, {}, accessToken, 'GET');
            return {
              table: input.table,
              foreignKeys: result.data?.foreignKeys || []
            };
          }

          // Otherwise, get all tables and their foreign keys
          const tablesResult = await executeDBQuery(connectionId, 'tables', { schema: input.database }, accessToken, 'GET');
          const tables = tablesResult.data || [];

          const allForeignKeys: any[] = [];
          for (const table of tables) {
            const tableResult = await executeDBQuery(connectionId, `schemas/${input.database}/tables/${table.name}`, {}, accessToken, 'GET');
            if (tableResult.data?.foreignKeys) {
              allForeignKeys.push({
                table: table.name,
                foreignKeys: tableResult.data.foreignKeys
              });
            }
          }

          return {
            database: input.database,
            relationships: allForeignKeys
          };
        }
      }),

      get_table_dependencies: tool({
        description: 'Get dependency tree showing which tables reference this table',
        inputSchema: z.object({
          table: z.string().describe('Table name'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (input, options) => {
          // Get all tables to find dependencies
          const tablesResult = await executeDBQuery(connectionId, 'tables', { schema: input.database }, accessToken, 'GET');
          const tables = tablesResult.data || [];

          const dependencies: any[] = [];
          for (const table of tables) {
            const tableResult = await executeDBQuery(connectionId, `schemas/${input.database}/tables/${table.name}`, {}, accessToken, 'GET');
            const fks = tableResult.data?.foreignKeys || [];

            // Check if any foreign keys reference our target table
            const referencingFKs = fks.filter((fk: any) =>
              fk.referenced_table === input.table
            );

            if (referencingFKs.length > 0) {
              dependencies.push({
                table: table.name,
                foreignKeys: referencingFKs
              });
            }
          }

          return {
            table: input.table,
            referencedBy: dependencies,
            count: dependencies.length
          };
        }
      }),

      // ==================== DATA QUERY TOOLS ====================

      select_data: tool({
        description: 'Execute SELECT query with advanced filtering, sorting, and pagination',
        inputSchema: z.object({
          table: z.string().describe('Table name'),
          columns: z.array(z.string()).optional().describe('Columns to select (defaults to all)'),
          where: z.string().optional().describe('WHERE clause without WHERE keyword'),
          orderBy: z.string().optional().describe('ORDER BY clause without ORDER BY keyword'),
          limit: z.number().optional().describe('LIMIT results'),
          offset: z.number().optional().describe('OFFSET for pagination'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (input, options) => {
          // Apply row limit from chat config if not specified or exceeds config limit
          const configLimit = chatConfig?.resultRowLimit || 100;
          const effectiveLimit = input.limit
            ? Math.min(input.limit, configLimit)
            : configLimit;

          const result = await executeDBQuery(connectionId, 'query', {
            query: {
              table: input.table,
              database: input.database,
              columns: input.columns,
              where: input.where,
              orderBy: input.orderBy,
              limit: effectiveLimit,
              offset: input.offset,
            }
          }, accessToken, 'POST');
          return result.data || [];
        }
      }),

      count_records: tool({
        description: 'Count records in a table with optional WHERE conditions',
        inputSchema: z.object({
          table: z.string().describe('Table name'),
          where: z.string().optional().describe('WHERE clause without WHERE keyword'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (input, options) => {
          const result = await executeDBQuery(connectionId, 'query', {
            query: {
              table: input.table,
              database: input.database,
              count: true,
              where: input.where,
            }
          }, accessToken, 'POST');
          return {
            table: input.table,
            count: result.data?.count || 0
          };
        }
      }),

      find_by_id: tool({
        description: 'Find records by ID or primary key value',
        inputSchema: z.object({
          table: z.string().describe('Table name'),
          id: z.union([z.string(), z.number()]).describe('ID value to search for'),
          idColumn: z.string().default('id').describe('ID column name (defaults to "id")'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (input, options) => {
          const result = await executeDBQuery(connectionId, 'query', {
            query: {
              table: input.table,
              database: input.database,
              where: `${input.idColumn} = ${typeof input.id === 'string' ? `'${input.id}'` : input.id}`,
              limit: 1,
            }
          });
          return result.data;
        }
      }),

      search_records: tool({
        description: 'Full-text search across table columns',
        inputSchema: z.object({
          table: z.string().describe('Table name'),
          searchTerm: z.string().describe('Search term'),
          columns: z.array(z.string()).optional().describe('Columns to search (optional)'),
          limit: z.number().default(100).describe('Max results'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (input, options) => {
          // Build LIKE conditions for each column
          const columns = input.columns || [];
          let where = '';
          if (columns.length > 0) {
            where = columns.map(col => `${col} LIKE '%${input.searchTerm}%'`).join(' OR ');
          }

          const result = await executeDBQuery(connectionId, 'query', {
            query: {
              table: input.table,
              database: input.database,
              where: where || undefined,
              limit: input.limit,
            }
          }, accessToken);
          return result.data;
        }
      }),

      get_recent_records: tool({
        description: 'Get recently created or modified records sorted by date',
        inputSchema: z.object({
          table: z.string().describe('Table name'),
          dateColumn: z.string().default('created_at').describe('Date column to sort by'),
          limit: z.number().default(50).describe('Number of records'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (input, options) => {
          const result = await executeDBQuery(connectionId, 'query', {
            query: {
              table: input.table,
              database: input.database,
              orderBy: `${input.dateColumn} DESC`,
              limit: input.limit,
            }
          }, accessToken);
          return result.data;
        }
      }),

      execute_custom_query: tool({
        description: 'Execute custom SQL query (SELECT, UPDATE, INSERT, DELETE)',
        inputSchema: z.object({
          sql: z.string().describe('SQL query to execute'),
          schema: z.string().optional().describe('Database/schema name (optional)'),
          connection: z.string().optional(),
        }),
        execute: async (input, options) => {
          // Use provided schema or fall back to selectedSchema from chat context
          const schemaToUse = input.schema || selectedSchema;
          if (!schemaToUse) {
            throw new Error('Database/schema name is required. Please specify a schema parameter or ensure a schema is selected in the chat context.');
          }
          const result = await executeDBQuery(connectionId, 'execute', {
            query: input.sql,
            schema: schemaToUse
          }, accessToken, 'POST');
          return result.data || [];
        }
      }),

      // ==================== DATA MODIFICATION TOOLS ====================

      insert_record: tool({
        description: 'Insert a single record into a table',
        inputSchema: z.object({
          table: z.string().describe('Table name'),
          data: z.record(z.string(), z.any()).describe('Record data as key-value pairs'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (input, options) => {
          // Check read-only mode
          if (chatConfig?.readOnlyMode) {
            throw new Error('Data modification is not allowed in read-only mode. Please disable read-only mode in chat configuration to perform INSERT operations.');
          }

          const columns = Object.keys(input.data).join(', ');
          const values = Object.values(input.data).map(v =>
            typeof v === 'string' ? `'${v}'` : v
          ).join(', ');

          const sql = `INSERT INTO ${input.database}.${input.table} (${columns}) VALUES (${values})`;
          const result = await executeDBQuery(connectionId, 'execute', { query: sql }, accessToken, 'POST');
          return {
            success: true,
            inserted: result.data
          };
        }
      }),

      update_record: tool({
        description: 'Update records in a table with WHERE conditions',
        inputSchema: z.object({
          table: z.string().describe('Table name'),
          data: z.record(z.string(), z.any()).describe('Data to update as key-value pairs'),
          where: z.string().describe('WHERE clause without WHERE keyword'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (input, options) => {
          // Check read-only mode
          if (chatConfig?.readOnlyMode) {
            throw new Error('Data modification is not allowed in read-only mode. Please disable read-only mode in chat configuration to perform UPDATE operations.');
          }

          const setClause = Object.entries(input.data).map(([k, v]) =>
            `${k} = ${typeof v === 'string' ? `'${v}'` : v}`
          ).join(', ');

          const sql = `UPDATE ${input.database}.${input.table} SET ${setClause} WHERE ${input.where}`;
          const result = await executeDBQuery(connectionId, 'execute', { query: sql }, accessToken, 'POST');
          return {
            success: true,
            updated: result.data
          };
        }
      }),

      delete_record: tool({
        description: 'Delete records from a table with safety checks',
        inputSchema: z.object({
          table: z.string().describe('Table name'),
          where: z.string().describe('WHERE clause without WHERE keyword (required for safety)'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (input, options) => {
          // Check read-only mode
          if (chatConfig?.readOnlyMode) {
            throw new Error('Data modification is not allowed in read-only mode. Please disable read-only mode in chat configuration to perform DELETE operations.');
          }

          if (!input.where) {
            throw new Error('WHERE clause is required for DELETE operations (safety check)');
          }

          const sql = `DELETE FROM ${input.database}.${input.table} WHERE ${input.where}`;
          const result = await executeDBQuery(connectionId, 'execute', { query: sql }, accessToken, 'POST');
          return {
            success: true,
            deleted: result.data
          };
        }
      }),

      bulk_insert: tool({
        description: 'Insert multiple records efficiently in a single operation',
        inputSchema: z.object({
          table: z.string().describe('Table name'),
          data: z.array(z.record(z.string(), z.any())).describe('Array of records to insert'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (input, options) => {
          // Check read-only mode
          if (chatConfig?.readOnlyMode) {
            throw new Error('Data modification is not allowed in read-only mode. Please disable read-only mode in chat configuration to perform bulk INSERT operations.');
          }

          if (input.data.length === 0) {
            throw new Error('No data provided for bulk insert');
          }

          const columns = Object.keys(input.data[0]).join(', ');
          const valueRows = input.data.map(record =>
            '(' + Object.values(record).map(v =>
              typeof v === 'string' ? `'${v}'` : v
            ).join(', ') + ')'
          ).join(', ');

          const sql = `INSERT INTO ${input.database}.${input.table} (${columns}) VALUES ${valueRows}`;
          const result = await executeDBQuery(connectionId, 'execute', { query: sql }, accessToken, 'POST');
          return {
            success: true,
            inserted: input.data.length,
            details: result.data
          };
        }
      }),

      // ==================== ANALYSIS & RELATIONSHIP TOOLS ====================

      join_tables: tool({
        description: 'Execute JOIN queries across related tables',
        inputSchema: z.object({
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
        execute: async (input, options) => {
          const cols = input.columns?.join(', ') || '*';
          let sql = `SELECT ${cols} FROM ${input.database}.${input.leftTable} ${input.joinType} JOIN ${input.database}.${input.rightTable} ON ${input.leftTable}.${input.leftKey} = ${input.rightTable}.${input.rightKey}`;

          if (input.where) sql += ` WHERE ${input.where}`;
          if (input.limit) sql += ` LIMIT ${input.limit}`;

          const result = await executeDBQuery(connectionId, 'execute', { query: sql, schema: input.database }, accessToken, 'POST');
          return result.data || [];
        }
      }),

      find_orphaned_records: tool({
        description: 'Find records without valid foreign key references',
        inputSchema: z.object({
          table: z.string().describe('Table to check for orphaned records'),
          foreignKeyColumn: z.string().describe('Foreign key column name'),
          referencedTable: z.string().describe('Referenced table name'),
          referencedColumn: z.string().describe('Referenced column name'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (input, options) => {
          const sql = `
            SELECT ${input.table}.*
            FROM ${input.database}.${input.table}
            LEFT JOIN ${input.database}.${input.referencedTable}
              ON ${input.table}.${input.foreignKeyColumn} = ${input.referencedTable}.${input.referencedColumn}
            WHERE ${input.referencedTable}.${input.referencedColumn} IS NULL
              AND ${input.table}.${input.foreignKeyColumn} IS NOT NULL
          `;
          const result = await executeDBQuery(connectionId, 'execute', { query: sql, schema: input.database }, accessToken, 'POST');
          return {
            table: input.table,
            orphanedRecords: result.data || [],
            count: Array.isArray(result.data) ? result.data.length : 0
          };
        }
      }),

      validate_referential_integrity: tool({
        description: 'Check for foreign key constraint violations',
        inputSchema: z.object({
          table: z.string().describe('Table to validate'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (input, options) => {
          // Get table foreign keys
          const tableInfo = await executeDBQuery(connectionId, `schemas/${input.database}/tables/${input.table}`, {}, accessToken, 'GET');
          const foreignKeys = tableInfo.data?.foreignKeys || [];

          const violations: any[] = [];
          for (const fk of foreignKeys) {
            // Check for orphaned records
            const sql = `
              SELECT COUNT(*) as count
              FROM ${input.database}.${input.table}
              LEFT JOIN ${input.database}.${fk.referenced_table}
                ON ${input.table}.${fk.column_name} = ${fk.referenced_table}.${fk.referenced_column}
              WHERE ${fk.referenced_table}.${fk.referenced_column} IS NULL
                AND ${input.table}.${fk.column_name} IS NOT NULL
            `;
            const result = await executeDBQuery(connectionId, 'execute', { query: sql, schema: input.database }, accessToken, 'POST');
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
            table: input.table,
            valid: violations.length === 0,
            violations
          };
        }
      }),

      analyze_table_relationships: tool({
        description: 'Analyze and map table relationships in the database',
        inputSchema: z.object({
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (input, options) => {
          const tablesResult = await executeDBQuery(connectionId, 'tables', { schema: input.database }, accessToken, 'GET');
          const tables = tablesResult.data || [];

          const relationships: any[] = [];
          for (const table of tables) {
            const tableInfo = await executeDBQuery(connectionId, `schemas/${input.database}/tables/${table.name}`, {}, accessToken, 'GET');
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
            database: input.database,
            tableCount: tables.length,
            relationshipMap: relationships
          };
        }
      }),

      get_column_statistics: tool({
        description: 'Get statistical information about table columns (min, max, avg, etc.)',
        inputSchema: z.object({
          table: z.string().describe('Table name'),
          column: z.string().describe('Column to analyze'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (input, options) => {
          const sql = `
            SELECT
              COUNT(*) as total_count,
              COUNT(DISTINCT ${input.column}) as distinct_count,
              MIN(${input.column}) as min_value,
              MAX(${input.column}) as max_value,
              AVG(${input.column}) as avg_value
            FROM ${input.database}.${input.table}
          `;
          const result = await executeDBQuery(connectionId, 'execute', { query: sql, schema: input.database }, accessToken, 'POST');
          return {
            table: input.table,
            column: input.column,
            statistics: result.data?.[0] || {}
          };
        }
      }),

      // ==================== TENANT MANAGEMENT TOOLS ====================

      list_tenants: tool({
        description: 'List all tenant databases available on the connection',
        inputSchema: z.object({
          connection: z.string().optional(),
        }),
        execute: async (input, options) => {
          const result = await executeDBQuery(connectionId, 'schemas', {}, accessToken, 'GET');
          return {
            tenants: result.data?.map((s: any) => s.name) || [],
            count: result.data?.length || 0
          };
        }
      }),

      switch_tenant_context: tool({
        description: 'Switch active tenant database context (informational only - actual context managed per query)',
        inputSchema: z.object({
          tenantId: z.string().describe('Tenant database name to switch to'),
          connection: z.string().optional(),
        }),
        execute: async (input, options) => {
          return {
            success: true,
            message: `Context switched to tenant: ${input.tenantId}`,
            note: 'Use the database parameter in subsequent queries to target this tenant'
          };
        }
      }),

      get_tenant_schema: tool({
        description: 'Get complete schema information for a specific tenant database',
        inputSchema: z.object({
          tenantId: z.string().describe('Tenant database name'),
          connection: z.string().optional(),
        }),
        execute: async (input, options) => {
          const tablesResult = await executeDBQuery(connectionId, 'tables', { schema: input.tenantId }, accessToken, 'GET');
          const tables = tablesResult.data || [];

          const schema: any[] = [];
          for (const table of tables) {
            const tableInfo = await executeDBQuery(connectionId, `schemas/${input.tenantId}/tables/${table.name}`, {}, accessToken, 'GET');
            schema.push({
              table: table.name,
              columns: tableInfo.data?.columns || [],
              foreignKeys: tableInfo.data?.foreignKeys || []
            });
          }

          return {
            tenantId: input.tenantId,
            tableCount: tables.length,
            schema
          };
        }
      }),

      compare_tenant_data: tool({
        description: 'Compare table data or schema across different tenant databases',
        inputSchema: z.object({
          table: z.string().describe('Table name to compare'),
          tenant1: z.string().describe('First tenant database'),
          tenant2: z.string().describe('Second tenant database'),
          compareType: z.enum(['count', 'schema']).default('count').describe('What to compare'),
          connection: z.string().optional(),
        }),
        execute: async (input, options) => {
          if (input.compareType === 'count') {
            const count1Result = await executeDBQuery(connectionId, 'query', {
              query: { table: input.table, database: input.tenant1, count: true }
            }, accessToken, 'POST');
            const count2Result = await executeDBQuery(connectionId, 'query', {
              query: { table: input.table, database: input.tenant2, count: true }
            }, accessToken, 'POST');

            return {
              table: input.table,
              tenant1: { name: input.tenant1, count: count1Result.data?.count || 0 },
              tenant2: { name: input.tenant2, count: count2Result.data?.count || 0 },
              difference: Math.abs((count1Result.data?.count || 0) - (count2Result.data?.count || 0))
            };
          } else {
            const schema1 = await executeDBQuery(connectionId, `schemas/${input.tenant1}/tables/${input.table}`, {}, accessToken, 'GET');
            const schema2 = await executeDBQuery(connectionId, `schemas/${input.tenant2}/tables/${input.table}`, {}, accessToken, 'GET');

            return {
              table: input.table,
              tenant1: { name: input.tenant1, columns: schema1.data?.columns || [] },
              tenant2: { name: input.tenant2, columns: schema2.data?.columns || [] }
            };
          }
        }
      }),

      get_tenant_tables: tool({
        description: 'Get all tables and record counts for a specific tenant database',
        inputSchema: z.object({
          tenantId: z.string().describe('Tenant database name'),
          connection: z.string().optional(),
        }),
        execute: async (input, options) => {
          const tablesResult = await executeDBQuery(connectionId, 'tables', { schema: input.tenantId }, accessToken, 'GET');
          const tables = tablesResult.data || [];

          const tablesWithCounts: any[] = [];
          for (const table of tables) {
            const countResult = await executeDBQuery(connectionId, 'query', {
              query: { table: table.name, database: input.tenantId, count: true }
            }, accessToken, 'POST');
            tablesWithCounts.push({
              name: table.name,
              rowCount: countResult.data?.count || 0
            });
          }

          return {
            tenantId: input.tenantId,
            tables: tablesWithCounts,
            totalTables: tablesWithCounts.length
          };
        }
      }),

      // ==================== UTILITY & MAINTENANCE TOOLS ====================

      explain_query: tool({
        description: 'Get query execution plan and optimization information',
        inputSchema: z.object({
          query: z.string().describe('SQL query to explain'),
          schema: z.string().optional().describe('Database/schema name (optional)'),
          connection: z.string().optional(),
        }),
        execute: async (input, options) => {
          const sql = `EXPLAIN ${input.query}`;
          const result = await executeDBQuery(connectionId, 'execute', { query: sql, schema: input.schema }, accessToken, 'POST');
          return {
            query: input.query,
            executionPlan: result.data || []
          };
        }
      }),

      check_table_status: tool({
        description: 'Get table status information (size, rows, engine, etc.)',
        inputSchema: z.object({
          table: z.string().describe('Table name'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (input, options) => {
          // Get table info and row count
          const tableInfo = await executeDBQuery(connectionId, `schemas/${input.database}/tables/${input.table}`, {}, accessToken, 'GET');
          const countResult = await executeDBQuery(connectionId, 'query', {
            query: { table: input.table, database: input.database, count: true }
          }, accessToken, 'POST');

          return {
            table: input.table,
            database: input.database,
            rowCount: countResult.data?.count || 0,
            columns: tableInfo.data?.columns?.length || 0,
            indexes: tableInfo.data?.indexes?.length || 0,
            foreignKeys: tableInfo.data?.foreignKeys?.length || 0
          };
        }
      }),

      optimize_table: tool({
        description: 'Optimize table for better performance',
        inputSchema: z.object({
          table: z.string().describe('Table name'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (input, options) => {
          const sql = `OPTIMIZE TABLE ${input.database}.${input.table}`;
          const result = await executeDBQuery(connectionId, 'execute', { query: sql, schema: input.database }, accessToken, 'POST');
          return {
            table: input.table,
            success: true,
            result: result.data || []
          };
        }
      }),

      backup_table_structure: tool({
        description: 'Export table DDL/CREATE statement',
        inputSchema: z.object({
          table: z.string().describe('Table name'),
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (input, options) => {
          const sql = `SHOW CREATE TABLE ${input.database}.${input.table}`;
          const result = await executeDBQuery(connectionId, 'execute', { query: sql, schema: input.database }, accessToken, 'POST');
          return {
            table: input.table,
            createStatement: result.data || []
          };
        }
      }),

      test_connection: tool({
        description: 'Test database connection health',
        inputSchema: z.object({
          connection: z.string().optional(),
        }),
        execute: async (input, options) => {
          try {
            // Just try listing schemas to test connection
            const result = await executeDBQuery(connectionId, 'schemas', {}, accessToken, 'GET');
            return {
              status: 'healthy',
              message: 'Connection is active and responding',
              databases: result.data?.length || 0
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
        inputSchema: z.object({}),
        execute: async (input, options) => {
          return {
            currentConnection: connectionId,
            status: 'active',
            message: 'Currently connected to database'
          };
        }
      }),

      get_database_size: tool({
        description: 'Get database size and storage information',
        inputSchema: z.object({
          database: z.string().describe('Database/schema name'),
          connection: z.string().optional(),
        }),
        execute: async (input, options) => {
          const sql = `
            SELECT
              table_schema as database_name,
              SUM(data_length + index_length) as size_bytes,
              SUM(data_length + index_length) / 1024 / 1024 as size_mb
            FROM information_schema.tables
            WHERE table_schema = '${input.database}'
            GROUP BY table_schema
          `;
          const result = await executeDBQuery(connectionId, 'execute', { query: sql, schema: input.database }, accessToken, 'POST');
          return {
            database: input.database,
            sizeInfo: result.data?.[0] || { size_mb: 0 }
          };
        }
      }),
    };

    // Filter tools based on incognito mode
    if (chatConfig?.incognitoMode) {
      console.log('[Chat API] Incognito mode ENABLED - filtering tools to metadata-only');

      // Allowed tools in incognito mode (schema/metadata only)
      const allowedTools = [
        'list_databases',
        'list_tables',
        'describe_table',
        'show_indexes',
        'analyze_foreign_keys',
        'get_table_dependencies',
        'analyze_table_relationships',
        'test_connection',
        'show_connections',
        'backup_table_structure',
        'get_database_size',
      ];

      // Filter systemConfig.tools to only include allowed tools
      const filteredTools: any = {};
      for (const toolName of allowedTools) {
        if (systemConfig.tools[toolName]) {
          filteredTools[toolName] = systemConfig.tools[toolName];
        }
      }

      systemConfig.tools = filteredTools;
      console.log('[Chat API] Incognito mode: Allowed tools:', Object.keys(filteredTools));
    } else {
      console.log('[Chat API] Incognito mode DISABLED - all tools available');
    }

    // Stream the response with UI message format for useChat hook
    const result = await streamText(systemConfig);
    return result.toUIMessageStreamResponse({
      originalMessages: messages,
    });

  } catch (error: any) {
    console.error('[Chat API] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
