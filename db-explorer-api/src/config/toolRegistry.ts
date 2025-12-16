export enum ToolCategory {
  SCHEMA_STRUCTURE = 'schema_structure',
  DATA_QUERY = 'data_query',
  DATA_MODIFICATION = 'data_modification',
  ANALYSIS_RELATIONSHIPS = 'analysis_relationships',
  TENANT_MANAGEMENT = 'tenant_management',
  UTILITY_MAINTENANCE = 'utility_maintenance',
}

export interface ToolDefinition {
  name: string;
  category: ToolCategory;
  description: string;
  requiresPermission: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  isDestructive: boolean;
}

export interface ToolCategoryDefinition {
  id: ToolCategory;
  name: string;
  description: string;
  icon: string;
  defaultEnabled: boolean;
}

export const TOOL_CATEGORIES: Record<ToolCategory, ToolCategoryDefinition> = {
  [ToolCategory.SCHEMA_STRUCTURE]: {
    id: ToolCategory.SCHEMA_STRUCTURE,
    name: 'Schema & Structure',
    description: 'Tools for exploring database schema, tables, columns, and structure',
    icon: 'database',
    defaultEnabled: true,
  },
  [ToolCategory.DATA_QUERY]: {
    id: ToolCategory.DATA_QUERY,
    name: 'Data Query',
    description: 'Tools for reading and querying data without modifications',
    icon: 'search',
    defaultEnabled: true,
  },
  [ToolCategory.DATA_MODIFICATION]: {
    id: ToolCategory.DATA_MODIFICATION,
    name: 'Data Modification',
    description: 'Tools for inserting, updating, and deleting records',
    icon: 'edit',
    defaultEnabled: false,
  },
  [ToolCategory.ANALYSIS_RELATIONSHIPS]: {
    id: ToolCategory.ANALYSIS_RELATIONSHIPS,
    name: 'Analysis & Relationships',
    description: 'Tools for analyzing data patterns, joins, and relationships',
    icon: 'analytics',
    defaultEnabled: true,
  },
  [ToolCategory.TENANT_MANAGEMENT]: {
    id: ToolCategory.TENANT_MANAGEMENT,
    name: 'Tenant Management',
    description: 'Tools for multi-tenant database operations',
    icon: 'users',
    defaultEnabled: true,
  },
  [ToolCategory.UTILITY_MAINTENANCE]: {
    id: ToolCategory.UTILITY_MAINTENANCE,
    name: 'Utility & Maintenance',
    description: 'Tools for database optimization, backup, and maintenance',
    icon: 'tool',
    defaultEnabled: false,
  },
};

