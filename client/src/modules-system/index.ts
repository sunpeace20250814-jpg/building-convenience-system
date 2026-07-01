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
// ★ M-50 修復 (2026-07-01): 會計模組 backend 尚未實作,暫時不 import manifest
// import { doubleEntryManifest, seedDefaultAccounts } from './modules/double-entry';
// import { accountsManifest } from './modules/accounts';
// import { invoiceManifest } from './modules/invoice';
// import { bankReconcileManifest } from './modules/bank-reconcile';
// import { receivablesManifest } from './modules/receivables';
// import { auditManifest } from './modules/audit';
// import { reportingManifest } from './modules/reporting';
// ★ Phase 9：execute/isReady 已從 @/storage/database 移除（V4 不再有本地 SQLite）
import { monitor } from '@/monitoring/core';

// ★ M-50 修復 (2026-07-01): 會計模組 backend 尚未實作,從 ALL_MODULES 移除避免用戶啟用後 crash
//   - accounts / double-entry / invoice / bank-reconcile / receivables / audit / reporting
//   - 全部 stub-driven,點進去就 throw 「storage/database.ts 已棄用」
//   - 待 backend 實作後再放回 ALL_MODULES
const ALL_MODULES: ModuleManifest[] = [
  // 暫時全部禁用 — 待會計模組 backend 實作
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

    // ★ M-50 修復:double-entry module 已停用,seedDefaultAccounts 也已 import 停用
    //   待 backend 實作後再放回 seed 邏輯
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
    // ★ M-50:double-entry 已停用,seedDefaultAccounts 也停用
    // try { seedDefaultAccounts(); } catch {}
  }

  monitor.recordMetric('modules.total', modules.all().length);
  monitor.recordMetric('modules.enabled', modules.enabled().length);
}
