/**
 * 帳戶模組
 *
 * 啟用後可以管理多個帳戶（現金、銀行、信用卡、儲值卡...）
 * 提供餘額追蹤、轉帳、對帳狀態
 */

import type { ModuleManifest } from '../registry';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS ledger_accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,           -- cash / bank / credit / prepaid / other
  account_number TEXT,           -- 銀行帳號末五碼或信用卡末四碼
  bank_name TEXT,                -- 銀行名稱
  currency TEXT DEFAULT 'TWD',
  opening_balance REAL DEFAULT 0,
  current_balance REAL DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ledger_transfers (
  id TEXT PRIMARY KEY,
  from_account_id TEXT NOT NULL,
  to_account_id TEXT NOT NULL,
  amount REAL NOT NULL,
  transfer_date TEXT NOT NULL,
  fee REAL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (from_account_id) REFERENCES ledger_accounts(id),
  FOREIGN KEY (to_account_id) REFERENCES ledger_accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_transfers_date ON ledger_transfers(transfer_date);
`;

export const accountsManifest: ModuleManifest = {
  id: 'accounts',
  name: '多帳戶管理',
  category: 'accounting',
  description: '管理現金、銀行、信用卡等多個帳戶，追蹤餘額、記錄轉帳。',
  defaultEnabled: true,
  schema: SCHEMA,
  routes: [
    { path: '/accounts', label: '帳戶', icon: 'Wallet' },
    { path: '/accounts/transfers', label: '轉帳', icon: 'ArrowLeftRight' },
  ],
  sidebar: [
    { path: '/accounts', label: '帳戶', icon: 'Wallet' },
  ],
};
