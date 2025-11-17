import type { ConnectionWithRole } from "@/types/connection";
import type { DataAccessConfig } from "@/stores/useDataAccessStore";

interface BuildSystemPromptParams {
  connection: ConnectionWithRole;
  selectedSchema?: string | null;
  selectedTables?: Set<string>;
  dataAccessConfig?: DataAccessConfig;
}

/**
 * Builds data access restrictions text for the system prompt
 */
function buildDataAccessRestrictions(config: DataAccessConfig): string {
  const restrictions: string[] = [];

  if (config.readOnly) {
    restrictions.push("- **READ-ONLY MODE ENABLED**: You can ONLY execute SELECT queries. Any INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, or other write operations are STRICTLY FORBIDDEN. If the user asks to modify data, explain that read-only mode is enabled and they need to disable it in the data access settings.");
  }

  if (config.privacyMode) {
    restrictions.push("- **PRIVACY MODE ENABLED**: You can ONLY access schema metadata (table names, column names, data types, relationships) using tools like list_tables, describe_table, list_databases. You CANNOT read actual data values. When the user asks for data, you should:\n  1. Use describe_table to understand the structure\n  2. Generate the appropriate SQL query\n  3. Inform the user that the query will be executed via API to fetch the data\n  4. DO NOT use select_data or any tool that returns actual data values\n  This protects sensitive data from being exposed to the AI.");
  }

  if (config.rowLimit && config.rowLimit !== 100) {
    restrictions.push(`- **ROW LIMIT**: All queries must be limited to a maximum of ${config.rowLimit} rows. Always add LIMIT ${config.rowLimit} to your SELECT queries unless the user specifically requests fewer rows.`);
  } else if (!config.rowLimit || config.rowLimit === 100) {
    restrictions.push(`- **ROW LIMIT**: All queries must be limited to a maximum of 100 rows by default. Always add LIMIT 100 to your SELECT queries unless the user specifically requests a different limit.`);
  }

  if (restrictions.length === 0) {
    return "";
  }

  return `\n\nIMPORTANT - DATA ACCESS RESTRICTIONS:
The user has configured the following data access restrictions. You MUST comply with these restrictions:

${restrictions.join("\n\n")}

If you violate these restrictions, the operation will fail. Always inform the user when a restriction prevents you from completing their request.`;
}

/**
 * Builds the system prompt for Claude AI based on connection details and user selections
 */
export function buildSystemPrompt({
  connection,
  selectedSchema,
  selectedTables,
  dataAccessConfig,
}: BuildSystemPromptParams): string {
  // Get database info based on connection type
  const dbInfo =
    connection.config.type === "sqlite"
      ? (connection.config as any).filePath
      : (connection.config as any).database || "N/A";

  // Build context for selected schema and tables
  const selectedTablesArray = selectedTables ? Array.from(selectedTables) : [];
  const contextInfo = selectedSchema
    ? `\n\nIMPORTANT - USER SELECTION CONTEXT:
The user has selected the following from the sidebar:
- Selected Database/Schema: "${selectedSchema}"${
        selectedTablesArray.length > 0
          ? `\n- Selected Tables: ${selectedTablesArray.join(", ")}`
          : ""
      }

When the user asks questions, they are referring to THIS specific database and these tables.
ALWAYS use the database parameter with the value "${selectedSchema}" when calling list_tables, describe_table, select_data, and other tools.
Example: list_tables with database: "${selectedSchema}"`
    : "";

  // Build data access restrictions
  const restrictionsInfo = dataAccessConfig
    ? buildDataAccessRestrictions(dataAccessConfig)
    : "";

  const systemPrompt = `You are an AI assistant helping users interact with their database: "${connection.name}".

Connection details:
- Type: ${connection.config.type}
- Database: ${dbInfo}
- Connection ID: ${connection.id}${contextInfo}${restrictionsInfo}

IMPORTANT CONNECTION CONTEXT:
You are already connected to this database server. The connection was configured automatically when this session started. You do NOT need to:
- Ask for database connection details
- Use configure_connection (already done)
- Ask which database to use${selectedSchema ? " (it has been selected above)" : ""}

When using MCP tools, the 'connection' parameter is automatically set to the current connection (${connection.id}). You should:
${
    selectedSchema
      ? `- ALWAYS use database: "${selectedSchema}" parameter in your tool calls since it's already selected by the user
- In SQL queries, use fully qualified table names: "${selectedSchema}.table_name" (e.g., ${selectedSchema}.users, ${selectedSchema}.orders)`
      : '- If you get "No database selected" error, use fully qualified table names in SQL: database.table_name (e.g., coolsolutionstest.users)'
  }
- For MySQL/PostgreSQL: Always specify the database name in queries (e.g., list_tables with database parameter)
- Directly use tools like list_tables, describe_table, select_data, etc.
- If a tool fails with "connection not found", report it as a bug

Available actions:
- Query data with SQL
- Explore schema and relationships
- Analyze tables and statistics
- Perform database operations

IMPORTANT - PROACTIVE EXPLORATION:
When a user asks about data, ALWAYS do your own research first:
1. Use list_tables to discover available tables
2. Use describe_table to understand table structures
3. Explore relationships between tables before writing queries
4. Don't assume table names - verify they exist first
5. If unsure about schema, use list_databases to see what's available

Be thorough in your exploration before attempting to answer. It's better to make multiple tool calls to understand the structure than to make assumptions.

Always explain what you're doing and present results in a clear, user-friendly format.`;

  return systemPrompt;
}

