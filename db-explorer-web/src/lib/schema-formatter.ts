/**
 * Schema Formatter for AI Context
 * Converts cached schema data into AI-friendly format with context caching support
 */

// @ts-nocheck
import type { ConnectionSchemaCache } from '@/types/connection';

/**
 * Format cached schema for AI context - CONCISE VERSION (Recommended)
 * Only includes schema names and their table lists to minimize token usage
 * Reduces token count by ~95-99% compared to verbose version
 * 
 * The AI can use database tools to discover column details, types, and relationships dynamically
 */
export function formatSchemaForAIConcise(cache: ConnectionSchemaCache): string {
  const { schemaData } = cache;

  // Create ultra-concise format: { schema1: [t1, t2, ...], schema2: [...] }
  const schemaMap: Record<string, string[]> = {};
  
  for (const schema of schemaData.schemas) {
    schemaMap[schema.name] = schema.tables.map(t => t.name);
  }

  let formatted = `# DATABASE SCHEMA\n\n`;
  formatted += `**Type:** ${schemaData.database_type}\n`;
  formatted += `**Tables:** ${schemaData.total_tables}\n\n`;
  
  // Compact JSON representation
  formatted += `**Schema Structure:**\n\`\`\`json\n`;
  formatted += JSON.stringify(schemaMap, null, 2);
  formatted += `\n\`\`\`\n\n`;
  
  formatted += `**Instructions:**\n`;
  formatted += `- Use your database tools to discover column details, types, and relationships\n`;
  formatted += `- Query the schema dynamically when needed\n`;
  formatted += `- Tables are listed above for reference only\n`;

  return formatted;
}

/**
 * Format cached schema for AI context - VERBOSE VERSION
 * Includes all columns, types, constraints, foreign keys, and indexes
 * WARNING: Can result in tens of thousands of tokens for large databases
 * 
 * @deprecated Consider using formatSchemaForAIConcise instead to reduce token usage
 */
