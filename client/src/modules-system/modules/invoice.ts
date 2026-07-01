/**
 * 統一發票模組（台灣）
 *
 * 啟用後可以管理發票號碼簿、記錄發票開立、計算營業稅
 * 適用於有開立統一發票的營業人
 *
 * 注意：這是「管理輔助工具」，不是真正的電子發票上傳系統
 * 上傳到財政部仍需要透過他們的官方平台
 */

import type { ModuleManifest } from '../registry';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS invoice_track (
  id TEXT PRIMARY KEY,
  track TEXT NOT NULL,                 -- 期別 (YYYY-MM)
  start_number TEXT NOT NULL,           -- 起始號碼
  end_number TEXT NOT NULL,             -- 結束號碼
  current_number TEXT NOT NULL,         -- 目前號碼
  invoice_type TEXT NOT NULL DEFAULT 'triple', -- triple(三聯式)/duplicate(二聯式)
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,    -- 完整發票號碼 (e.g., AB-12345678)
  track_id TEXT,
  invoice_date TEXT NOT NULL,
  invoice_type TEXT NOT NULL,             -- triple / duplicate / special
  tax_type TEXT NOT NULL DEFAULT 'taxable', -- taxable / zero / exempt / special
  sales_amount REAL NOT NULL,             -- 銷售額（未稅）
  tax_amount REAL NOT NULL,               -- 營業稅額
  total_amount REAL NOT NULL,             -- 總計
  buyer_name TEXT,                        -- 買受人
  buyer_tax_id TEXT,                      -- 統編
  buyer_address TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'issued',  -- issued / voided / credited
  void_reason TEXT,
  credit_note_number TEXT,                -- 對應折讓單號
  related_resident_id TEXT,
  related_expense_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (track_id) REFERENCES invoice_track(id)
);

CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
`;

export const invoiceManifest: ModuleManifest = {
  id: 'invoice',
  name: '統一發票管理',
  category: 'tax',
  description: '管理發票號碼簿、開立發票、計算營業稅、追蹤折讓。適合有開立統一發票的營業人。',
  defaultEnabled: false,
  schema: SCHEMA,
  routes: [
    { path: '/invoices', label: '發票列表', icon: 'Receipt' },
    { path: '/invoices/issue', label: '開立發票', icon: 'Plus' },
    { path: '/invoices/track', label: '號碼簿', icon: 'Hash' },
  ],
  sidebar: [
    { path: '/invoices', label: '統一發票', icon: 'Receipt' },
  ],
  reports: [
    {
      id: 'tax-summary',
      name: '營業稅彙總',
      category: 'custom',
      generate: async ({ startDate, endDate }) => {
        // 動態載入以避免循環依賴
        const { queryAll } = await import('@/storage/database');
        const rows = queryAll<any>(
          `SELECT tax_type, COUNT(*) as count,
             SUM(sales_amount) as total_sales,
             SUM(tax_amount) as total_tax,
             SUM(total_amount) as total
           FROM invoices
           WHERE status = 'issued' AND invoice_date BETWEEN ? AND ?
           GROUP BY tax_type`,
          [startDate, endDate]
        );
        return {
          title: `營業稅彙總（${startDate} ~ ${endDate}）`,
          columns: [
            { key: 'tax_type', label: '課稅別' },
            { key: 'count', label: '張數', type: 'number' },
            { key: 'total_sales', label: '銷售額', type: 'currency' },
            { key: 'total_tax', label: '稅額', type: 'currency' },
            { key: 'total', label: '合計', type: 'currency' },
          ],
          rows,
        };
      },
    },
  ],
  aiCapabilities: [
    {
      name: '查詢發票',
      description: '查詢發票資料',
      examples: ['本月開了幾張發票？', '查 AB-12345678 發票'],
    },
  ],
};
