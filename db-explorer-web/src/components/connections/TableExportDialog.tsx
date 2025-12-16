'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, FileCode, FileImage, Loader2, AlertCircle } from 'lucide-react';
import { exportTable, generateFilename, type ExportFormat, type ExportTableData } from '@/utils/tableExport';

interface TableExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableData: ExportTableData;
  defaultFilename?: string;
}

interface FormatOption {
  value: ExportFormat;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    value: 'csv',
    label: 'CSV',
    icon: FileText,
  },
  {
    value: 'xml',
    label: 'XML',
    icon: FileCode,
  },
  {
    value: 'pdf',
    label: 'PDF',
    icon: FileImage,
  },
];

export function TableExportDialog({
  open,
  onOpenChange,
  tableData,
  defaultFilename,
}: TableExportDialogProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setError(null);
    setIsExporting(true);

    try {
      if (!tableData || !tableData.columns || tableData.columns.length === 0) {
        throw new Error('No data available to export');
      }

      const filename = defaultFilename || generateFilename('query-results');
      await exportTable(tableData, selectedFormat, filename);

      onOpenChange(false);

      setTimeout(() => {
        setError(null);
        setSelectedFormat('csv');
      }, 300);
    } catch (err) {
      console.error('Export failed:', err);
      setError(err instanceof Error ? err.message : 'Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCancel = () => {
    if (!isExporting) {
      setError(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader className="space-y-1">
          <DialogTitle>Export Table Data</DialogTitle>
          <DialogDescription>
            {tableData.columns?.length || 0} columns • {tableData.rows?.length || 0} rows
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <RadioGroup
            value={selectedFormat}
            onValueChange={(value) => setSelectedFormat(value as ExportFormat)}
            disabled={isExporting}
            className="space-y-1.5"
          >
            {FORMAT_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <Label
                  key={option.value}
                  htmlFor={option.value}
                  className="flex items-center space-x-2.5 rounded-md border px-3 py-2.5 cursor-pointer transition-colors hover:bg-muted/50 has-[:checked]:bg-muted/50 has-[:checked]:border-primary"
                >
                  <RadioGroupItem
                    value={option.value}
                    id={option.value}
                    className="flex-shrink-0"
                  />
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="font-medium text-sm">{option.label}</span>
                </Label>
              );
            })}
          </RadioGroup>

          {error && (
            <Alert variant="destructive" className="mt-3">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              'Export'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
