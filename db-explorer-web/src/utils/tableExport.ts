import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExportTableData {
  columns: string[];
  rows: Record<string, any>[];
}

export type ExportFormat = 'csv' | 'xml' | 'pdf';

export async function exportTable(
  data: ExportTableData,
  format: ExportFormat,
  filename: string = 'table-export'
): Promise<void> {
  const handlers: Record<ExportFormat, () => void> = {
    csv: () => exportToCSV(data, filename),
    xml: () => exportToXML(data, filename),
    pdf: () => exportToPDF(data, filename),
  };

  const handler = handlers[format];
  if (!handler) {
    throw new Error(`Unsupported export format: ${format}`);
  }

  handler();
}

function exportToCSV(data: ExportTableData, filename: string): void {
  const { columns, rows } = data;

  const escapeCSV = (value: any): string => {
    if (value === null || value === undefined) {
      return '';
    }

    const stringValue = String(value);

    if (
      stringValue.includes(',') ||
      stringValue.includes('"') ||
      stringValue.includes('\n') ||
      stringValue.includes('\r')
    ) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
  };

  const csvLines: string[] = [];
  csvLines.push(columns.map(escapeCSV).join(','));

  rows.forEach((row) => {
    const rowValues = columns.map((col) => escapeCSV(row[col]));
    csvLines.push(rowValues.join(','));
  });

  const csvContent = csvLines.join('\n');
  downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;');
}

function exportToXML(data: ExportTableData, filename: string): void {
  const { columns, rows } = data;

  const escapeXML = (value: any): string => {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const sanitizeTagName = (name: string): string => {
    return name
      .replace(/[^a-zA-Z0-9_.-]/g, '_')
      .replace(/^[^a-zA-Z_]/, '_');
  };

  const xmlLines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<data>',
  ];

  rows.forEach((row) => {
    xmlLines.push('  <row>');
    columns.forEach((col) => {
      const tagName = sanitizeTagName(col);
      const value = escapeXML(row[col]);
      xmlLines.push(`    <${tagName}>${value}</${tagName}>`);
    });
    xmlLines.push('  </row>');
  });

  xmlLines.push('</data>');

  const xmlContent = xmlLines.join('\n');
  downloadFile(xmlContent, `${filename}.xml`, 'application/xml;charset=utf-8;');
}

function exportToPDF(data: ExportTableData, filename: string): void {
  const { columns, rows } = data;

  const doc = new jsPDF({
    orientation: columns.length > 5 ? 'landscape' : 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Database Query Results', 40, 40);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const timestamp = new Date().toLocaleString();
  doc.text(`Generated: ${timestamp}`, 40, 60);

  const tableRows = rows.map((row) =>
    columns.map((col) => {
      const value = row[col];
      if (value === null || value === undefined) {
        return 'NULL';
      }
      return String(value);
    })
  );

  autoTable(doc, {
    head: [columns],
    body: tableRows,
    startY: 80,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 4,
      overflow: 'linebreak',
      halign: 'left',
    },
    headStyles: {
      fillColor: [71, 85, 105],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { top: 80, right: 40, bottom: 40, left: 40 },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        data.settings.margin.left,
        doc.internal.pageSize.height - 20
      );
    },
  });

  doc.save(`${filename}.pdf`);
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + content], { type: mimeType });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function canExport(data: any): data is ExportTableData {
  return (
    data &&
    typeof data === 'object' &&
    Array.isArray(data.columns) &&
    data.columns.length > 0 &&
    Array.isArray(data.rows)
  );
}

export function generateFilename(prefix: string = 'table-export'): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace(/T/, '_')
    .slice(0, -5);

  return `${prefix}_${timestamp}`;
}
