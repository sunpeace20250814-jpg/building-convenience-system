/**
 * 複式記帳模組 (Double-Entry Accounting)
 *
 * 啟用後自動建立：
 * - accounts（會計科目表）
 * - journal_entries（分錄）
 * - journal_lines（分錄明細，借/貸）
 * - accounting_periods（會計期間）
 * - posting_status（過帳狀態：草稿/已過帳/已沖銷）
 *
 * 事件：
 * - JournalEntryCreated：分錄建立
 * - JournalEntryPosted：分錄過帳
 * - PeriodClosed：期間結帳
 */

import { bus, Events, type ModuleManifest } from '../registry';
import { execute, queryAll, queryOne } from '@/storage/database';
import { monitor } from '@/monitoring/core';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,        -- 科目代碼 (e.g., 1101, 4101)
  name TEXT NOT NULL,                -- 科目名稱
  type TEXT NOT NULL,                -- asset/liability/equity/income/expense
  parent_id TEXT,                    -- 上層科目（支援階層）
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounting_periods (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                -- e.g., "2024-01", "2024-Q1", "2024"
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- open / closed
  closed_at TEXT,
  closed_by TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  entry_date TEXT NOT NULL,
  description TEXT NOT NULL,
  reference TEXT,                    -- 外部參考（如發票號碼）
  status TEXT NOT NULL DEFAULT 'draft', -- draft / posted / reversed
  period_id TEXT,
  source_module TEXT,                -- 從哪個模組觸發（manual/invoice/expense）
  source_id TEXT,                    -- 來源資料 ID
  created_by TEXT,
  created_at TEXT NOT NULL,
  posted_at TEXT,
  reversed_at TEXT,
  FOREIGN KEY (period_id) REFERENCES accounting_periods(id)
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  debit REAL DEFAULT 0,
  credit REAL DEFAULT 0,
  memo TEXT,
  FOREIGN KEY (entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_period ON journal_entries(period_id);

-- 預設會計科目表（台灣中小企業常用）
CREATE TABLE IF NOT EXISTS default_accounts_seeded (
  seeded_at TEXT PRIMARY KEY
);
`;

const DEFAULT_ACCOUNTS = [
  // ===== 資產 =====
  { code: '1101', name: '現金', type: 'asset' },
  { code: '1102', name: '零用金', type: 'asset' },
  { code: '1111', name: '銀行存款', type: 'asset' },
  { code: '1112', name: '郵局存款', type: 'asset' },
  { code: '1121', name: '應收帳款', type: 'asset' },
  { code: '1122', name: '應收票據', type: 'asset' },
  { code: '1131', name: '預付款項', type: 'asset' },
  { code: '1141', name: '存貨', type: 'asset' },
  { code: '1501', name: '土地', type: 'asset' },
  { code: '1502', name: '建築物', type: 'asset' },
  { code: '1503', name: '累計折舊-建築物', type: 'asset' },
  { code: '1504', name: '辦公設備', type: 'asset' },
  { code: '1505', name: '累計折舊-辦公設備', type: 'asset' },
  // ===== 負債 =====
  { code: '2101', name: '應付帳款', type: 'liability' },
  { code: '2102', name: '應付票據', type: 'liability' },
  { code: '2111', name: '短期借款', type: 'liability' },
  { code: '2121', name: '預收款項', type: 'liability' },
  { code: '2131', name: '代收款項', type: 'liability' },
  { code: '2201', name: '長期借款', type: 'liability' },
  { code: '2301', name: '應付薪資', type: 'liability' },
  { code: '2302', name: '應付費用', type: 'liability' },
  // ===== 權益 =====
  { code: '3101', name: '業主資本', type: 'equity' },
  { code: '3102', name: '資本公積', type: 'equity' },
  { code: '3201', name: '保留盈餘', type: 'equity' },
  { code: '3202', name: '本期損益', type: 'equity' },
  // ===== 收入 =====
  { code: '4101', name: '營業收入', type: 'income' },
  { code: '4102', name: '服務收入', type: 'income' },
  { code: '4201', name: '租金收入', type: 'income' },
  { code: '4202', name: '利息收入', type: 'income' },
  { code: '4299', name: '其他收入', type: 'income' },
  // ===== 支出 =====
  { code: '5101', name: '營業成本', type: 'expense' },
  { code: '6101', name: '薪資支出', type: 'expense' },
  { code: '6102', name: '租金支出', type: 'expense' },
  { code: '6103', name: '水電瓦斯費', type: 'expense' },
  { code: '6104', name: '管理費', type: 'expense' },
  { code: '6105', name: '修繕費', type: 'expense' },
  { code: '6106', name: '保險費', type: 'expense' },
  { code: '6107', name: '稅捐', type: 'expense' },
  { code: '6108', name: '文具用品', type: 'expense' },
  { code: '6109', name: '郵電費', type: 'expense' },
  { code: '6110', name: '交通費', type: 'expense' },
  { code: '6111', name: '伙食費', type: 'expense' },
  { code: '6112', name: '折舊', type: 'expense' },
  { code: '6299', name: '其他費用', type: 'expense' },
];

export const doubleEntryManifest: ModuleManifest = {
  id: 'double-entry',
  name: '複式記帳',
  category: 'accounting',
  description: '啟用借貸分錄、會計科目表、損益表/資產負債表/現金流量表。適合需要正規帳的中小企業。',
  defaultEnabled: false,
  schema: SCHEMA,
  routes: [
    { path: '/accounting/chart', label: '會計科目', icon: 'ListTree' },
    { path: '/accounting/journal', label: '分錄', icon: 'BookOpen' },
    { path: '/accounting/reports', label: '財務報表', icon: 'BarChart3' },
    { path: '/accounting/periods', label: '會計期間', icon: 'CalendarRange' },
  ],
  sidebar: [
    { path: '/accounting/chart', label: '會計科目', icon: 'ListTree' },
    { path: '/accounting/journal', label: '分錄', icon: 'BookOpen' },
    { path: '/accounting/reports', label: '財務報表', icon: 'BarChart3' },
  ],
  listens: [Events.ExpenseRecorded, Events.InvoiceIssued],
  reports: [
    {
      id: 'income-statement',
      name: '損益表',
      category: 'income',
      generate: generateIncomeStatement,
    },
    {
      id: 'balance-sheet',
      name: '資產負債表',
      category: 'balance',
      generate: generateBalanceSheet,
    },
    {
      id: 'trial-balance',
      name: '試算表',
      category: 'balance',
      generate: generateTrialBalance,
    },
    {
      id: 'cash-flow',
      name: '現金流量表',
      category: 'cashflow',
      generate: generateCashFlow,
    },
  ],
  aiCapabilities: [
    {
      name: '查詢損益',
      description: '查詢指定期間的損益表',
      examples: ['本季的淨利是多少？', '本月哪些費用超過預算？'],
    },
    {
      name: '查詢科目餘額',
      description: '查詢特定會計科目的當前餘額',
      examples: ['應收帳款總額', '現金帳戶餘額'],
    },
  ],
};

/** 模組啟用時呼叫：seed 預設科目表 */
export function seedDefaultAccounts(): void {
  const seeded = queryOne<any>('SELECT seeded_at FROM default_accounts_seeded LIMIT 1');
  if (seeded) return;

  const now = new Date().toISOString();
  execute('INSERT INTO default_accounts_seeded (seeded_at) VALUES (?)', [now]);

  for (const acc of DEFAULT_ACCOUNTS) {
    const id = `acc-${acc.code}`;
    try {
      execute(
        `INSERT INTO accounts (id, code, name, type, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)`,
        [id, acc.code, acc.name, acc.type, now, now]
      );
    } catch (err: any) {
      // UNIQUE 衝突（已存在），跳過
    }
  }
}

/** 建立分錄（含多筆借貸明細） */
export interface CreateJournalInput {
  entryDate: string;
  description: string;
  reference?: string;
  sourceModule?: string;
  sourceId?: string;
  lines: Array<{
    accountId: string;
    debit?: number;
    credit?: number;
    memo?: string;
  }>;
  autoPost?: boolean; // 是否立即過帳
}

export function createJournalEntry(input: CreateJournalInput): string {
  // 校驗借貸平衡
  const totalDebit = input.lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = input.lines.reduce((s, l) => s + (l.credit || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`借貸不平衡：借 ${totalDebit} ≠ 貸 ${totalCredit}`);
  }

  const id = `je-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const now = new Date().toISOString();

  // 找當期 period
  const period = queryOne<any>(
    `SELECT id FROM accounting_periods WHERE ? BETWEEN start_date AND end_date AND status = 'open' LIMIT 1`,
    [input.entryDate]
  );

  execute(
    `INSERT INTO journal_entries (id, entry_date, description, reference, status, period_id, source_module, source_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, input.entryDate, input.description, input.reference || null,
      input.autoPost ? 'posted' : 'draft',
      period?.id || null,
      input.sourceModule || 'manual', input.sourceId || null, now,
    ]
  );

  for (const line of input.lines) {
    execute(
      `INSERT INTO journal_lines (id, entry_id, account_id, debit, credit, memo) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        `jl-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        id, line.accountId, line.debit || 0, line.credit || 0, line.memo || null,
      ]
    );
  }

  if (input.autoPost) {
    execute('UPDATE journal_entries SET posted_at = ? WHERE id = ?', [now, id]);
    bus.emit(Events.JournalEntryPosted, { id, input });
  }

  bus.emit(Events.JournalEntryCreated, { id, input });
  monitor.increment('accounting.journalEntries', 1, { status: input.autoPost ? 'posted' : 'draft' });
  return id;
}

// ==================== 報表生成 ====================

async function generateIncomeStatement({ startDate, endDate }: { startDate: string; endDate: string }): Promise<any> {
  const rows = queryAll<any>(
    `SELECT a.code, a.name, a.type,
       COALESCE(SUM(jl.debit), 0) as debit,
       COALESCE(SUM(jl.credit), 0) as credit
     FROM accounts a
     LEFT JOIN journal_lines jl ON jl.account_id = a.id
     LEFT JOIN journal_entries je ON je.id = jl.entry_id
       AND je.status = 'posted'
       AND je.entry_date BETWEEN ? AND ?
     WHERE a.type IN ('income', 'expense') AND a.is_active = 1
     GROUP BY a.id
     ORDER BY a.type, a.code`,
    [startDate, endDate]
  );

  let totalIncome = 0;
  let totalExpense = 0;
  const incomeRows: any[] = [];
  const expenseRows: any[] = [];

  for (const r of rows) {
    const balance = r.type === 'income' ? (r.credit - r.debit) : (r.debit - r.credit);
    if (r.type === 'income') {
      totalIncome += balance;
      if (balance !== 0) incomeRows.push({ code: r.code, name: r.name, amount: balance });
    } else {
      totalExpense += balance;
      if (balance !== 0) expenseRows.push({ code: r.code, name: r.name, amount: balance });
    }
  }

  const netIncome = totalIncome - totalExpense;

  return {
    title: `損益表（${startDate} ~ ${endDate}）`,
    columns: [
      { key: 'code', label: '代碼' },
      { key: 'name', label: '科目' },
      { key: 'amount', label: '金額', type: 'currency' },
    ],
    rows: [
      { section: '營業收入' },
      ...incomeRows,
      { total: '收入合計', amount: totalIncome },
      { section: '營業費用' },
      ...expenseRows,
      { total: '費用合計', amount: totalExpense },
      { total: '本期損益', amount: netIncome, isNet: true },
    ],
    summary: { totalIncome, totalExpense, netIncome },
  };
}

async function generateBalanceSheet({ endDate }: { endDate: string; startDate: string }): Promise<any> {
  // 計算各科目到 endDate 的餘額
  const accounts = queryAll<any>(
    `SELECT a.code, a.name, a.type,
       COALESCE(SUM(jl.debit), 0) as debit,
       COALESCE(SUM(jl.credit), 0) as credit
     FROM accounts a
     LEFT JOIN journal_lines jl ON jl.account_id = a.id
     LEFT JOIN journal_entries je ON je.id = jl.entryid AND je.status = 'posted' AND je.entry_date <= ?
     WHERE a.is_active = 1
     GROUP BY a.id
     ORDER BY a.type, a.code`,
    [endDate]
  );

  // ... 簡化版
  return {
    title: `資產負債表（${endDate}）`,
    columns: [
      { key: 'code', label: '代碼' },
      { key: 'name', label: '科目' },
      { key: 'amount', label: '餘額', type: 'currency' },
    ],
    rows: accounts.map((a) => ({
      code: a.code,
      name: a.name,
      amount: a.type === 'asset' || a.type === 'expense' ? a.debit - a.credit : a.credit - a.debit,
    })),
  };
}

async function generateTrialBalance({ startDate, endDate }: { startDate: string; endDate: string }): Promise<any> {
  const accounts = queryAll<any>(
    `SELECT a.code, a.name, a.type,
       COALESCE(SUM(jl.debit), 0) as debit,
       COALESCE(SUM(jl.credit), 0) as credit
     FROM accounts a
     LEFT JOIN journal_lines jl ON jl.account_id = a.id
     LEFT JOIN journal_entries je ON je.id = jl.entry_id AND je.status = 'posted' AND je.entry_date BETWEEN ? AND ?
     WHERE a.is_active = 1
     GROUP BY a.id
     HAVING debit > 0 OR credit > 0
     ORDER BY a.code`,
    [startDate, endDate]
  );

  let totalDebit = 0;
  let totalCredit = 0;
  const rows = accounts.map((a) => {
    totalDebit += a.debit;
    totalCredit += a.credit;
    return { code: a.code, name: a.name, debit: a.debit, credit: a.credit };
  });

  return {
    title: `試算表（${startDate} ~ ${endDate}）`,
    columns: [
      { key: 'code', label: '代碼' },
      { key: 'name', label: '科目' },
      { key: 'debit', label: '借方', type: 'currency' },
      { key: 'credit', label: '貸方', type: 'currency' },
    ],
    rows,
    summary: { totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 },
  };
}

async function generateCashFlow({ startDate, endDate }: { startDate: string; endDate: string }): Promise<any> {
  // 簡化：列出所有 cash account 的變動
  const cashAccounts = queryAll<any>(
    `SELECT id, code, name FROM accounts WHERE type = 'asset' AND code IN ('1101', '1102', '1111', '1112')`
  );

  const rows: any[] = [];
  let totalIn = 0;
  let totalOut = 0;

  for (const acc of cashAccounts) {
    const movements = queryAll<any>(
      `SELECT je.entry_date, je.description, jl.debit, jl.credit
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.entry_id
       WHERE jl.account_id = ? AND je.status = 'posted' AND je.entry_date BETWEEN ? AND ?
       ORDER BY je.entry_date`,
      [acc.id, startDate, endDate]
    );

    let balance = 0;
    for (const m of movements) {
      balance += m.debit - m.credit;
      if (m.debit > 0) totalIn += m.debit;
      else totalOut += m.credit;
      rows.push({
        date: m.entry_date,
        account: acc.name,
        description: m.description,
        in: m.debit,
        out: m.credit,
        balance,
      });
    }
  }

  return {
    title: `現金流量表（${startDate} ~ ${endDate}）`,
    columns: [
      { key: 'date', label: '日期', type: 'string' },
      { key: 'account', label: '帳戶', type: 'string' },
      { key: 'description', label: '說明', type: 'string' },
      { key: 'in', label: '流入', type: 'currency' },
      { key: 'out', label: '流出', type: 'currency' },
      { key: 'balance', label: '餘額', type: 'currency' },
    ],
    rows,
    summary: { totalIn, totalOut, net: totalIn - totalOut },
  };
}