export function formatSchemaForAI(cache: ConnectionSchemaCache): string {
  const { schemaData, lastTrainedAt } = cache;

  let formatted = `# DATABASE SCHEMA REFERENCE\n\n`;
  formatted += `**Database Type:** ${schemaData.database_type}\n`;
  formatted += `**Total Tables:** ${schemaData.total_tables}\n`;
  formatted += `**Total Columns:** ${schemaData.total_columns}\n`;
  if (lastTrainedAt) {
    formatted += `**Last Updated:** ${new Date(lastTrainedAt).toLocaleString()}\n`;
  }

  if (schemaData.version) {
    formatted += `**Version:** ${schemaData.version}\n`;
  }

  formatted += `\n---\n\n`;

  // Format each schema and its tables
  for (const schema of schemaData.schemas) {
    formatted += `## Schema: ${schema.name}\n\n`;

    for (const table of schema.tables) {
      // Table header
      formatted += `### Table: ${table.name}\n`;

      if (table.row_count !== undefined && table.row_count !== null) {
        formatted += `**Approximate Rows:** ~${table.row_count.toLocaleString()}\n`;
      }

      formatted += `\n**Columns:**\n`;

      // Format columns in compact notation
      const columnLines: string[] = [];
      for (const col of table.columns) {
        let colLine = `- \`${col.name}\``;

        // Add type
        colLine += ` (${col.type})`;

        // Add constraints
        const constraints: string[] = [];
        if (col.is_primary_key) constraints.push('PK');
        if (col.is_foreign_key) constraints.push('FK');
        if (!col.nullable) constraints.push('NOT NULL');
        if (col.default_value) constraints.push(`DEFAULT: ${col.default_value}`);

        if (constraints.length > 0) {
          colLine += ` [${constraints.join(', ')}]`;
        }

        columnLines.push(colLine);
      }

      formatted += columnLines.join('\n') + '\n';

      // Foreign key relationships
      if (table.foreign_keys && table.foreign_keys.length > 0) {
        formatted += `\n**Foreign Keys:**\n`;
        for (const fk of table.foreign_keys) {
          formatted += `- \`${fk.column_name}\` → \`${fk.referenced_table}.${fk.referenced_column}\``;
          if (fk.constraint_name) {
            formatted += ` (${fk.constraint_name})`;
          }
          formatted += `\n  - ON UPDATE: ${fk.update_rule || 'NO ACTION'}\n`;
          formatted += `  - ON DELETE: ${fk.delete_rule || 'NO ACTION'}\n`;
        }
      }

      // Indexes
      if (table.indexes && table.indexes.length > 0) {
        formatted += `\n**Indexes:**\n`;
        // Group indexes by name
        const indexMap = new Map<string, typeof table.indexes>();
        for (const idx of table.indexes) {
          if (!indexMap.has(idx.name)) {
            indexMap.set(idx.name, []);
          }
          indexMap.get(idx.name)!.push(idx);
        }

        for (const [idxName, indexes] of indexMap.entries()) {
          const columns = indexes.map(i => i.column_name).filter(Boolean).join(', ');
          const isUnique = indexes.some(i => i.is_unique);
          const indexType = indexes[0]?.index_type || 'BTREE';

          formatted += `- \`${idxName}\` on (${columns || 'unknown'})`;
          formatted += ` [${indexType}`;
          if (isUnique) formatted += ', UNIQUE';
          formatted += `]\n`;
        }
      }

      formatted += `\n`;
    }

    formatted += `---\n\n`;
  }

  // Add usage instructions
  formatted += `## IMPORTANT INSTRUCTIONS FOR AI\n\n`;
  formatted += `1. **Schema Knowledge**: You have COMPLETE knowledge of this database structure\n`;
  formatted += `2. **Table & Column Names**: Use EXACT names as shown above (case-sensitive)\n`;
  formatted += `3. **Foreign Keys**: Consider relationships when joining tables\n`;
  formatted += `4. **Primary Keys**: Use PK columns for efficient lookups\n`;
  formatted += `5. **Data Types**: Respect column types when filtering/comparing values\n`;
  formatted += `6. **Indexes**: Leverage indexed columns for better query performance\n`;
  formatted += `7. **Row Counts**: Consider table sizes when planning queries\n`;
  formatted += `\n`;
  formatted += `When writing queries:\n`;
  formatted += `- Always use fully qualified names: \`schema.table\` or \`schema.table.column\`\n`;
  formatted += `- Reference foreign keys for JOIN conditions\n`;
  formatted += `- Use appropriate WHERE clauses with indexed columns\n`;
  formatted += `- Be mindful of large tables when selecting without LIMIT\n`;

  return formatted;
}

/**
 * Build a compact schema overview (for contexts where full schema is too large)
 */
export function buildSchemaOverview(cache: ConnectionSchemaCache): string {
  const { schemaData, lastTrainedAt } = cache;

  let overview = `# DATABASE OVERVIEW\n\n`;
  overview += `**Type:** ${schemaData.database_type}\n`;
  overview += `**Total Tables:** ${schemaData.total_tables}\n`;
  overview += `**Total Columns:** ${schemaData.total_columns}\n`;
  if (lastTrainedAt) {
    overview += `**Last Updated:** ${new Date(lastTrainedAt).toLocaleString()}\n\n`;
  } else {
    overview += `\n`;
  }

  for (const schema of schemaData.schemas) {
    overview += `## Schema: ${schema.name}\n`;
    overview += `**Tables (${schema.tables.length}):** `;
    overview += schema.tables.map(t => {
      let info = t.name;
      if (t.row_count) info += ` (~${t.row_count} rows)`;
      return info;
    }).join(', ');
    overview += `\n\n`;
  }

  overview += `\nUse tools like \`describe_table\` to get detailed column information for specific tables.\n`;

  return overview;
}

/**
 * Estimate token count for a text string
 * Rough approximation: 1 token ≈ 4 characters
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Check if schema cache is stale (older than 7 days)
 */
export function isSchemaStale(lastTrainedAt: string): boolean {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return new Date(lastTrainedAt) < sevenDaysAgo;
}
