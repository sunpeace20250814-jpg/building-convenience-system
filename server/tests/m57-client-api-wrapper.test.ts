/**
 * 守護測試 — Sprint 5 客戶端 API wrapper
 *
 * 確保:
 *   - client/src/api/accounting.ts 存在
 *   - client/src/api/accounting-reports.ts 存在
 *   - 都有完整方法 + types
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ACCOUNTING_TS = join(__dirname, '../../client/src/api/accounting.ts');
const REPORTS_TS = join(__dirname, '../../client/src/api/accounting-reports.ts');
const INDEX_TS = join(__dirname, '../../client/src/api/index.ts');

describe('M-57 守護 — Sprint 5 client API wrapper', () => {
  it('client/src/api/accounting.ts 存在且 export accountingApi', () => {
    const src = readFileSync(ACCOUNTING_TS, 'utf-8');
    expect(src.length).toBeGreaterThan(0);
    expect(src).toMatch(/export const accountingApi/);
  });

  it('accounting.ts 涵蓋 8 個 method', () => {
    const src = readFileSync(ACCOUNTING_TS, 'utf-8');
    expect(src).toMatch(/listAccounts/);
    expect(src).toMatch(/getAccount/);
    expect(src).toMatch(/createAccount/);
    expect(src).toMatch(/updateAccount/);
    expect(src).toMatch(/deleteAccount/);
    expect(src).toMatch(/listJournalEntries/);
    expect(src).toMatch(/getJournalEntry/);
    expect(src).toMatch(/createJournalEntry/);
    expect(src).toMatch(/postJournalEntry/);
    expect(src).toMatch(/deleteJournalEntry/);
    expect(src).toMatch(/listPeriods/);
    expect(src).toMatch(/createPeriod/);
    expect(src).toMatch(/closePeriod/);
  });

  it('accounting.ts 定義完整 types', () => {
    const src = readFileSync(ACCOUNTING_TS, 'utf-8');
    expect(src).toMatch(/export interface AccountDTO/);
    expect(src).toMatch(/export interface JournalEntryDTO/);
    expect(src).toMatch(/export interface JournalLineDTO/);
    expect(src).toMatch(/export interface AccountingPeriodDTO/);
    expect(src).toMatch(/export type AccountType/);
  });

  it('accounting.ts 用 @/lib/apiClient(非 throw-stub)', () => {
    const src = readFileSync(ACCOUNTING_TS, 'utf-8');
    expect(src).toMatch(/import \{ apiClient \} from '@\/lib\/apiClient'/);
    // 不應 import 任何 storage/database.ts (只在註解裡提到可以)
    const importLines = src.split('\n').filter((l) => l.trim().startsWith('import'));
    expect(importLines.some((l) => /storage\/database/.test(l))).toBe(false);
  });

  it('accounting-reports.ts 存在且涵蓋 4 個報表', () => {
    const src = readFileSync(REPORTS_TS, 'utf-8');
    expect(src.length).toBeGreaterThan(0);
    expect(src).toMatch(/export const accountingReportsApi/);
    expect(src).toMatch(/trialBalance/);
    expect(src).toMatch(/balanceSheet/);
    expect(src).toMatch(/incomeStatement/);
    expect(src).toMatch(/cashFlow/);
  });

  it('accounting-reports.ts 定義完整 types', () => {
    const src = readFileSync(REPORTS_TS, 'utf-8');
    expect(src).toMatch(/export interface TrialBalance/);
    expect(src).toMatch(/export interface BalanceSheet/);
    expect(src).toMatch(/export interface IncomeStatement/);
    expect(src).toMatch(/export interface CashFlowStatement/);
  });

  it('api/index.ts 已 export 兩個新模組', () => {
    const src = readFileSync(INDEX_TS, 'utf-8');
    expect(src).toMatch(/export \* from '\.\/accounting'/);
    expect(src).toMatch(/export \* from '\.\/accounting-reports'/);
  });
});