export const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  list_databases: {
    name: 'list_databases',
    category: ToolCategory.SCHEMA_STRUCTURE,
    description: 'List all available databases/schemas',
    requiresPermission: false,
    riskLevel: 'low',
    isDestructive: false,
  },
  list_tables: {
    name: 'list_tables',
    category: ToolCategory.SCHEMA_STRUCTURE,
    description: 'List all tables in a database',
    requiresPermission: false,
    riskLevel: 'low',
    isDestructive: false,
  },
  describe_table: {
    name: 'describe_table',
    category: ToolCategory.SCHEMA_STRUCTURE,
    description: 'Get detailed schema information for a table',
    requiresPermission: false,
    riskLevel: 'low',
    isDestructive: false,
  },
  show_indexes: {
    name: 'show_indexes',
    category: ToolCategory.SCHEMA_STRUCTURE,
    description: 'Show all indexes for a table',
    requiresPermission: false,
    riskLevel: 'low',
    isDestructive: false,
  },
  analyze_foreign_keys: {
    name: 'analyze_foreign_keys',
    category: ToolCategory.SCHEMA_STRUCTURE,
    description: 'Analyze foreign key relationships',
    requiresPermission: false,
    riskLevel: 'low',
    isDestructive: false,
  },
  get_table_dependencies: {
    name: 'get_table_dependencies',
    category: ToolCategory.SCHEMA_STRUCTURE,
    description: 'Get dependency tree for a table',
    requiresPermission: false,
    riskLevel: 'low',
    isDestructive: false,
  },

  select_data: {
    name: 'select_data',
    category: ToolCategory.DATA_QUERY,
    description: 'Execute SELECT query with filtering and pagination',
    requiresPermission: true,
    riskLevel: 'low',
    isDestructive: false,
  },
  count_records: {
    name: 'count_records',
    category: ToolCategory.DATA_QUERY,
    description: 'Count records in a table',
    requiresPermission: true,
    riskLevel: 'low',
    isDestructive: false,
  },
  find_by_id: {
    name: 'find_by_id',
    category: ToolCategory.DATA_QUERY,
    description: 'Find records by ID or primary key',
    requiresPermission: true,
    riskLevel: 'low',
    isDestructive: false,
  },
  search_records: {
    name: 'search_records',
    category: ToolCategory.DATA_QUERY,
    description: 'Full-text search across table columns',
    requiresPermission: true,
    riskLevel: 'low',
    isDestructive: false,
  },
  get_recent_records: {
    name: 'get_recent_records',
    category: ToolCategory.DATA_QUERY,
    description: 'Get recently created or modified records',
    requiresPermission: true,
    riskLevel: 'low',
    isDestructive: false,
  },
  execute_custom_query: {
    name: 'execute_custom_query',
    category: ToolCategory.DATA_QUERY,
    description: 'Execute custom SQL query',
    requiresPermission: true,
    riskLevel: 'high',
    isDestructive: false,
  },

  insert_record: {
    name: 'insert_record',
    category: ToolCategory.DATA_MODIFICATION,
    description: 'Insert a single record into a table',
    requiresPermission: true,
    riskLevel: 'medium',
    isDestructive: false,
  },
  update_record: {
    name: 'update_record',
    category: ToolCategory.DATA_MODIFICATION,
    description: 'Update records in a table',
    requiresPermission: true,
    riskLevel: 'high',
    isDestructive: true,
  },
  delete_record: {
    name: 'delete_record',
    category: ToolCategory.DATA_MODIFICATION,
    description: 'Delete records from a table',
    requiresPermission: true,
    riskLevel: 'high',
    isDestructive: true,
  },
  bulk_insert: {
    name: 'bulk_insert',
    category: ToolCategory.DATA_MODIFICATION,
    description: 'Insert multiple records efficiently',
    requiresPermission: true,
    riskLevel: 'medium',
    isDestructive: false,
  },

  join_tables: {
    name: 'join_tables',
    category: ToolCategory.ANALYSIS_RELATIONSHIPS,
    description: 'Execute JOIN queries across tables',
    requiresPermission: true,
    riskLevel: 'low',
    isDestructive: false,
  },
  find_orphaned_records: {
    name: 'find_orphaned_records',
    category: ToolCategory.ANALYSIS_RELATIONSHIPS,
    description: 'Find records without valid foreign key references',
    requiresPermission: true,
    riskLevel: 'low',
    isDestructive: false,
  },
  validate_referential_integrity: {
    name: 'validate_referential_integrity',
    category: ToolCategory.ANALYSIS_RELATIONSHIPS,
    description: 'Check for foreign key constraint violations',
    requiresPermission: true,
    riskLevel: 'low',
    isDestructive: false,
  },
  analyze_table_relationships: {
    name: 'analyze_table_relationships',
    category: ToolCategory.ANALYSIS_RELATIONSHIPS,
    description: 'Analyze and map table relationships',
    requiresPermission: true,
    riskLevel: 'low',
    isDestructive: false,
  },
  get_column_statistics: {
    name: 'get_column_statistics',
    category: ToolCategory.ANALYSIS_RELATIONSHIPS,
    description: 'Get statistical information about columns',
    requiresPermission: true,
    riskLevel: 'low',
    isDestructive: false,
  },

  list_tenants: {
    name: 'list_tenants',
    category: ToolCategory.TENANT_MANAGEMENT,
    description: 'List all tenant databases',
    requiresPermission: false,
    riskLevel: 'low',
    isDestructive: false,
  },
  switch_tenant_context: {
    name: 'switch_tenant_context',
    category: ToolCategory.TENANT_MANAGEMENT,
    description: 'Switch active tenant database context',
    requiresPermission: true,
    riskLevel: 'low',
    isDestructive: false,
  },
  get_tenant_schema: {
    name: 'get_tenant_schema',
    category: ToolCategory.TENANT_MANAGEMENT,
    description: 'Get complete schema for a tenant database',
    requiresPermission: true,
    riskLevel: 'low',
    isDestructive: false,
  },
  compare_tenant_data: {
    name: 'compare_tenant_data',
    category: ToolCategory.TENANT_MANAGEMENT,
    description: 'Compare data across tenant databases',
    requiresPermission: true,
    riskLevel: 'low',
    isDestructive: false,
  },
  get_tenant_tables: {
    name: 'get_tenant_tables',
    category: ToolCategory.TENANT_MANAGEMENT,
    description: 'Get all tables for a tenant database',
    requiresPermission: true,
    riskLevel: 'low',
    isDestructive: false,
  },

  explain_query: {
    name: 'explain_query',
    category: ToolCategory.UTILITY_MAINTENANCE,
    description: 'Get query execution plan',
    requiresPermission: true,
    riskLevel: 'low',
    isDestructive: false,
  },
  check_table_status: {
    name: 'check_table_status',
    category: ToolCategory.UTILITY_MAINTENANCE,
    description: 'Get table status information',
    requiresPermission: true,
    riskLevel: 'low',
    isDestructive: false,
  },
  optimize_table: {
    name: 'optimize_table',
    category: ToolCategory.UTILITY_MAINTENANCE,
    description: 'Optimize table for better performance',
    requiresPermission: true,
    riskLevel: 'medium',
    isDestructive: false,
  },
  backup_table_structure: {
    name: 'backup_table_structure',
    category: ToolCategory.UTILITY_MAINTENANCE,
    description: 'Export table DDL/CREATE statement',
    requiresPermission: true,
    riskLevel: 'low',
    isDestructive: false,
  },
  test_connection: {
    name: 'test_connection',
    category: ToolCategory.UTILITY_MAINTENANCE,
    description: 'Test database connection health',
    requiresPermission: false,
    riskLevel: 'low',
    isDestructive: false,
  },
  show_connections: {
    name: 'show_connections',
    category: ToolCategory.UTILITY_MAINTENANCE,
    description: 'Show available database connections',
    requiresPermission: false,
    riskLevel: 'low',
    isDestructive: false,
  },
  get_database_size: {
    name: 'get_database_size',
    category: ToolCategory.UTILITY_MAINTENANCE,
    description: 'Get database size and storage information',
    requiresPermission: true,
    riskLevel: 'low',
    isDestructive: false,
  },
};

export const getToolsByCategory = (category: ToolCategory): ToolDefinition[] => {
  return Object.values(TOOL_REGISTRY).filter(tool => tool.category === category);
};

export const getAllCategories = (): ToolCategoryDefinition[] => {
  return Object.values(TOOL_CATEGORIES);
};

export const getToolDefinition = (toolName: string): ToolDefinition | undefined => {
  return TOOL_REGISTRY[toolName];
};

export const requiresPermission = (toolName: string): boolean => {
  const tool = getToolDefinition(toolName);
  return tool?.requiresPermission ?? true;
};
