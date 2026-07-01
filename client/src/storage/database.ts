/**
 * ⚠️ DEPRECATED — 瀏覽器本地資料庫層已移除
 * ----------------------------------------------------------------------------
 * 此檔案為 V3 時代的瀏覽器本地 SQLite 適配層（sql.js WASM + IndexedDB + FSA）。
 *
 * 移除原因（Phase 9 / ERR-014）：
 * - sql.js WASM 寫出的 SQLite 格式跟 server-side better-sqlite3 不相容（ERR-002）
 * - IndexedDB 配額 + 跨瀏覽器清空問題
 * - W3C FSA handle 必須存 IndexedDB 才能跨 session 保留（ERR-014）
 * - V4 99% 資料已遷移到 server-side Fastify + better-sqlite3
 *
 * 新架構（V4）：
 * - 所有 CRUD 走 @/lib/apiClient（fetch /api/*）
 * - 前端不存任何用戶資料（除了 localStorage 少量偏好）
 * - 不需要 sql.js / IndexedDB / FileSystemAccess
 *
 * M-50 修復 (2026-07-01)：
 * - 原本 throw-stub 改為 graceful no-op（console.warn + 安全默認值）
 * - 理由:NotificationBell 在 sidebar 一渲染就會 call queryAll,原本會 crash
 * - 7 個模組仍未完整 migrate 到 server API,但現在 UI 不會 crash
 * - 後續:逐個模組 migrate 後刪除對應 import,最終整個檔案可刪
 *
 * 仍呼叫此 stub 的模組清單（migrate 完即可刪 import）：
 *   - client/src/ai/sql-executor.ts (queryAll)
 *   - client/src/notifications/system.ts (queryAll → 後端需建 notification API)
 *   - client/src/security/field-encryption.ts (queryAll/execute → 後端需建欄位加密 API)
 *   - client/src/storage/backupManager.ts (queryAll/execute → 部分已有 /api/backup-history)
 *   - client/src/storage/appLog.ts (queryAll/execute → 後端需建 app_log API)
 *   - client/src/modules-system/modules/double-entry.ts (整個模組待實作 backend)
 *   - client/src/modules-system/modules/invoice.ts (整個模組待實作 backend)
 *   - client/src/modules-system/modules/reporting.ts (整個模組待實作 backend)
 *   - client/src/modules-system/pages/JournalEntries.tsx (整個會計 UI 待實作)
 *
 * 已完成 migrate（從 TECH_DEBT 移除）：
 *   ✓ client/src/api/decoration-records.ts (走 /api/decoration-records)
 *   ✓ client/src/api/parking-binding.ts (走 /api/parking-binding)
 *   ✓ client/src/api/resident-parking.ts (走 /api/resident-parking)
 *   ✓ client/src/api/resident-emergency-contacts.ts (走 /api/resident-emergency-contacts)
 *   ✓ client/src/lib/onboarding.ts
 *   ✓ client/src/modules/backup/index.tsx
 *   ✓ client/src/modules/settings/StorageSettings.tsx
 *   ✓ client/src/modules/monitoring/index.tsx
 *
 * 詳細錯誤規則：見 V4/ERRORS.md ERR-014, ERR-017
 */

import type { TableName } from './schema';
import { ALL_TABLES as ALL_TABLES_FROM_SCHEMA } from './schema';

// ==================== Re-export from schema (無破壞) ====================

export const ALL_TABLES: readonly TableName[] = ALL_TABLES_FROM_SCHEMA;
export type { TableName };

// ==================== 錯誤輔助 ====================

function deprecationWarn(fnName: string): void {
  // M-50 修復 (2026-07-01): 改 throw 為 console.warn + 安全默認值
  // 原因:仍有 7 個模組 import 此檔,原本 throw 會讓 UI crash (例如 NotificationBell 在 sidebar 一開就 crash)
  // 改為:console.warn 提醒開發者,回傳安全默認值讓 UI 仍能 render
  // 後續:逐步 migrate 到 @/lib/apiClient,移除此 stub 整個檔
  // eslint-disable-next-line no-console
  console.warn(
    `[storage/database.ts] ${fnName}() called but is DEPRECATED — V4 should use @/lib/apiClient. Returning safe default.`
  );
}

/**
 * 通用查詢 — 已被 @/lib/apiClient 取代
 * @deprecated 見 ERR-017
 */
export function queryAll<T = any>(_sql: string, _params: any[] = []): T[] {
  deprecationWarn('queryAll');
  return [];
}

/**
 * 通用單筆查詢 — 已被 @/lib/apiClient 取代
 * @deprecated 見 ERR-017
 */
export function queryOne<T = any>(_sql: string, _params: any[] = []): T | null {
  deprecationWarn('queryOne');
  return null;
}

