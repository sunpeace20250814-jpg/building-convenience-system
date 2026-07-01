/**
 * 守護測試 — M-60 修復 (2026-07-01)
 *
 * 重新啟用會計模組 (Chart of Accounts + Journal Entries UI):
 * - double-entry module manifest defaultEnabled: true
 * - modules-system/index.ts 已 import 並加入 ALL_MODULES
 * - ChartOfAccounts.tsx 從 stub 變真實 UI (用 accountingApi)
 * - JournalEntries.tsx 從 queryAll → fetch /api/accounting/journal-entries
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const MODULES_INDEX = join(__dirname, '../../client/src/modules-system/index.ts');
const DOUBLE_ENTRY = join(__dirname, '../../client/src/modules-system/modules/double-entry.ts');
const CHART_PAGE = join(__dirname, '../../client/src/modules-system/pages/ChartOfAccounts.tsx');
const JOURNAL_PAGE = join(__dirname, '../../client/src/modules-system/pages/JournalEntries.tsx');

describe('M-60 守護 — 會計模組重新啟用', () => {
  it('double-entry.ts 移除 storage/database imports (不再 stub-driven)', () => {
    const src = readFileSync(DOUBLE_ENTRY, 'utf-8');
    expect(src).not.toMatch(/from '@\/storage\/database'/);
    // import lines 內不應有 queryAll/queryOne/execute
    const importLines = src.split('\n').filter((l) => l.trim().startsWith('import'));
    expect(importLines.some((l) => /queryAll/.test(l))).toBe(false);
    expect(importLines.some((l) => /queryOne/.test(l))).toBe(false);
    expect(importLines.some((l) => /\{ execute/.test(l))).toBe(false);
    // 不應再 export throw-stub 函式
    expect(src).not.toMatch(/export function seedDefaultAccounts/);
    expect(src).not.toMatch(/export function createJournalEntry/);
  });

  it('double-entry.ts manifest defaultEnabled = true (server backend 已實作)', () => {
    const src = readFileSync(DOUBLE_ENTRY, 'utf-8');
    expect(src).toMatch(/defaultEnabled:\s*true/);
    // sidebar 至少有 3 個入口 (科目/分錄/報表)
    const sidebarMatch = src.match(/sidebar:\s*\[([\s\S]*?)\]/);
    expect(sidebarMatch).toBeTruthy();
    const sidebar = sidebarMatch![1];
    expect(sidebar).toMatch(/\/accounting\/chart/);
    expect(sidebar).toMatch(/\/accounting\/journal/);
    expect(sidebar).toMatch(/\/accounting\/reports/);
  });

  it('modules-system/index.ts 把 doubleEntryManifest 加回 ALL_MODULES', () => {
    const src = readFileSync(MODULES_INDEX, 'utf-8');
    expect(src).toMatch(/import.*doubleEntryManifest.*double-entry'/);
    expect(src).toMatch(/ALL_MODULES:\s*ModuleManifest\[\]\s*=\s*\[/);
    // ALL_MODULES 內含 doubleEntryManifest
    const allMatch = src.match(/ALL_MODULES:\s*ModuleManifest\[\]\s*=\s*\[([\s\S]*?)\]/);
    expect(allMatch![1]).toMatch(/doubleEntryManifest/);
  });

  it('ChartOfAccounts.tsx 從 stub 變真實 UI (用 accountingApi)', () => {
    const src = readFileSync(CHART_PAGE, 'utf-8');
    expect(src).toMatch(/import.*accountingApi.*accounting/);
    // 不應再用 StubPage
    expect(src).not.toMatch(/StubPage/);
    // 至少要有 listAccounts / createAccount / updateAccount / deleteAccount 呼叫
    expect(src).toMatch(/accountingApi\.listAccounts/);
    expect(src).toMatch(/accountingApi\.createAccount/);
    expect(src).toMatch(/accountingApi\.updateAccount/);
    expect(src).toMatch(/accountingApi\.deleteAccount/);
  });

  it('JournalEntries.tsx 改用 accountingApi (不再用 storage/database)', () => {
    const src = readFileSync(JOURNAL_PAGE, 'utf-8');
    expect(src).toMatch(/import.*accountingApi.*accounting/);
    expect(src).not.toMatch(/from '@\/storage\/database'/);
    expect(src).not.toMatch(/queryAll<any>/);
    expect(src).not.toMatch(/from '@\/modules-system\/modules\/double-entry'/); // 舊 import 來源
    // 用 server API
    expect(src).toMatch(/accountingApi\.listJournalEntries/);
    expect(src).toMatch(/accountingApi\.createJournalEntry/);
    expect(src).toMatch(/accountingApi\.deleteJournalEntry/);
    expect(src).toMatch(/accountingApi\.listAccounts/);
  });
});