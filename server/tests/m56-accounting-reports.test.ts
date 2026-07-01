/**
 * 守護測試 — M-56 修復
 *
 * 會計報表 (Trial Balance / Balance Sheet / Income Statement / Cash Flow)
 * 守護關鍵業務邏輯:
 *   - 借貸必平 (sum(debit) === sum(credit))
 *   - 期初/期末餘額正確
 *   - 只有 posted 狀態的分錄納入計算
 *   - 報表期初/期末合計 = 資產 = 負債 + 權益
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db/index.js';
import { repositories } from '../src/db/repository.js';
import {
  trialBalance,
  balanceSheet,
  incomeStatement,
  cashFlowStatement,
  seedStandardAccounts,
} from '../src/routes/accounting-reports.js';

function uid(): string {
  return `rep-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function setupStandardAccounts() {
  // 先 seed (idempotent)
  seedStandardAccounts();
  // 從 schema seed 已經有的 accounts 拿 ID
  const cash = db.prepare('SELECT id FROM accounts WHERE code = ?').get('1101') as { id: string };
  const bank = db.prepare('SELECT id FROM accounts WHERE code = ?').get('1102') as { id: string };
  const revenue = db.prepare('SELECT id FROM accounts WHERE code = ?').get('4101') as { id: string };
  const expense = db.prepare('SELECT id FROM accounts WHERE code = ?').get('5101') as { id: string };
  if (!cash || !bank || !revenue || !expense) {
    throw new Error('seed accounts missing — run accounting routes first to seed');
  }
  return { cash, bank, revenue, expense };
}

function createPostedEntry(
  date: string,
  lines: Array<{ accountId: string; debit: number; credit: number; memo?: string }>
): string {
  const eid = uid();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO journal_entries (id, entry_date, description, status, posted_at, created_at, updated_at)
     VALUES (?, ?, ?, 'posted', ?, ?, ?)`
  ).run(eid, date, 'test', now, now, now);
  lines.forEach((l, idx) => {
    db.prepare(
      `INSERT INTO journal_lines (id, entry_id, account_id, debit, credit, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(uid(), eid, l.accountId, l.debit, l.credit, idx, now);
  });
  return eid;
}

describe('M-56 守護 — 試算表 (Trial Balance)', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM journal_lines').run();
    db.prepare('DELETE FROM journal_entries').run();
  });

  it('無資料時 totalDebit = 0', () => {
    const result = trialBalance('2026-07-01', '2026-07-31');
    expect(result.totalDebit).toBe(0);
    expect(result.totalCredit).toBe(0);
    expect(result.balanced).toBe(true);
  });

  it('一筆平衡分錄 → 試算表平衡', () => {
    const acc = setupStandardAccounts();
    createPostedEntry('2026-07-15', [
      { accountId: acc.cash.id, debit: 1000, credit: 0 },
      { accountId: acc.revenue.id, debit: 0, credit: 1000 },
    ]);

    const tb = trialBalance('2026-07-01', '2026-07-31');
    expect(tb.totalDebit).toBe(1000);
    expect(tb.totalCredit).toBe(1000);
    expect(tb.balanced).toBe(true);
  });

  it('多筆分錄跨期 → 過濾正確', () => {
    const acc = setupStandardAccounts();
    createPostedEntry('2026-06-15', [
      // 6 月 (不應納入 7 月報表)
      { accountId: acc.cash.id, debit: 500, credit: 0 },
      { accountId: acc.revenue.id, debit: 0, credit: 500 },
    ]);
    createPostedEntry('2026-07-10', [
      { accountId: acc.cash.id, debit: 300, credit: 0 },
      { accountId: acc.revenue.id, debit: 0, credit: 300 },
    ]);

    const tb = trialBalance('2026-07-01', '2026-07-31');
    expect(tb.totalDebit).toBe(300); // 只有 7 月那筆
    expect(tb.totalCredit).toBe(300);
  });

  it('draft 狀態分錄不納入計算', () => {
    const acc = setupStandardAccounts();
    // draft (未過帳)
    const eid = uid();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO journal_entries (id, entry_date, description, status, created_at, updated_at)
       VALUES (?, ?, ?, 'draft', ?, ?)`
    ).run(eid, '2026-07-15', 'draft test', now, now);
    db.prepare(
      `INSERT INTO journal_lines (id, entry_id, account_id, debit, credit, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(uid(), eid, acc.cash.id, 999, 0, 0, now);
    db.prepare(
      `INSERT INTO journal_lines (id, entry_id, account_id, debit, credit, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(uid(), eid, acc.revenue.id, 0, 999, 1, now);

    const tb = trialBalance('2026-07-01', '2026-07-31');
    expect(tb.totalDebit).toBe(0); // draft 不納入
    expect(tb.totalCredit).toBe(0);
  });
});

describe('M-56 守護 — 損益表 (Income Statement)', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM journal_lines').run();
    db.prepare('DELETE FROM journal_entries').run();
  });

  it('收入大於費用 → netIncome > 0', () => {
    const acc = setupStandardAccounts();
    createPostedEntry('2026-07-10', [
      { accountId: acc.cash.id, debit: 1000, credit: 0 },
      { accountId: acc.revenue.id, debit: 0, credit: 1000 },
    ]);
    createPostedEntry('2026-07-15', [
      { accountId: acc.expense.id, debit: 300, credit: 0 },
      { accountId: acc.cash.id, debit: 0, credit: 300 },
    ]);

    const is = incomeStatement('2026-07-01', '2026-07-31');
    expect(is.revenues.total).toBe(1000);
    expect(is.expenses.total).toBe(300);
    expect(is.netIncome).toBe(700);
  });

  it('無資料 → netIncome = 0', () => {
    const is = incomeStatement('2026-07-01', '2026-07-31');
    expect(is.netIncome).toBe(0);
  });
});

describe('M-56 守護 — 資產負債表 (Balance Sheet)', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM journal_lines').run();
    db.prepare('DELETE FROM journal_entries').run();
  });

  it('資產 = 負債 + 權益 + 損益', () => {
    const acc = setupStandardAccounts();
    createPostedEntry('2026-07-15', [
      { accountId: acc.cash.id, debit: 5000, credit: 0 },
      { accountId: acc.revenue.id, debit: 0, credit: 5000 },
    ]);

    const bs = balanceSheet('2026-07-31');
    expect(bs.assets.total).toBe(5000);
    // 沒有負債 / 權益,但 netIncome 5000 應計入權益
    expect(bs.totalLiabilitiesAndEquity).toBe(5000);
    expect(bs.balanced).toBe(true);
  });
});

describe('M-56 守護 — 現金流量表 (Cash Flow Statement)', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM journal_lines').run();
    db.prepare('DELETE FROM journal_entries').run();
  });

  it('現金進出計算正確', () => {
    const acc = setupStandardAccounts();
    createPostedEntry('2026-07-15', [
      { accountId: acc.cash.id, debit: 1000, credit: 0 },
      { accountId: acc.revenue.id, debit: 0, credit: 1000 },
    ]);

    const cf = cashFlowStatement('2026-07-01', '2026-07-31');
    expect(cf.totalInflow).toBe(1000);
    expect(cf.totalOutflow).toBe(0);
    expect(cf.netCashFlow).toBe(1000);
    expect(cf.closingCash).toBe(1000);
  });

  it('無資料 → 現金為 0', () => {
    const cf = cashFlowStatement('2026-07-01', '2026-07-31');
    expect(cf.totalInflow).toBe(0);
    expect(cf.netCashFlow).toBe(0);
    expect(cf.closingCash).toBe(0);
  });
});

describe('M-56 守護 — 報表 routes 已註冊', () => {
  it('routes/accounting-reports.ts export 4 個 functions', () => {
    expect(typeof trialBalance).toBe('function');
    expect(typeof balanceSheet).toBe('function');
    expect(typeof incomeStatement).toBe('function');
    expect(typeof cashFlowStatement).toBe('function');
  });

  it('index.ts 註冊 accountingReportsRoutes', () => {
    const fs = require('fs') as typeof import('fs');
    const src = fs.readFileSync(
      require('path').join(__dirname, '../src/index.ts'),
      'utf-8'
    );
    expect(src).toMatch(/import.*accountingReportsRoutes.*accounting-reports\.js/);
    expect(src).toMatch(/fastify\.register\(accountingReportsRoutes.*\/api\/accounting-reports/);
  });
});