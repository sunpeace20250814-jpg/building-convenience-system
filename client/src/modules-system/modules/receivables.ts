/**
 * 應收/應付模組
 *
 * 啟用後可以追蹤：
 * - 應收帳款（客戶欠我們的）
 * - 應付帳款（我們欠別人的）
 * - 帳齡分析（30/60/90 天）
 * - 逾期提醒
 */

import type { ModuleManifest } from '../registry';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS receivables (
  id TEXT PRIMARY KEY,
  party_name TEXT NOT NULL,             -- 客戶/對方名稱
  party_tax_id TEXT,                    -- 對方統編
  invoice_id TEXT,                      -- 對應發票
  amount REAL NOT NULL,
  paid_amount REAL DEFAULT 0,
  due_date TEXT NOT NULL,
  issue_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',  -- open / partial / paid / overdue / written_off
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

CREATE TABLE IF NOT EXISTS payables (
  id TEXT PRIMARY KEY,
  party_name TEXT NOT NULL,
  party_tax_id TEXT,
  related_invoice_number TEXT,           -- 對方發票號碼
  amount REAL NOT NULL,
  paid_amount REAL DEFAULT 0,
  due_date TEXT NOT NULL,
  issue_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS receivable_payments (
  id TEXT PRIMARY KEY,
  receivable_id TEXT NOT NULL,
  payment_date TEXT NOT NULL,
  amount REAL NOT NULL,
  method TEXT,                          -- cash / transfer / check / other
  note TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (receivable_id) REFERENCES receivables(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payable_payments (
  id TEXT PRIMARY KEY,
  payable_id TEXT NOT NULL,
  payment_date TEXT NOT NULL,
  amount REAL NOT NULL,
  method TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (payable_id) REFERENCES payables(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_receivables_status ON receivables(status);
CREATE INDEX IF NOT EXISTS idx_receivables_due ON receivables(due_date);
CREATE INDEX IF NOT EXISTS idx_payables_status ON payables(status);
CREATE INDEX IF NOT EXISTS idx_payables_due ON payables(due_date);
`;

export const receivablesManifest: ModuleManifest = {
  id: 'receivables',
  name: '應收/應付帳款',
  category: 'accounting',
  description: '追蹤客戶欠款與我們欠廠商的款項，帳齡分析、逾期提醒。',
  defaultEnabled: false,
  schema: SCHEMA,
  routes: [
    { path: '/receivables', label: '應收帳款', icon: 'TrendingUp' },
    { path: '/payables', label: '應付帳款', icon: 'TrendingDown' },
  ],
  sidebar: [
    { path: '/receivables', label: '應收帳款', icon: 'TrendingUp' },
  ],
  aiCapabilities: [
    {
      name: '帳齡分析',
      description: '分析逾期帳款',
      examples: ['有哪些應收帳款逾期超過 60 天？'],
    },
  ],
};
