/**
 * Tool handlers setup for MCP Server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  InitializeRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { logger } from '../utils/logger.js';

// Import all tool handlers
import {
  listDatabasesSchema, listTablesSchema, describeTableSchema, showIndexesSchema,
  analyzeForeignKeysSchema, getTableDependenciesSchema,
  listDatabases, listTables, describeTable, showIndexes,
  analyzeForeignKeys, getTableDependencies
} from '../tools/schema.js';

import {
  selectDataSchema, countRecordsSchema, findByIdSchema, searchRecordsSchema,
  getRecentRecordsSchema, executeCustomQuerySchema,
  selectData, countRecords, findById, searchRecords,
  getRecentRecords, executeCustomQuery
} from '../tools/query.js';

import {
  insertRecordSchema, updateRecordSchema, deleteRecordSchema, bulkInsertSchema,
  insertRecord, updateRecord, deleteRecord, bulkInsert
} from '../tools/modify.js';

import {
  joinTablesSchema, findOrphanedRecordsSchema, validateReferentialIntegritySchema,
  analyzeTableRelationshipsSchema, getColumnStatisticsSchema,
  joinTables, findOrphanedRecords, validateReferentialIntegrity,
  analyzeTableRelationships, getColumnStatistics
} from '../tools/analysis.js';

import {
  listTenantsSchema, switchTenantContextSchema, getTenantSchemaSchema,
  compareTenantDataSchema, getTenantTablesSchema,
  listTenants, switchTenantContext, getTenantSchema,
  compareTenantData, getTenantTables
} from '../tools/tenant.js';

import {
  explainQuerySchema, checkTableStatusSchema, optimizeTableSchema,
  backupTableStructureSchema, testConnectionSchema, showConnectionsSchema,
  getDatabaseSizeSchema,
  explainQuery, checkTableStatus, optimizeTable,
  backupTableStructure, testConnection, showConnections,
  getDatabaseSize
} from '../tools/utility.js';

import {
  switchEnvironmentSchema, listEnvironmentsSchema, getCurrentEnvironmentSchema,
  testEnvironmentSchema,
  switchEnvironment, listEnvironments, getCurrentEnvironment,
  testEnvironment
} from '../tools/environment.js';

import {
  getSecurityReportSchema, getSecurityMetricsSchema, getSecurityEventsSchema,
  getSecurityReport, getSecurityMetrics, getSecurityEvents
} from '../tools/security.js';

import { configureConnectionSchema, configureConnection } from '../tools/configure.js';

export function setupToolHandlers(server: Server): void {
  const toolLogger = logger.child('ToolHandler');

  // Handle initialize request (required by MCP protocol)
  server.setRequestHandler(InitializeRequestSchema, async (request) => {
    toolLogger.info('Initialize request received', { 
      protocolVersion: request.params.protocolVersion,
      clientName: request.params.clientInfo?.name 
    });
    
    return {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
        resources: {},
      },
      serverInfo: {
        name: 'multi-database-mcp-server',
        version: '2.0.0',
      },
    };
  });

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        // Schema & Structure Tools
        { name: 'list_databases', description: 'List all available databases', inputSchema: listDatabasesSchema },
        { name: 'list_tables', description: 'List tables in a database', inputSchema: listTablesSchema },
        { name: 'describe_table', description: 'Get detailed table schema information', inputSchema: describeTableSchema },
        { name: 'show_indexes', description: 'Show indexes for a table', inputSchema: showIndexesSchema },
        { name: 'analyze_foreign_keys', description: 'Analyze foreign key relationships', inputSchema: analyzeForeignKeysSchema },
        { name: 'get_table_dependencies', description: 'Get table dependency information', inputSchema: getTableDependenciesSchema },

        // Data Query Tools
        { name: 'select_data', description: 'Execute SELECT queries with advanced filtering', inputSchema: selectDataSchema },
        { name: 'count_records', description: 'Count records in a table with optional conditions', inputSchema: countRecordsSchema },
        { name: 'find_by_id', description: 'Find records by ID or primary key', inputSchema: findByIdSchema },
        { name: 'search_records', description: 'Full-text search across table columns', inputSchema: searchRecordsSchema },
        { name: 'get_recent_records', description: 'Get recently created or modified records', inputSchema: getRecentRecordsSchema },
        { name: 'execute_custom_query', description: 'Execute custom SQL queries (SELECT, UPDATE, INSERT, DELETE) safely', inputSchema: executeCustomQuerySchema },

        // Data Modification Tools
        { name: 'insert_record', description: 'Insert a single record into a table', inputSchema: insertRecordSchema },
        { name: 'update_record', description: 'Update records in a table with WHERE conditions', inputSchema: updateRecordSchema },
        { name: 'delete_record', description: 'Delete records from a table with safety checks', inputSchema: deleteRecordSchema },
        { name: 'bulk_insert', description: 'Insert multiple records efficiently', inputSchema: bulkInsertSchema },

        // Analysis & Relationship Tools
        { name: 'join_tables', description: 'Execute JOIN queries across related tables', inputSchema: joinTablesSchema },
        { name: 'find_orphaned_records', description: 'Find records without valid foreign key references', inputSchema: findOrphanedRecordsSchema },
        { name: 'validate_referential_integrity', description: 'Check for foreign key constraint violations', inputSchema: validateReferentialIntegritySchema },
        { name: 'analyze_table_relationships', description: 'Analyze and map table relationships', inputSchema: analyzeTableRelationshipsSchema },
        { name: 'get_column_statistics', description: 'Get statistical information about table columns', inputSchema: getColumnStatisticsSchema },

        // Tenant Management Tools
        { name: 'list_tenants', description: 'List all tenant databases available on the connection', inputSchema: listTenantsSchema },
        { name: 'switch_tenant_context', description: 'Switch active tenant database context for operations', inputSchema: switchTenantContextSchema },
        { name: 'get_tenant_schema', description: 'Get complete schema information for a specific tenant database', inputSchema: getTenantSchemaSchema },
        { name: 'compare_tenant_data', description: 'Compare table data/schema across different tenant databases', inputSchema: compareTenantDataSchema },
        { name: 'get_tenant_tables', description: 'Get all tables and record counts for a specific tenant database', inputSchema: getTenantTablesSchema },

        // Utility & Maintenance Tools
        { name: 'explain_query', description: 'Get query execution plan and optimization info', inputSchema: explainQuerySchema },
        { name: 'check_table_status', description: 'Get table status information (size, rows, engine, etc.)', inputSchema: checkTableStatusSchema },
        { name: 'optimize_table', description: 'Optimize table for better performance', inputSchema: optimizeTableSchema },
        { name: 'backup_table_structure', description: 'Export table DDL/CREATE statement', inputSchema: backupTableStructureSchema },
        { name: 'test_connection', description: 'Test database connection health', inputSchema: testConnectionSchema },
        { name: 'show_connections', description: 'Show available database connections and their status', inputSchema: showConnectionsSchema },
        { name: 'get_database_size', description: 'Get database size and storage information', inputSchema: getDatabaseSizeSchema },
        { name: 'switch_environment', description: 'Switch active database environment (local, staging, prod, etc.)', inputSchema: switchEnvironmentSchema },
        { name: 'list_environments', description: 'List all available database environments with connection status', inputSchema: listEnvironmentsSchema },
        { name: 'get_current_environment', description: 'Get details about the currently active environment', inputSchema: getCurrentEnvironmentSchema },
        { name: 'test_environment', description: 'Test connection to a specific environment', inputSchema: testEnvironmentSchema },

        // Security Tools
        { name: 'get_security_report', description: 'Get comprehensive security report with metrics and recent events', inputSchema: getSecurityReportSchema },
        { name: 'get_security_metrics', description: 'Get security metrics for a specific database or global metrics', inputSchema: getSecurityMetricsSchema },
        { name: 'get_security_events', description: 'Get recent security events with filtering options', inputSchema: getSecurityEventsSchema },

        // Configuration Tool
        { name: 'configure_connection', description: 'Configure a database connection dynamically', inputSchema: configureConnectionSchema },
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    toolLogger.debug('Tool call received', { tool: name, arguments: Object.keys(args || {}) });

    try {
      // Handle configure_connection first
      if (name === 'configure_connection') {
        toolLogger.info('Configuring connection', { connectionId: (args as any)?.connectionId });
        const result = await configureConnection(args as any);
        toolLogger.success('Connection configured', { connectionId: (args as any)?.connectionId });
        return result;
      }

      // Handle all other tools
      switch (name) {
        case 'list_databases': return await listDatabases(args as any);
        case 'list_tables': return await listTables(args as any);
        case 'describe_table': return await describeTable(args as any);
        case 'show_indexes': return await showIndexes(args as any);
        case 'analyze_foreign_keys': return await analyzeForeignKeys(args as any);
        case 'get_table_dependencies': return await getTableDependencies(args as any);
        case 'select_data': return await selectData(args as any);
        case 'count_records': return await countRecords(args as any);
        case 'find_by_id': return await findById(args as any);
        case 'search_records': return await searchRecords(args as any);
        case 'get_recent_records': return await getRecentRecords(args as any);
        case 'execute_custom_query': return await executeCustomQuery(args as any);
        case 'insert_record': return await insertRecord(args as any);
        case 'update_record': return await updateRecord(args as any);
        case 'delete_record': return await deleteRecord(args as any);
        case 'bulk_insert': return await bulkInsert(args as any);
        case 'join_tables': return await joinTables(args as any);
        case 'find_orphaned_records': return await findOrphanedRecords(args as any);
        case 'validate_referential_integrity': return await validateReferentialIntegrity(args as any);
        case 'analyze_table_relationships': return await analyzeTableRelationships(args as any);
        case 'get_column_statistics': return await getColumnStatistics(args as any);
        case 'list_tenants': return await listTenants(args as any);
        case 'switch_tenant_context': return await switchTenantContext(args as any);
        case 'get_tenant_schema': return await getTenantSchema(args as any);
        case 'compare_tenant_data': return await compareTenantData(args as any);
        case 'get_tenant_tables': return await getTenantTables(args as any);
        case 'explain_query': return await explainQuery(args as any);
        case 'check_table_status': return await checkTableStatus(args as any);
        case 'optimize_table': return await optimizeTable(args as any);
        case 'backup_table_structure': return await backupTableStructure(args as any);
        case 'test_connection': return await testConnection(args as any);
        case 'show_connections': return await showConnections(args as any);
        case 'get_database_size': return await getDatabaseSize(args as any);
        case 'switch_environment': return await switchEnvironment(args as any);
        case 'list_environments': return await listEnvironments(args as any);
        case 'get_current_environment': return await getCurrentEnvironment(args as any);
        case 'test_environment': return await testEnvironment(args as any);
        case 'get_security_report': return await getSecurityReport(args as any);
        case 'get_security_metrics': return await getSecurityMetrics(args as any);
        case 'get_security_events': return await getSecurityEvents(args as any);
        default:
          toolLogger.error('Unknown tool requested', undefined, { tool: name });
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      toolLogger.error('Tool execution failed', error, { tool: name });
      throw error;
    }
  });

  // Handle resource listing (empty for now)
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources: [] };
  });
}