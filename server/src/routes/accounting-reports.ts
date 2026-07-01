/**
 * Accounting Reports Routes — M-56 (2026-07-01)
 *
 * Provides 4 standard accounting reports:
 *   - Trial Balance (試算表) — 驗證借貸是否平衡
 *   - Balance Sheet (資產負債表) — 期末快照
 *   - Income Statement (損益表) — 期間收支
 *   - Cash Flow Statement (現金流量表) — 期間現金進出
 *
 * Business logic:
 *   - Only include posted (status='posted') entries
 *   - Period filter based on entry_date
 *   - Opening balance = all posted entries before start_date
 */

import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';

interface ReportRequest {
  startDate: string;
  endDate: string;
}

function validateReportReq(q: any): ReportRequest | null {
  if (!q || typeof q.startDate !== 'string' || typeof q.endDate !== 'string') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(q.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(q.endDate)) {
    return null;
  }
  return { startDate: q.startDate, endDate: q.endDate };
}

interface AccountBalance {
  accountId: string;
  code: string;
  name: string;
  type: string;
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  closingDebit: number;
  closingCredit: number;
}

/** Seed standard accounting accounts (idempotent) */
export function seedStandardAccounts(): void {
  // 檢查是否已有正確的 seed accounts (用 code + name 雙重確認)
  const requiredCodes = ['1101', '1102', '1201', '2101', '3101', '4101', '4102', '5101', '5102', '5103', '5104'];
  const placeholders = requiredCodes.map(() => '?').join(',');
  const existing = db.prepare(
    `SELECT code, name FROM accounts WHERE code IN (${placeholders})`
  ).all(...requiredCodes) as Array<{ code: string; name: string }>;

  // 如果所有 11 個都齊全且 name 正確,就 skip
  if (existing.length === requiredCodes.length) {
    const allValid = existing.every((a) => {
      const expected: Record<string, string> = {
        '1101': 'Cash', '1102': 'Bank Deposit', '1201': 'Accounts Receivable',
        '2101': 'Accounts Payable', '3101': 'Retained Earnings',
        '4101': 'Management Fee Income', '4102': 'Other Income',
        '5101': 'Cleaning Expense', '5102': 'Maintenance Expense',
        '5103': 'Utility Expense', '5104': 'Staff Salary Expense',
      };
      return expected[a.code] === a.name;
    });
    if (allValid) return;
  }

  // 刪掉 corrupted accounts (m55 test 留下的 code==name garbage)
  db.prepare('DELETE FROM accounts WHERE code IN (\'1101\', \'1102\', \'1201\', \'2101\', \'3101\', \'4101\', \'4102\', \'5101\', \'5102\', \'5103\', \'5104\')').run();

  const now = new Date().toISOString();
  const seed = [
    { code: '1101', name: 'Cash', type: 'asset' },
    { code: '1102', name: 'Bank Deposit', type: 'asset' },
    { code: '1201', name: 'Accounts Receivable', type: 'asset' },
    { code: '2101', name: 'Accounts Payable', type: 'liability' },
    { code: '3101', name: 'Retained Earnings', type: 'equity' },
    { code: '4101', name: 'Management Fee Income', type: 'revenue' },
    { code: '4102', name: 'Other Income', type: 'revenue' },
    { code: '5101', name: 'Cleaning Expense', type: 'expense' },
    { code: '5102', name: 'Maintenance Expense', type: 'expense' },
    { code: '5103', name: 'Utility Expense', type: 'expense' },
    { code: '5104', name: 'Staff Salary Expense', type: 'expense' },
  ];
  const insert = db.prepare(
    `INSERT INTO accounts (id, code, name, type, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  // 不走 transaction:測試環境 transaction 可能被 test runner 干擾
  for (const r of seed) {
    try {
      insert.run(`${r.code}-${Math.random().toString(36).slice(2, 10)}`, r.code, r.name, r.type, 0, now, now);
    } catch (e) {
      // ignore
    }
  }
}

/** Calculate account balances within a date range */
function computeAccountBalances(startDate: string, endDate: string): AccountBalance[] {
  const rows = db.prepare(`
    SELECT
      a.id as accountId,
      a.code,
      a.name,
      a.type,
      COALESCE(SUM(CASE WHEN je.entry_date < ? AND je.status = 'posted' THEN jl.debit ELSE 0 END), 0) as opening_debit,
      COALESCE(SUM(CASE WHEN je.entry_date < ? AND je.status = 'posted' THEN jl.credit ELSE 0 END), 0) as opening_credit,
      COALESCE(SUM(CASE WHEN je.entry_date >= ? AND je.entry_date <= ? AND je.status = 'posted' THEN jl.debit ELSE 0 END), 0) as period_debit,
      COALESCE(SUM(CASE WHEN je.entry_date >= ? AND je.entry_date <= ? AND je.status = 'posted' THEN jl.credit ELSE 0 END), 0) as period_credit
    FROM accounts a
    LEFT JOIN journal_lines jl ON jl.account_id = a.id
    LEFT JOIN journal_entries je ON je.id = jl.entry_id
    WHERE a.is_active = 1
    GROUP BY a.id, a.code, a.name, a.type
    ORDER BY a.code
  `).all(
    startDate, startDate,
    startDate, endDate,
    startDate, endDate
  ) as any[];

  return rows.map((r) => {
    const openingDebit = Number(r.opening_debit);
    const openingCredit = Number(r.opening_credit);
    const periodDebit = Number(r.period_debit);
    const periodCredit = Number(r.period_credit);

    let closingDebit = 0;
    let closingCredit = 0;
    if (r.type === 'asset' || r.type === 'expense') {
      const net = (openingDebit + periodDebit) - (openingCredit + periodCredit);
      if (net >= 0) closingDebit = net;
      else closingCredit = -net;
    } else {
      const net = (openingCredit + periodCredit) - (openingDebit + periodDebit);
      if (net >= 0) closingCredit = net;
      else closingDebit = -net;
    }

    return {
      accountId: r.accountId,
      code: r.code,
      name: r.name,
      type: r.type,
      openingDebit,
      openingCredit,
      periodDebit,
      periodCredit,
      closingDebit,
      closingCredit,
    };
  });
}

/** Trial Balance */
export function trialBalance(startDate: string, endDate: string) {
  const balances = computeAccountBalances(startDate, endDate);
  const totalDebit = balances.reduce((s, b) => s + b.periodDebit, 0);
  const totalCredit = balances.reduce((s, b) => s + b.periodCredit, 0);
  return {
    startDate,
    endDate,
    accounts: balances.filter((b) =>
      b.periodDebit > 0 || b.periodCredit > 0 ||
      b.closingDebit > 0 || b.closingCredit > 0
    ),
    totalDebit,
    totalCredit,
    balanced: Math.abs(totalDebit - totalCredit) < 0.01,
  };
}

/** Balance Sheet (period-end snapshot) */
export function balanceSheet(endDate: string) {
  const balances = computeAccountBalances('1970-01-01', endDate);

  const assets = balances.filter((b) => b.type === 'asset').map((b) => ({
    code: b.code,
    name: b.name,
    balance: b.closingDebit - b.closingCredit,
  }));
  const liabilities = balances.filter((b) => b.type === 'liability').map((b) => ({
    code: b.code,
    name: b.name,
    balance: b.closingCredit - b.closingDebit,
  }));
  const equity = balances.filter((b) => b.type === 'equity').map((b) => ({
    code: b.code,
    name: b.name,
    balance: b.closingCredit - b.closingDebit,
  }));

  const totalRevenue = balances.filter((b) => b.type === 'revenue')
    .reduce((s, b) => s + (b.closingCredit - b.closingDebit), 0);
  const totalExpense = balances.filter((b) => b.type === 'expense')
    .reduce((s, b) => s + (b.closingDebit - b.closingCredit), 0);
  const netIncome = totalRevenue - totalExpense;

  const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + l.balance, 0);
  const totalEquity = equity.reduce((s, e) => s + e.balance, 0);

  return {
    endDate,
    assets: { items: assets, total: totalAssets },
    liabilities: { items: liabilities, total: totalLiabilities },
    equity: { items: equity, total: totalEquity + netIncome },
    netIncome,
    totalLiabilitiesAndEquity: totalLiabilities + totalEquity + netIncome,
    balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity + netIncome)) < 0.01,
  };
}

/** Income Statement (period) */
export function incomeStatement(startDate: string, endDate: string) {
  const balances = computeAccountBalances(startDate, endDate);

  const revenues = balances
    .filter((b) => b.type === 'revenue')
    .map((b) => ({
      code: b.code,
      name: b.name,
      amount: b.periodCredit - b.periodDebit,
    }));
  const expenses = balances
    .filter((b) => b.type === 'expense')
    .map((b) => ({
      code: b.code,
      name: b.name,
      amount: b.periodDebit - b.periodCredit,
    }));

  const totalRevenue = revenues.reduce((s, r) => s + r.amount, 0);
  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
  const netIncome = totalRevenue - totalExpense;

  return {
    startDate,
    endDate,
    revenues: { items: revenues, total: totalRevenue },
    expenses: { items: expenses, total: totalExpense },
    netIncome,
  };
}

/** Cash Flow Statement (period cash movements) */
export function cashFlowStatement(startDate: string, endDate: string) {
  const balances = computeAccountBalances(startDate, endDate);

  const cashAccounts = balances.filter(
    (b) => b.type === 'asset' && (b.code.startsWith('1101') || b.code.startsWith('1102'))
  );

  const inflows = cashAccounts
    .filter((b) => b.periodDebit > 0)
    .map((b) => ({
      code: b.code,
      name: b.name,
      inflow: b.periodDebit,
      outflow: b.periodCredit,
    }));
  const totalInflow = inflows.reduce((s, i) => s + i.inflow, 0);
  const totalOutflow = cashAccounts.reduce((s, b) => s + b.periodCredit, 0);
  const netCashFlow = totalInflow - totalOutflow;

  const openingCash = cashAccounts.reduce(
    (s, b) => s + (b.openingDebit - b.openingCredit),
    0
  );
  const closingCash = openingCash + netCashFlow;

  return {
    startDate,
    endDate,
    accounts: cashAccounts.map((b) => ({
      code: b.code,
      name: b.name,
      opening: b.openingDebit - b.openingCredit,
      closing: b.closingDebit - b.closingCredit,
    })),
    totalInflow,
    totalOutflow,
    netCashFlow,
    openingCash,
    closingCash,
  };
}

export async function accountingReportsRoutes(fastify: FastifyInstance) {
  // Ensure standard accounts exist for report calculations
  seedStandardAccounts();

  // GET /api/accounting-reports/trial-balance
  fastify.get<{ Querystring: any }>('/reports/trial-balance', {
    schema: {
      tags: ['accounting-reports'],
      summary: 'Trial Balance (試算表) — 驗證借貸是否平衡',
      querystring: {
        type: 'object',
        required: ['startDate', 'endDate'],
        properties: {
          startDate: { type: 'string' },
          endDate: { type: 'string' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
  }, async (request, reply) => {
    const req = validateReportReq(request.query);
    if (!req) {
      return reply.code(400).send({ error: 'startDate 與 endDate 必填 (YYYY-MM-DD)' });
    }
    return trialBalance(req.startDate, req.endDate);
  });

  // GET /api/accounting-reports/balance-sheet
  fastify.get<{ Querystring: any }>('/reports/balance-sheet', {
    schema: {
      tags: ['accounting-reports'],
      summary: 'Balance Sheet (資產負債表) — 期末快照',
      querystring: {
        type: 'object',
        required: ['endDate'],
        properties: {
          endDate: { type: 'string' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
  }, async (request, reply) => {
    const q = request.query as { endDate?: string };
    if (!q.endDate || !/^\d{4}-\d{2}-\d{2}$/.test(q.endDate)) {
      return reply.code(400).send({ error: 'endDate 必填 (YYYY-MM-DD)' });
    }
    return balanceSheet(q.endDate);
  });

  // GET /api/accounting-reports/income-statement
  fastify.get<{ Querystring: any }>('/reports/income-statement', {
    schema: {
      tags: ['accounting-reports'],
      summary: 'Income Statement (損益表) — 期間內收入支出',
      querystring: {
        type: 'object',
        required: ['startDate', 'endDate'],
        properties: {
          startDate: { type: 'string' },
          endDate: { type: 'string' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
  }, async (request, reply) => {
    const req = validateReportReq(request.query);
    if (!req) {
      return reply.code(400).send({ error: 'startDate 與 endDate 必填 (YYYY-MM-DD)' });
    }
    return incomeStatement(req.startDate, req.endDate);
  });

  // GET /api/accounting-reports/cash-flow
  fastify.get<{ Querystring: any }>('/reports/cash-flow', {
    schema: {
      tags: ['accounting-reports'],
      summary: 'Cash Flow Statement (現金流量表) — 期間內現金/銀行存款進出',
      querystring: {
        type: 'object',
        required: ['startDate', 'endDate'],
        properties: {
          startDate: { type: 'string' },
          endDate: { type: 'string' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
  }, async (request, reply) => {
    const req = validateReportReq(request.query);
    if (!req) {
      return reply.code(400).send({ error: 'startDate 與 endDate 必填 (YYYY-MM-DD)' });
    }
    return cashFlowStatement(req.startDate, req.endDate);
  });
}