/**
 * 通用執行（INSERT/UPDATE/DELETE）— 已被 @/lib/apiClient 取代
 * @deprecated 見 ERR-017
 */
export function execute(_sql: string, _params: any[] = []): void {
  deprecationWarn('execute');
}

/**
 * lastInsertRowid — 已被 server-side response.id 取代
 * @deprecated 見 ERR-017
 */
export function lastInsertRowid(): number {
  deprecationWarn('lastInsertRowid');
  return 0;
}

/**
 * 交易 — 已被 server-side 路由取代
 * @deprecated 見 ERR-017
 */
export function transaction<T>(_fn: () => T): T {
  deprecationWarn('transaction');
  // M-50:不執行 callback (避免部分副作用),回傳 undefined
  return undefined as unknown as T;
}

/**
 * 取得底層 Database — 已無底層 db
 * @deprecated 見 ERR-017
 */
export function getDb(): null {
  deprecationWarn('getDb');
  return null;
}

/**
 * DB 是否 ready — 永遠 false（已無本地 DB）
 */
export function isReady(): boolean {
  return false;
}

/**
 * 通用 Repository — 已被 @/lib/apiClient 取代
 * @deprecated 見 ERR-017
 */
export class Repository<T extends { id: string }> {
  constructor(public table: TableName, public idField: string = 'id') {}
  getAll(_orderBy = 'id'): T[] { deprecationWarn('Repository.getAll'); return []; }
  getById(_id: string): T | null { deprecationWarn('Repository.getById'); return null; }
  create(_data: any): T { deprecationWarn('Repository.create'); throw new Error('Repository.create 已停用,請改用 @/lib/apiClient'); }
  update(_id: string, _data: any): T | null { deprecationWarn('Repository.update'); throw new Error('Repository.update 已停用,請改用 @/lib/apiClient'); }
  delete(_id: string): boolean { deprecationWarn('Repository.delete'); return false; }
}

// ==================== 已被完全移除的函式（保留為 graceful no-op）====================
// 以下為 App.tsx / StorageSettings / Onboarding 等模組原本呼叫的函式。
// M-50 修復:由 throw-stub 改為 graceful no-op,確保 UI 不會 crash。

/** @deprecated 見 ERR-017 */
export async function initDefaultStorage(): Promise<{ restored: boolean }> {
  deprecationWarn('initDefaultStorage');
  return { restored: false };
}
/** @deprecated 見 ERR-017 */
export async function switchToFileSystemStorage(): Promise<void> {
  deprecationWarn('switchToFileSystemStorage');
}
/** @deprecated 見 ERR-017 */
export async function switchToIndexedDBStorage(): Promise<void> {
  deprecationWarn('switchToIndexedDBStorage');
}
/** @deprecated 見 ERR-017 */
export async function changeFolder(): Promise<void> {
  deprecationWarn('changeFolder');
}
/** @deprecated 見 ERR-017 */
export function scheduleSave(_immediate = false): void {
  deprecationWarn('scheduleSave');
}
/** @deprecated 見 ERR-017 */
export function exportDatabase(): Uint8Array {
  deprecationWarn('exportDatabase');
  return new Uint8Array(0);
}
/** @deprecated 見 ERR-017 */
export async function importDatabase(_bytes: Uint8Array): Promise<void> {
  deprecationWarn('importDatabase');
}
/** @deprecated 見 ERR-017 */
export function getStorageBackend(): string {
  return 'api'; // 已無本地 backend，統一回 'api'（server-side）
}
/** @deprecated 見 ERR-017 */
export async function getStorageQuota(): Promise<{ usage: number; quota: number } | null> {
  return null;
}
/** @deprecated 見 ERR-017 */
export async function getDatabaseSize(): Promise<number> {
  return 0;
}
/** @deprecated 見 ERR-017 */
export function getLocationDescription(): string | null {
  return null;
}
/** @deprecated 見 ERR-017 */
export function onDatabaseChange(_cb: () => void): () => void {
  return () => {};
}
/** @deprecated 見 ERR-017 */
export function getDatabaseState(): null {
  deprecationWarn('getDatabaseState');
  return null;
}
/** @deprecated 見 ERR-017 */
export async function initSqlJsEngine(): Promise<void> {
  deprecationWarn('initSqlJsEngine');
}

/** @deprecated 見 ERR-017 */
export async function selectFolderAndInit(): Promise<null> {
  deprecationWarn('selectFolderAndInit');
  return null;
}
/** @deprecated 見 ERR-017 */
export async function tryRestorePrevious(): Promise<boolean> {
  deprecationWarn('tryRestorePrevious');
  return false;
}
