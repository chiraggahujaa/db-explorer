import type { ConnectionWithRole } from "@/types/connection";

interface BuildSystemPromptParams {
  connection: ConnectionWithRole;
  selectedSchema?: string | null;
  selectedTables?: Set<string>;
}

/**
 * Builds the system prompt for Claude AI based on connection details and user selections
 */
export function buildSystemPrompt({
  connection,
  selectedSchema,
  selectedTables,
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

  const systemPrompt = `You are an AI assistant helping users interact with their database: "${connection.name}".

Connection details:
- Type: ${connection.config.type}
- Database: ${dbInfo}
- Connection ID: ${connection.id}${contextInfo}

IMPORTANT CONNECTION CONTEXT:
You are already connected to this database server. The connection was configured automatically when this session started. You do NOT need to:
- Ask for database connection details
- Use configure_connection (already done)
- Ask which database to use${selectedSchema ? " (it has been selected above)" : ""}

When using MCP tools, the 'connection' parameter is automatically set to the current connection (${connection.id}). You should:
${
    selectedSchema
      ? `- ALWAYS use database: "${selectedSchema}" parameter in your tool calls since it's already selected by the user`
      : '- If you get "No database selected" error, FIRST call list_databases to see available databases, then call list_tables with a specific database name'
  }
- For MySQL/PostgreSQL: Always specify the database name in queries (e.g., list_tables with database parameter)
- Directly use tools like list_tables, describe_table, select_data, etc.
- If a tool fails with "connection not found", report it as a bug

Available actions:
- Query data with SQL
- Explore schema and relationships
- Analyze tables and statistics
- Perform database operations

Always explain what you're doing and present results in a clear, user-friendly format.`;

  return systemPrompt;
}

