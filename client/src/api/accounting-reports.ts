/**
 * Accounting Reports API — 會計報表 (Sprint 4)
 *
 * 後端對應: server/src/routes/accounting-reports.ts
 *
 * 提供 4 種標準會計報表:
 *   - Trial Balance (試算表)
 *   - Balance Sheet (資產負債表)
 *   - Income Statement (損益表)
 *   - Cash Flow Statement (現金流量表)
 */

import { apiClient } from '@/lib/apiClient';

// ============================================================
// 類型定義
// ============================================================

export interface TrialBalanceAccount {
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

export interface TrialBalance {
  startDate: string;
  endDate: string;
  accounts: TrialBalanceAccount[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
}

export interface BalanceSheetItem {
  code: string;
  name: string;
  balance: number;
}

export interface BalanceSheet {
  endDate: string;
  assets: { items: BalanceSheetItem[]; total: number };
  liabilities: { items: BalanceSheetItem[]; total: number };
  equity: { items: BalanceSheetItem[]; total: number };
  netIncome: number;
  totalLiabilitiesAndEquity: number;
  balanced: boolean;
}

export interface IncomeStatementItem {
  code: string;
  name: string;
  amount: number;
}

export interface IncomeStatement {
  startDate: string;
  endDate: string;
  revenues: { items: IncomeStatementItem[]; total: number };
  expenses: { items: IncomeStatementItem[]; total: number };
  netIncome: number;
}

export interface CashFlowAccount {
  code: string;
  name: string;
  opening: number;
  closing: number;
}

export interface CashFlowStatement {
  startDate: string;
  endDate: string;
  accounts: CashFlowAccount[];
  totalInflow: number;
  totalOutflow: number;
  netCashFlow: number;
  openingCash: number;
  closingCash: number;
}

// ============================================================
// API 方法
// ============================================================

export const accountingReportsApi = {
  /** 試算表（Trial Balance）*/
  async trialBalance(startDate: string, endDate: string): Promise<TrialBalance> {
    const qs = new URLSearchParams({ startDate, endDate }).toString();
    return apiClient.get<TrialBalance>(`/api/accounting-reports/trial-balance?${qs}`);
  },

  /** 資產負債表（Balance Sheet）*/
  async balanceSheet(endDate: string): Promise<BalanceSheet> {
    const qs = new URLSearchParams({ endDate }).toString();
    return apiClient.get<BalanceSheet>(`/api/accounting-reports/balance-sheet?${qs}`);
  },

  /** 損益表（Income Statement）*/
  async incomeStatement(startDate: string, endDate: string): Promise<IncomeStatement> {
    const qs = new URLSearchParams({ startDate, endDate }).toString();
    return apiClient.get<IncomeStatement>(`/api/accounting-reports/income-statement?${qs}`);
  },

  /** 現金流量表（Cash Flow Statement）*/
  async cashFlow(startDate: string, endDate: string): Promise<CashFlowStatement> {
    const qs = new URLSearchParams({ startDate, endDate }).toString();
    return apiClient.get<CashFlowStatement>(`/api/accounting-reports/cash-flow?${qs}`);
  },
};