/**
 * Schema Formatter for AI Context
 * Converts cached schema data into AI-friendly format with context caching support
 */

import type { ConnectionSchemaCache } from '@/types/connection';

/**
 * Format cached schema for AI context
 * Converts schema JSON to readable text format optimized for LLM consumption
 */
export function formatSchemaForAI(cache: ConnectionSchemaCache): string {
  const { schemaData, lastTrainedAt } = cache;

  let formatted = `# DATABASE SCHEMA REFERENCE\n\n`;
  formatted += `**Database Type:** ${schemaData.database_type}\n`;
  formatted += `**Total Tables:** ${schemaData.total_tables}\n`;
  formatted += `**Total Columns:** ${schemaData.total_columns}\n`;
  formatted += `**Last Updated:** ${new Date(lastTrainedAt).toLocaleString()}\n`;

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
  const { schemaData } = cache;

  let overview = `# DATABASE OVERVIEW\n\n`;
  overview += `**Type:** ${schemaData.database_type}\n`;
  overview += `**Total Tables:** ${schemaData.total_tables}\n`;
  overview += `**Total Columns:** ${schemaData.total_columns}\n`;
  overview += `**Last Updated:** ${new Date(cache.lastTrainedAt).toLocaleString()}\n\n`;

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
 * Check if schema should be padded to meet caching minimum
 * Returns true if schema is close to but below the caching threshold
 */
export function shouldPadSchema(tokenCount: number, cachingThreshold: number = 32768): boolean {
  // Pad if we're within 80-100% of threshold
  const lowerBound = cachingThreshold * 0.8;
  return tokenCount >= lowerBound && tokenCount < cachingThreshold;
}

/**
 * Generate padding content to reach minimum token count for caching
 * Adds useful query patterns and examples
 */
export function generateSchemaPadding(cache: ConnectionSchemaCache, tokensNeeded: number): string {
  let padding = `\n\n# COMMON QUERY PATTERNS & EXAMPLES\n\n`;

  const { schemaData } = cache;

  // Add relationship-based query patterns
  padding += `## Join Patterns\n\n`;

  for (const schema of schemaData.schemas) {
    const tablesWithFKs = schema.tables.filter(t =>
      t.foreign_keys && t.foreign_keys.length > 0
    );

    for (const table of tablesWithFKs) {
      padding += `### ${schema.name}.${table.name} Relationships\n\n`;

      for (const fk of table.foreign_keys || []) {
        padding += `**Join with ${fk.referenced_table}:**\n`;
        padding += '```sql\n';
        padding += `SELECT \n`;
        padding += `  ${table.name}.*,\n`;
        padding += `  ${fk.referenced_table}.*\n`;
        padding += `FROM ${schema.name}.${table.name}\n`;
        padding += `JOIN ${schema.name}.${fk.referenced_table}\n`;
        padding += `  ON ${table.name}.${fk.column_name} = ${fk.referenced_table}.${fk.referenced_column}\n`;
        padding += '```\n\n';

        // Check if we have enough padding
        if (estimateTokens(padding) >= tokensNeeded) {
          return padding;
        }
      }
    }
  }

  // Add filtering patterns
  padding += `## Common Filtering Patterns\n\n`;

  for (const schema of schemaData.schemas) {
    for (const table of schema.tables.slice(0, 5)) { // Limit to first 5 tables
      padding += `### Filtering ${table.name}\n\n`;

      // Date filtering examples
      const dateColumns = table.columns.filter(c =>
        c.type.includes('date') || c.type.includes('time')
      );
      if (dateColumns.length > 0) {
        const dateCol = dateColumns[0];
        padding += `**By date range:**\n`;
        padding += '```sql\n';
        padding += `SELECT * FROM ${schema.name}.${table.name}\n`;
        padding += `WHERE ${dateCol.name} BETWEEN '2024-01-01' AND '2024-12-31'\n`;
        padding += '```\n\n';
      }

      // Text search examples
      const textColumns = table.columns.filter(c =>
        c.type.includes('varchar') || c.type.includes('text') || c.type.includes('char')
      );
      if (textColumns.length > 0) {
        const textCol = textColumns[0];
        padding += `**By text search:**\n`;
        padding += '```sql\n';
        padding += `SELECT * FROM ${schema.name}.${table.name}\n`;
        padding += `WHERE ${textCol.name} LIKE '%search_term%'\n`;
        padding += '```\n\n';
      }

      if (estimateTokens(padding) >= tokensNeeded) {
        return padding;
      }
    }
  }

  // Add aggregation examples
  padding += `## Aggregation Examples\n\n`;

  for (const schema of schemaData.schemas) {
    for (const table of schema.tables.slice(0, 3)) {
      const numericColumns = table.columns.filter(c =>
        c.type.includes('int') || c.type.includes('decimal') ||
        c.type.includes('float') || c.type.includes('double')
      );

      if (numericColumns.length > 0) {
        const numCol = numericColumns[0];
        padding += `**Count and sum for ${table.name}:**\n`;
        padding += '```sql\n';
        padding += `SELECT \n`;
        padding += `  COUNT(*) as total_records,\n`;
        padding += `  SUM(${numCol.name}) as total_${numCol.name},\n`;
        padding += `  AVG(${numCol.name}) as avg_${numCol.name},\n`;
        padding += `  MIN(${numCol.name}) as min_${numCol.name},\n`;
        padding += `  MAX(${numCol.name}) as max_${numCol.name}\n`;
        padding += `FROM ${schema.name}.${table.name}\n`;
        padding += '```\n\n';

        if (estimateTokens(padding) >= tokensNeeded) {
          return padding;
        }
      }
    }
  }

  return padding;
}

/**
 * Check if schema cache is stale (older than 7 days)
 */
export function isSchemaStale(lastTrainedAt: string): boolean {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return new Date(lastTrainedAt) < sevenDaysAgo;
}
