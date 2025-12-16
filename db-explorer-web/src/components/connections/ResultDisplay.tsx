'use client';

import React, { useState } from 'react';
import { parseToolResult, formatMetadata, type ParsedResult } from '@/utils/resultParser';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, Database, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TableExportDialog } from './TableExportDialog';
import { canExport, type ExportTableData } from '@/utils/tableExport';

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

function TableResultView({ data, metadata }: { data: any; metadata?: ParsedResult['metadata'] }) {
  const [showExportDialog, setShowExportDialog] = useState(false);

  if (!data || !data.columns || !data.rows) {
    return <TextResultView data="Invalid table data" />;
  }

  const { columns, rows } = data;

  const exportData: ExportTableData = { columns, rows };
  const canExportData = canExport(exportData);

  return (
    <div className="space-y-2">
      {canExportData && rows.length > 0 && (
        <div className="flex items-center justify-between min-h-[1.75rem]">
          <div className="text-xs text-muted-foreground">
            {metadata && formatMetadata(metadata)}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowExportDialog(true)}
            className="h-8 px-3 text-xs gap-1.5 hover:bg-accent flex-shrink-0"
            title="Export table data"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      )}

      {!canExportData && metadata && (
        <div className="text-xs text-muted-foreground">
          {formatMetadata(metadata)}
        </div>
      )}

      <div className="border rounded-md max-h-96 overflow-auto relative">
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

      {canExportData && (
        <TableExportDialog
          open={showExportDialog}
          onOpenChange={setShowExportDialog}
          tableData={exportData}
        />
      )}
    </div>
  );
}

function TextResultView({ data, metadata }: { data: string; metadata?: ParsedResult['metadata'] }) {
  const lines = data.split('\n').filter(line => line.trim());
  const isBulletedList = lines.length > 1 && lines.slice(1).every(line =>
    line.trim().startsWith('•') || line.trim().startsWith('-')
  );

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

function ErrorResultView({ data }: { data: string }) {
  const parseError = (errorText: string) => {
    const cleaned = errorText.replace(/^Tables in [^:]+:\s*/i, '');

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
