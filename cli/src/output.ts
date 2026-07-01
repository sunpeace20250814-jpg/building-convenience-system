/**
 * 輸出格式化
 * 支援 JSON、Table、CSV 三種格式
 */

import type { HttpClient } from './http.js';
import type { ParsedArgs } from './argparse.js';

export type OutputFormat = 'json' | 'table' | 'csv';

export const output = {
  raw(text: string) {
    console.log(text);
  },

  info(text: string) {
    console.log(`ℹ ${text}`);
  },

  warn(text: string) {
    console.warn(`⚠ ${text}`);
  },

  error(text: string) {
    console.error(`✗ ${text}`);
  },

  result(data: any, format: OutputFormat) {
    if (data === null || data === undefined) return;
    switch (format) {
      case 'json':
        this.json(data);
        break;
      case 'table':
        this.table(data);
        break;
      case 'csv':
        this.csv(data);
        break;
    }
  },

  json(data: any) {
    console.log(JSON.stringify(data, null, 2));
  },

  table(data: any) {
    if (!Array.isArray(data)) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }
    if (data.length === 0) {
      console.log('（空）');
      return;
    }
    const columns = Object.keys(data[0]);
    const rows = data.map((row) => columns.map((c) => formatCell(row[c])));
    const widths = columns.map((c, i) =>
      Math.max(c.length, ...rows.map((r) => String(r[i]).length))
    );

    const pad = (s: string | number, w: number) => String(s).padEnd(w);
    const sep = widths.map((w) => '-'.repeat(w)).join('-+-');

    console.log(columns.map((c, i) => pad(c, widths[i])).join(' | '));
    console.log(sep);
    for (const row of rows) {
      console.log(row.map((c, i) => pad(c, widths[i])).join(' | '));
    }
    console.log(`\n共 ${data.length} 筆`);
  },

  csv(data: any) {
    if (!Array.isArray(data)) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }
    if (data.length === 0) return;
    const columns = Object.keys(data[0]);
    console.log(columns.map(csvEscape).join(','));
    for (const row of data) {
      console.log(columns.map((c) => csvEscape(row[c])).join(','));
    }
  },
};

function formatCell(v: any): string {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'object') return JSON.stringify(v);
  const s = String(v);
  return s.length > 40 ? s.slice(0, 37) + '...' : s;
}

function csvEscape(v: any): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
