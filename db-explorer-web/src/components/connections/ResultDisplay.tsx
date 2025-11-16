'use client';

/**
 * ResultDisplay Component
 * Displays query results in appropriate format (table, text, error, metadata)
 */

import React from 'react';
import { parseToolResult, formatMetadata, type ParsedResult } from '@/utils/resultParser';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, Database } from 'lucide-react';

interface ResultDisplayProps {
  result: any;
  className?: string;
}

export function ResultDisplay({ result, className = '' }: ResultDisplayProps) {
  if (!result) return null;

  const parsedResult: ParsedResult = parseToolResult(result);

  return (
    <div className={`mt-2 ${className}`}>
      {parsedResult.type === 'table' && (
        <TableResultView data={parsedResult.data} metadata={parsedResult.metadata} />
      )}

      {parsedResult.type === 'text' && (
        <TextResultView data={parsedResult.data} metadata={parsedResult.metadata} />
      )}

      {parsedResult.type === 'error' && (
        <ErrorResultView data={parsedResult.data} />
      )}

      {parsedResult.type === 'metadata' && (
        <MetadataResultView data={parsedResult.data} metadata={parsedResult.metadata} />
      )}
    </div>
  );
}

/**
 * Table Result View
 */
function TableResultView({ data, metadata }: { data: any; metadata?: ParsedResult['metadata'] }) {
  if (!data || !data.columns || !data.rows) {
    return <TextResultView data="Invalid table data" />;
  }

  const { columns, rows } = data;

  return (
    <div className="space-y-2">
      {metadata && (
        <div className="text-xs text-muted-foreground">
          {formatMetadata(metadata)}
        </div>
      )}

      <div className="border rounded-md max-h-96 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col: string, idx: number) => (
                <TableHead key={idx} className="font-semibold">
                  {col}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
                  No data
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row: Record<string, any>, rowIdx: number) => (
                <TableRow key={rowIdx}>
                  {columns.map((col: string, colIdx: number) => (
                    <TableCell key={colIdx} className="font-mono text-sm">
                      {row[col] !== null && row[col] !== undefined ? String(row[col]) : (
                        <span className="text-muted-foreground">NULL</span>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/**
 * Text Result View
 */
function TextResultView({ data, metadata }: { data: string; metadata?: ParsedResult['metadata'] }) {
  // Check if data is a bulleted list
  const lines = data.split('\n').filter(line => line.trim());
  const isBulletedList = lines.length > 1 && lines.slice(1).every(line =>
    line.trim().startsWith('•') || line.trim().startsWith('-')
  );

  // Extract title and list items
  const title = isBulletedList ? lines[0].replace(/:\s*$/, '') : null;
  const listItems = isBulletedList ? lines.slice(1).map(line =>
    line.trim().replace(/^[•\-]\s*/, '')
  ) : null;

  return (
    <div className="space-y-2">
      {metadata && (
        <div className="text-xs text-muted-foreground">
          {formatMetadata(metadata)}
        </div>
      )}
      {isBulletedList && title && listItems ? (
        <div className="bg-muted/50 dark:bg-muted/30 rounded-md p-4 overflow-x-auto">
          <h4 className="text-sm font-semibold mb-3 text-foreground whitespace-nowrap">{title}</h4>
          <ul className="space-y-1.5">
            {listItems.map((item, idx) => (
              <li key={idx} className="text-sm flex items-start gap-2 whitespace-nowrap">
                <span className="text-primary mt-0.5 flex-shrink-0">•</span>
                <span className="font-mono text-foreground/90">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="bg-muted/50 rounded-md p-3 overflow-x-auto max-h-96">
          <pre className="text-sm whitespace-pre font-mono">
            {data}
          </pre>
        </div>
      )}
    </div>
  );
}

/**
 * Error Result View
 */
function ErrorResultView({ data }: { data: string }) {
  // Parse error to extract useful information
  const parseError = (errorText: string) => {
    // Remove "Tables in looptest:" prefix if present
    const cleaned = errorText.replace(/^Tables in [^:]+:\s*/i, '');

    // Check if it's a list of items (starting with bullets or dashes)
    const isList = cleaned.trim().split('\n').every(line =>
      !line.trim() || line.trim().startsWith('•') || line.trim().startsWith('-')
    );

    if (isList) {
      return {
        title: 'Error',
        message: cleaned,
        isList: true
      };
    }

    // Try to extract error message
    const errorMatch = cleaned.match(/error[:\s]+(.+)/i);
    if (errorMatch) {
      return {
        title: 'Error',
        message: errorMatch[1].trim()
      };
    }

    return {
      title: 'Error',
      message: cleaned
    };
  };

  const { title, message, isList } = parseError(data);

  return (
    <Alert variant="destructive" className="mt-2 overflow-x-auto">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="space-y-2">
        <div className="font-semibold text-sm whitespace-nowrap">{title}</div>
        {isList ? (
          <ul className="list-disc list-inside space-y-1 text-sm">
            {message.split('\n').filter(line => line.trim()).map((line, idx) => (
              <li key={idx} className="text-destructive-foreground/90 whitespace-nowrap">
                {line.replace(/^[•\-]\s*/, '').trim()}
              </li>
            ))}
          </ul>
        ) : (
          <pre className="text-sm whitespace-pre text-destructive-foreground/90">
            {message}
          </pre>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Metadata Result View (for INSERT, UPDATE, DELETE operations)
 */
function MetadataResultView({ data, metadata }: { data: any; metadata?: ParsedResult['metadata'] }) {
  const displayData = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

  return (
    <Alert className="mt-2 border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950 overflow-x-auto">
      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
      <AlertDescription className="space-y-2">
        <div className="font-semibold text-green-900 dark:text-green-100 whitespace-nowrap">
          {metadata && formatMetadata(metadata)}
        </div>
        {displayData && (
          <pre className="text-sm font-mono text-green-800 dark:text-green-200 whitespace-pre">
            {displayData}
          </pre>
        )}
      </AlertDescription>
    </Alert>
  );
}
