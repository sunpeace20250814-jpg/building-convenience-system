/**
 * 報表元件 - 匯出按鈕 + 對話框
 */

import { useState } from 'react';
import { FileText, FileSpreadsheet, FileType, ChevronDown } from 'lucide-react';
import { exportPDF, exportExcel, exportCSV, ReportOptions } from '@/reports/export';
import { Button } from '@/components/ui/Button';

interface ReportButtonProps {
  generate: () => ReportOptions;
  label?: string;
}

export function ReportButton({ generate, label = '匯出報表' }: ReportButtonProps) {
  const [open, setOpen] = useState(false);

  async function handleExport(type: 'pdf' | 'excel' | 'csv') {
    const opts = generate();
    setOpen(false);
    try {
      if (type === 'pdf') await exportPDF(opts);
      else if (type === 'excel') exportExcel(opts);
      else exportCSV(opts);
    } catch (err) {
      console.error('匯出失敗', err);
      alert('匯出失敗：' + (err as Error).message);
    }
  }

  return (
    <div className="relative">
      <Button variant="secondary" onClick={() => setOpen(!open)}>
        <FileText className="w-4 h-4 mr-2" />
        {label}
        <ChevronDown className="w-3 h-3 ml-1" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
            <button
              onClick={() => handleExport('pdf')}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-t flex items-center gap-2"
            >
              <FileType className="w-4 h-4 text-red-600" />
              匯出 PDF
            </button>
            <button
              onClick={() => handleExport('excel')}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4 text-green-600" />
              匯出 Excel
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-b flex items-center gap-2"
            >
              <FileText className="w-4 h-4 text-gray-600" />
              匯出 CSV
            </button>
          </div>
        </>
      )}
    </div>
  );
}
