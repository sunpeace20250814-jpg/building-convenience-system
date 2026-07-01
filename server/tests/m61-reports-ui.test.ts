/**
 * 守護測試 — M-61 修復 (2026-07-01)
 *
 * 4 種報表 UI + AccountingPeriods UI 從 stub → server-side fetch
 * - FinancialReports.tsx 用 accountingReportsApi
 * - AccountingPeriods.tsx 用 accountingApi (listPeriods/createPeriod/closePeriod)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const FINANCIAL = join(__dirname, '../../client/src/modules-system/pages/FinancialReports.tsx');
const PERIODS = join(__dirname, '../../client/src/modules-system/pages/AccountingPeriods.tsx');

describe('M-61 守護 — 4 報表 UI + AccountingPeriods UI', () => {
  it('FinancialReports.tsx 從 stub → accountingReportsApi', () => {
    const src = readFileSync(FINANCIAL, 'utf-8');
    expect(src).toMatch(/accountingReportsApi/);
    expect(src).toMatch(/from '@\/api\/accounting-reports'/);
    // 去除註解後,不應再用 doubleEntryManifest.reports
    const codeOnly = src
      .split('\n')
      .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      .join('\n');
    expect(codeOnly).not.toMatch(/doubleEntryManifest\.reports/);
    // 4 個報表 method 都有呼叫
    expect(src).toMatch(/accountingReportsApi\.trialBalance/);
    expect(src).toMatch(/accountingReportsApi\.balanceSheet/);
    expect(src).toMatch(/accountingReportsApi\.incomeStatement/);
    expect(src).toMatch(/accountingReportsApi\.cashFlow/);
  });

  it('FinancialReports.tsx 沒有 StubPage import (除註解外)', () => {
    const src = readFileSync(FINANCIAL, 'utf-8');
    const importLines = src.split('\n').filter((l) => l.trim().startsWith('import'));
    expect(importLines.some((l) => /StubPage/.test(l))).toBe(false);
  });

  it('FinancialReports.tsx 不再用 ReportData (已換成強型別)', () => {
    const src = readFileSync(FINANCIAL, 'utf-8');
    expect(src).not.toMatch(/ReportData/);
    // 有 TrialBalance / BalanceSheet / IncomeStatement / CashFlowStatement 強型別
    expect(src).toMatch(/TrialBalance/);
    expect(src).toMatch(/BalanceSheet/);
    expect(src).toMatch(/IncomeStatement/);
    expect(src).toMatch(/CashFlowStatement/);
  });

  it('AccountingPeriods.tsx 從 stub → accountingApi', () => {
    const src = readFileSync(PERIODS, 'utf-8');
    const importLines = src.split('\n').filter((l) => l.trim().startsWith('import'));
    expect(importLines.some((l) => /accountingApi/.test(l))).toBe(true);
    expect(importLines.some((l) => /StubPage/.test(l))).toBe(false);
    expect(src).toMatch(/accountingApi\.listPeriods/);
    expect(src).toMatch(/accountingApi\.createPeriod/);
    expect(src).toMatch(/accountingApi\.closePeriod/);
  });
});