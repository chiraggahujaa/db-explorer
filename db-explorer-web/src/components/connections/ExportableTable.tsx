'use client';

import { useState, useEffect, useRef } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TableExportDialog } from './TableExportDialog';
import { type ExportTableData } from '@/utils/tableExport';

interface ExportableTableProps {
  children: React.ReactNode;
}

export function ExportableTable({ children }: ExportableTableProps) {
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [tableData, setTableData] = useState<ExportTableData | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tableRef.current) {
      const table = tableRef.current.querySelector('table');
      if (table) {
        const columns: string[] = [];
        const rows: Record<string, any>[] = [];

        const headers = table.querySelectorAll('thead th');
        headers.forEach((th) => {
          columns.push(th.textContent?.trim() || '');
        });

        const bodyRows = table.querySelectorAll('tbody tr');
        bodyRows.forEach((tr) => {
          const row: Record<string, any> = {};
          const cells = tr.querySelectorAll('td');

          cells.forEach((td, idx) => {
            if (idx < columns.length) {
              row[columns[idx]] = td.textContent?.trim() || '';
            }
          });

          if (Object.keys(row).length > 0) {
            rows.push(row);
          }
        });

        if (columns.length > 0 && rows.length > 0) {
          setTableData({ columns, rows });
        }
      }
    }
  }, [children]);

  const hasData = tableData && tableData.columns.length > 0 && tableData.rows.length > 0;

  return (
    <div className="relative my-2">
      {hasData && (
        <div className="flex justify-end mb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowExportDialog(true)}
            className="h-8 px-3 text-xs gap-1.5 hover:bg-accent"
            title="Export table data"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      )}

      <div ref={tableRef} className="overflow-x-auto">
        {children}
      </div>

      {hasData && tableData && (
        <TableExportDialog
          open={showExportDialog}
          onOpenChange={setShowExportDialog}
          tableData={tableData}
        />
      )}
    </div>
  );
}
