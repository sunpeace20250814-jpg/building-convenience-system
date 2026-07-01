/**
 * 報表匯出工具
 * 支援 PDF (jsPDF + autoTable + 中文字型) 與 Excel (SheetJS)
 *
 * 中文字型：使用 build-time subset 的 Noto Sans TC（166KB，915 個常用字）
 * 若需要罕用字，會從 Google Fonts 動態抓取並重新 subset
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { loadBaseFont } from './font';

export interface ReportColumn {
  key: string;
  label: string;
  width?: number; // Excel 用
  format?: (value: any) => string;
}

export interface ReportOptions {
  title: string;
  subtitle?: string;
  columns: ReportColumn[];
  rows: any[];
  filename: string;
  generatedBy?: string;
  meta?: Record<string, string>;
}

const FONT_NAME = 'noto-sans-tc';

// 已註冊的字型快取
const registeredFonts = new Set<string>();

async function ensureChineseFont(doc: jsPDF): Promise<boolean> {
  if (registeredFonts.has(FONT_NAME)) {
    doc.setFont(FONT_NAME);
    return true;
  }

  try {
    const fontBytes = await loadBaseFont();
    // 將 ArrayBuffer 轉 base64
    const bytes = new Uint8Array(fontBytes);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    doc.addFileToVFS(`${FONT_NAME}-Regular.ttf`, base64);
    doc.addFont(`${FONT_NAME}-Regular.ttf`, FONT_NAME, 'normal');
    doc.setFont(FONT_NAME);
    registeredFonts.add(FONT_NAME);
    return true;
  } catch (err) {
    console.warn('中文字型載入失敗，降級用內建字型', err);
    return false;
  }
}

function safe(s: any): string {
  if (s === null || s === undefined) return '';
  return String(s);
}

function formatCell(col: ReportColumn, value: any): string {
  if (col.format) return col.format(value);
  return safe(value);
}

export async function exportPDF(opts: ReportOptions): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const hasChinese = await ensureChineseFont(doc);

  // 標題
  doc.setFontSize(18);
  doc.text(opts.title, 14, 15);

  if (opts.subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(opts.subtitle, 14, 22);
  }

  // Meta
  doc.setFontSize(8);
  doc.setTextColor(120);
  let metaY = 28;
  if (opts.meta) {
    for (const [k, v] of Object.entries(opts.meta)) {
      doc.text(`${k}: ${v}`, 14, metaY);
      metaY += 4;
    }
  }
  doc.text(`產生時間: ${new Date().toLocaleString('zh-TW')}`, 14, metaY);
  if (opts.generatedBy) {
    doc.text(`產生者: ${opts.generatedBy}`, 14, metaY + 4);
  }

  // 表格
  const head = [opts.columns.map((c) => c.label)];
  const body = opts.rows.map((row) => opts.columns.map((c) => formatCell(c, row[c.key])));

  autoTable(doc, {
    startY: metaY + 10,
    head,
    body,
    theme: 'striped',
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      font: FONT_NAME,
    },
    styles: {
      font: FONT_NAME,
      fontSize: hasChinese ? 9 : 8,
      cellPadding: 2,
    },
    margin: { left: 14, right: 14 },
    didDrawPage: () => {
      // 頁尾
      const pageCount = doc.getNumberOfPages();
      const currentPage = doc.getCurrentPageInfo().pageNumber;
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `${currentPage} / ${pageCount}`,
        pageWidth - 20,
        doc.internal.pageSize.getHeight() - 8
      );
      doc.text('大樓住戶系統 V4', 14, doc.internal.pageSize.getHeight() - 8);
    },
  });

  doc.save(`${opts.filename}.pdf`);
}

export function exportExcel(opts: ReportOptions): void {
  const wb = XLSX.utils.book_new();

  const wsData: any[][] = [];
  wsData.push([opts.title]);
  if (opts.subtitle) wsData.push([opts.subtitle]);
  wsData.push([]);

  wsData.push(opts.columns.map((c) => c.label));

  for (const row of opts.rows) {
    wsData.push(opts.columns.map((c) => {
      const v = formatCell(c, row[c.key]);
      const num = Number(v);
      if (!isNaN(num) && v !== '' && /^-?\d+\.?\d*$/.test(v)) return num;
      return v;
    }));
  }

  wsData.push([]);
  wsData.push([`產生時間: ${new Date().toLocaleString('zh-TW')}`]);
  if (opts.generatedBy) wsData.push([`產生者: ${opts.generatedBy}`]);
  if (opts.meta) {
    for (const [k, v] of Object.entries(opts.meta)) {
      wsData.push([`${k}: ${v}`]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws['!cols'] = opts.columns.map((c) => ({ wch: c.width || 15 }));

  if (opts.columns.length > 1) {
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: opts.columns.length - 1 } }];
    if (opts.subtitle) {
      ws['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: opts.columns.length - 1 } });
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, opts.title.slice(0, 30));
  const jsonSheet = XLSX.utils.json_to_sheet(opts.rows);
  XLSX.utils.book_append_sheet(wb, jsonSheet, '原始資料');

  XLSX.writeFile(wb, `${opts.filename}.xlsx`);
}

export function exportCSV(opts: ReportOptions): void {
  const head = opts.columns.map((c) => c.label).join(',');
  const rows = opts.rows.map((r) =>
    opts.columns.map((c) => {
      const v = formatCell(c, r[c.key]);
      if (v.includes(',') || v.includes('"') || v.includes('\n')) {
        return `"${v.replace(/"/g, '""')}"`;
      }
      return v;
    }).join(',')
  );
  const csv = '\uFEFF' + [head, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${opts.filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
