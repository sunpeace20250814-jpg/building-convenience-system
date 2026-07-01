/**
 * 銀行對帳模組
 *
 * 啟用後可以：
 * - 記錄銀行/月結單交易
 * - 標記對帳狀態（未對/已對/差異）
 * - 產生對帳報表
 */

import type { ModuleManifest } from '../registry';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS bank_statements (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  statement_date TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  opening_balance REAL NOT NULL,
  closing_balance REAL NOT NULL,
  total_deposits REAL DEFAULT 0,
  total_withdrawals REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending / in_progress / reconciled / discrepancy
  note TEXT,
  imported_at TEXT NOT NULL,
  reconciled_at TEXT
);

CREATE TABLE IF NOT EXISTS bank_statement_lines (
  id TEXT PRIMARY KEY,
  statement_id TEXT NOT NULL,
  transaction_date TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,                  -- 正為存入，負為支出
  balance REAL,
  check_number TEXT,
  matched_journal_entry_id TEXT,        -- 對應的分錄
  matched_at TEXT,
  match_status TEXT NOT NULL DEFAULT 'unmatched', -- unmatched / matched / manual / skipped
  FOREIGN KEY (statement_id) REFERENCES bank_statements(id) ON DELETE CASCADE,
  FOREIGN KEY (matched_journal_entry_id) REFERENCES journal_entries(id)
);

CREATE INDEX IF NOT EXISTS idx_bank_lines_status ON bank_statement_lines(match_status);
CREATE INDEX IF NOT EXISTS idx_bank_lines_date ON bank_statement_lines(transaction_date);
`;

export const bankReconcileManifest: ModuleManifest = {
  id: 'bank-reconcile',
  name: '銀行對帳',
  category: 'banking',
  description: '匯入銀行月結單、與系統記錄比對、標記對帳狀態、產生差異報表。',
  defaultEnabled: false,
  requires: ['accounts'], // 依賴多帳戶模組
  schema: SCHEMA,
  routes: [
    { path: '/bank-reconcile', label: '對帳', icon: 'Scale' },
    { path: '/bank-reconcile/statements', label: '月結單', icon: 'FileText' },
  ],
  sidebar: [
    { path: '/bank-reconcile', label: '銀行對帳', icon: 'Scale' },
  ],
};
