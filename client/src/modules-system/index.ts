/**
 * 所有內建模組的入口
 * 載入時自動註冊到 moduleRegistry
 *
 * V4 Phase 9：
 * - 移除本地 SQLite 相關的 schema applier / bootstrap（執行個本地 DB 已不存在）
 * - 模組啟用狀態 / schema 套用改走 server-side API（見 server/src/routes/settings.ts 等）
 * - 此檔保留模組註冊功能，向後相容
 */

import { modules, type ModuleManifest } from './registry';
import { doubleEntryManifest, seedDefaultAccounts } from './modules/double-entry';
import { accountsManifest } from './modules/accounts';
import { invoiceManifest } from './modules/invoice';
import { bankReconcileManifest } from './modules/bank-reconcile';
import { receivablesManifest } from './modules/receivables';
import { auditManifest } from './modules/audit';
import { reportingManifest } from './modules/reporting';
// ★ Phase 9：execute/isReady 已從 @/storage/database 移除（V4 不再有本地 SQLite）
import { monitor } from '@/monitoring/core';

const ALL_MODULES: ModuleManifest[] = [
  auditManifest,         // 核心，永遠啟用
  reportingManifest,     // 報表中心
  accountsManifest,      // 多帳戶
  doubleEntryManifest,   // 複式記帳
  invoiceManifest,       // 統一發票
  bankReconcileManifest, // 銀行對帳
  receivablesManifest,   // 應收/應付
];

/** 註冊所有內建模組 */
export function registerBuiltinModules(): void {
  for (const m of ALL_MODULES) {
    modules.register(m);
  }
}

/**
 * 設定 schema 套用器（讓模組啟用時自動建表）
 *
 * ★ Phase 9：V4 不再有本地 SQLite，schema 套用改在 server-side
 *   此處保留 stub 介面但 no-op，呼叫端不會破壞
 */
export function setupModuleSchemaApplier(): void {
  modules.setSchemaApplier((moduleId, _sql) => {
    // server-side schema 套用：略過本地端
    console.log(`[modules-system] schema applier no-op for ${moduleId} (server-side handled)`);

    // 啟用複式記帳時 seed 預設科目（仍嘗試執行，由 stub 函式決定是否可用）
    if (moduleId === 'double-entry') {
      try {
        seedDefaultAccounts();
      } catch (err: any) {
        monitor.recordError('Seed 預設科目失敗', 'modules.seed', 'warn', { error: err });
      }
    }
  });
}

/**
 * 載入已儲存的狀態並套用 schema
 *
 * ★ Phase 9：本地 DB 已移除，isReady() 永遠為 false
 *   改成：直接註冊 + loadFromStorage（不等待 DB），schema 套用由 server-side 處理
 */
export async function bootstrapModules(): Promise<void> {
  // 直接註冊模組（不再等待本地 DB ready）
  registerBuiltinModules();
  setupModuleSchemaApplier();
  modules.loadFromStorage();

  // 對所有啟用的模組，確保 schema 已建立（no-op，server-side 處理）
  for (const m of modules.enabled()) {
    if (m.schema) {
      // Phase 9: 此處改為 server-side schema apply，不再本地 execute
      // server 端會在模組啟用時自動建立 schema
    }
  }

  // 啟用複式記帳時 seed（server-side 處理）
  if (modules.isEnabled('double-entry')) {
    try { seedDefaultAccounts(); } catch {}
  }

  monitor.recordMetric('modules.total', modules.all().length);
  monitor.recordMetric('modules.enabled', modules.enabled().length);
}
