/**
 * Utility to parse and format query results
 */

export type ResultType = 'table' | 'text' | 'error' | 'metadata';

export interface ParsedResult {
  type: ResultType;
  data: any;
  metadata?: {
    rowCount?: number;
    affectedRows?: number;
    insertId?: number;
    executionTime?: number;
  };
}

export interface TableData {
  columns: string[];
  rows: Record<string, any>[];
}

/**
 * Parses tool result to determine type and extract data
 */
export function parseToolResult(result: any): ParsedResult {
  if (!result) {
    return {
      type: 'text',
      data: 'No result'
    };
  }

  // Handle error results - be more specific to avoid false positives
  if (result.error) {
    return {
      type: 'error',
      data: typeof result === 'string' ? result : result.error || JSON.stringify(result, null, 2)
    };
  }

  // Check for actual error messages in string results
  if (typeof result === 'string') {
    const lowerResult = result.toLowerCase();
    // Only treat as error if it starts with error keywords or contains specific error patterns
    const isError = /^error[:\s]/i.test(result.trim()) ||
                    /(?:failed|exception|fatal|cannot|unable to)/i.test(lowerResult) ||
                    lowerResult.includes('error:') ||
                    lowerResult.includes('error occurred');

    if (isError) {
      return {
        type: 'error',
        data: result
      };
    }
  }

  // Handle string results
  if (typeof result === 'string') {
    return parseTextResult(result);
  }

  // Handle AI tool content format
  if (result.content && Array.isArray(result.content)) {
    const textContent = result.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('\n');

    return parseTextResult(textContent);
  }

  // Handle array of objects (direct table data)
  if (Array.isArray(result) && result.length > 0 && typeof result[0] === 'object') {
    const columns = Object.keys(result[0]);
    return {
      type: 'table',
      data: {
        columns,
        rows: result
      },
      metadata: {
        rowCount: result.length
      }
    };
  }

  // Handle metadata results (INSERT, UPDATE, DELETE)
  if (typeof result === 'object' && (result.affectedRows !== undefined || result.insertId !== undefined)) {
    return {
      type: 'metadata',
      data: result,
      metadata: {
        affectedRows: result.affectedRows,
        insertId: result.insertId
      }
    };
  }

  // Default to text
  return {
    type: 'text',
    data: JSON.stringify(result, null, 2)
  };
}

/**
 * Parses text result to detect table data
 */
function parseTextResult(text: string): ParsedResult {
  // Extract metadata from text
  const metadata: ParsedResult['metadata'] = {};

  // Extract row count
  const rowCountMatch = text.match(/(\d+)\s+rows?/i);
  if (rowCountMatch) {
    metadata.rowCount = parseInt(rowCountMatch[1], 10);
  }

  // Extract affected rows
  const affectedMatch = text.match(/(\d+)\s+rows?\s+affected/i);
  if (affectedMatch) {
    metadata.affectedRows = parseInt(affectedMatch[1], 10);
  }

  // Try to detect ASCII table format
  const tableData = parseAsciiTable(text);
  if (tableData) {
    return {
      type: 'table',
      data: tableData,
      metadata
    };
  }

  // Check if it's a metadata-only result (INSERT, UPDATE, DELETE)
  if (metadata.affectedRows !== undefined || text.includes('successfully') || text.includes('inserted') || text.includes('updated') || text.includes('deleted')) {
    return {
      type: 'metadata',
      data: text,
      metadata
    };
  }

  // Default to text
  return {
    type: 'text',
    data: text,
    metadata
  };
}

/**
 * Parses ASCII table format into structured data
 */
function parseAsciiTable(text: string): TableData | null {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Look for separator line with dashes
  const separatorIndex = lines.findIndex(line => /^[-|+\s]+$/.test(line));

  if (separatorIndex === -1 || separatorIndex === 0) {
    return null;
  }

  // Header is the line before separator
  const headerLine = lines[separatorIndex - 1];

  // Parse column headers
  const columns = headerLine
    .split('|')
    .map(col => col.trim())
    .filter(col => col.length > 0);

  if (columns.length === 0) {
    return null;
  }

  // Parse data rows (after separator)
  const rows: Record<string, any>[] = [];

  for (let i = separatorIndex + 1; i < lines.length; i++) {
    const line = lines[i];

    // Skip separator-like lines
    if (/^[-|+\s]+$/.test(line)) {
      continue;
    }

    // Skip SQL query lines or metadata lines
    if (line.startsWith('SQL:') || line.startsWith('Query:') || line.includes('Results')) {
      continue;
    }

    const values = line
      .split('|')
      .map(val => val.trim())
      .filter((val, idx) => idx < columns.length || val.length > 0);

    if (values.length === 0 || values.length > columns.length) {
      continue;
    }

    const row: Record<string, any> = {};
    columns.forEach((col, idx) => {
      const value = values[idx] || '';
      // Try to parse numbers
      const numValue = Number(value);
      row[col] = isNaN(numValue) ? value : numValue;
    });

    rows.push(row);
  }

  if (rows.length === 0) {
    return null;
  }

  return { columns, rows };
}

/**
 * Formats metadata result for display
 */
export function formatMetadata(metadata: ParsedResult['metadata']): string {
  if (!metadata) return '';

  const parts: string[] = [];

  if (metadata.rowCount !== undefined) {
    parts.push(`${metadata.rowCount} row(s)`);
  }

  if (metadata.affectedRows !== undefined) {
    parts.push(`${metadata.affectedRows} affected`);
  }

  if (metadata.insertId !== undefined) {
    parts.push(`Insert ID: ${metadata.insertId}`);
  }

  if (metadata.executionTime !== undefined) {
    parts.push(`${metadata.executionTime}ms`);
  }

  return parts.join(' • ');
}
