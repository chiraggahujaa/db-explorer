/**
 * Utility to extract SQL queries from MCP tool inputs
 */

export interface ToolCallData {
  id: string;
  name: string;
  input: Record<string, any>;
  result?: any;
  sqlQuery?: string;
  timestamp: number;
}

/**
 * Extracts SQL query from tool input based on tool name
 */
export function extractSQLFromToolInput(toolName: string, toolInput: Record<string, any>): string | undefined {
  if (!toolInput) return undefined;

  // Direct SQL query tools
  if (toolName === 'execute_custom_query' || toolName === 'execute_query') {
    return toolInput.sql || toolInput.query;
  }

  // SELECT data tool - construct SQL from parameters
  if (toolName === 'select_data') {
    const { table, columns, where, orderBy, limit, offset, database } = toolInput;

    if (!table) return undefined;

    let sql = 'SELECT ';

    // Columns
    if (columns && Array.isArray(columns) && columns.length > 0) {
      sql += columns.join(', ');
    } else {
      sql += '*';
    }

    // Table
    sql += ` FROM ${table}`;

    // WHERE clause
    if (where) {
      sql += ` WHERE ${where}`;
    }

    // ORDER BY clause
    if (orderBy) {
      sql += ` ORDER BY ${orderBy}`;
    }

    // LIMIT clause
    if (limit) {
      sql += ` LIMIT ${limit}`;
    }

    // OFFSET clause
    if (offset) {
      sql += ` OFFSET ${offset}`;
    }

    return sql;
  }

  // INSERT data tool
  if (toolName === 'insert_data') {
    const { table, data } = toolInput;
    if (!table || !data) return undefined;

    const columns = Object.keys(data);
    const values = Object.values(data).map(v =>
      typeof v === 'string' ? `'${v}'` : v
    );

    return `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')})`;
  }

  // UPDATE data tool
  if (toolName === 'update_data') {
    const { table, data, where } = toolInput;
    if (!table || !data) return undefined;

    const sets = Object.entries(data).map(([key, value]) =>
      `${key} = ${typeof value === 'string' ? `'${value}'` : value}`
    ).join(', ');

    let sql = `UPDATE ${table} SET ${sets}`;

    if (where) {
      sql += ` WHERE ${where}`;
    }

    return sql;
  }

  // DELETE data tool
  if (toolName === 'delete_data') {
    const { table, where } = toolInput;
    if (!table) return undefined;

    let sql = `DELETE FROM ${table}`;

    if (where) {
      sql += ` WHERE ${where}`;
    }

    return sql;
  }

  // Schema tools - these don't have SQL queries
  if (toolName === 'list_tables' || toolName === 'describe_table' || toolName === 'list_databases') {
    return undefined;
  }

  return undefined;
}

/**
 * Extracts SQL query from tool result text if present
 */
export function extractSQLFromResultText(resultText: string): string | undefined {
  // Look for "SQL: " or "Query: " pattern in result text
  const sqlMatch = resultText.match(/(?:SQL|Query):\s*([^\n]+)/i);
  if (sqlMatch && sqlMatch[1]) {
    return sqlMatch[1].trim();
  }

  return undefined;
}

/**
 * Creates a formatted tool call data object
 */
export function createToolCallData(
  id: string,
  name: string,
  input: Record<string, any>,
  result?: any
): ToolCallData {
  const sqlQuery = extractSQLFromToolInput(name, input);

  // If we didn't get SQL from input, try to extract from result text
  const finalSqlQuery = sqlQuery ||
    (result && typeof result === 'string' ? extractSQLFromResultText(result) : undefined);

  return {
    id,
    name,
    input,
    result,
    sqlQuery: finalSqlQuery,
    timestamp: Date.now()
  };
}
