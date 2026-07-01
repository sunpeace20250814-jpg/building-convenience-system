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
 * 此檔保留為「API 相容 stub」，原因是 13 個模組仍未遷移到 apiClient
 * （見下方 TECH_DEBT 列表 + ERR-017）。
 * Stub 會保留所有原本的 export 名稱，確保 build 通過；
 * 但**執行時呼叫會拋出明確錯誤**，指向 apiClient 遷移方向。
 *
 * TECH_DEBT（13 個未遷移模組 — 見 ERR-017）：
 * 1. client/src/api/decoration-records.ts — queryAll/execute
 * 2. client/src/api/parking-binding.ts — execute
 * 3. client/src/api/resident-parking.ts — queryAll/execute
 * 4. client/src/api/resident-emergency-contacts.ts — queryAll/execute
 * 5. client/src/lib/onboarding.ts — queryAll/execute（已遷移完成）
 * 6. client/src/modules/backup/index.tsx — getLocationDescription
 * 7. client/src/modules/settings/StorageSettings.tsx — switchToFileSystemStorage 等
 * 8. client/src/modules/monitoring/index.tsx — getDb
 * 9. client/src/modules/tutorials/index.tsx — queryAll/execute
 * 10. client/src/modules-system/index.ts — execute/isReady
 * 11. client/src/modules-system/modules/double-entry.ts — execute/queryAll/queryOne
 * 12. client/src/modules-system/modules/reporting.ts — dynamic import queryAll
 * 13. client/src/modules-system/modules/invoice.ts — dynamic import queryAll
 * 14. client/src/modules-system/pages/JournalEntries.tsx — queryAll/execute/transaction
 * 15. client/src/security/field-encryption.ts — queryAll/execute
 * 16. client/src/notifications/system.ts — queryAll
 * 17. client/src/ai/sql-executor.ts — queryAll
 * 18. client/src/monitoring/stress-test.ts — getDb
 * 19. client/src/storage/backupManager.ts — queryAll/execute/exportDatabase/importDatabase
 * 20. client/src/storage/appLog.ts — queryAll/execute
 *
 * 詳細錯誤規則：見 V4/ERRORS.md ERR-014, ERR-017
 */

import type { TableName } from './schema';
import { ALL_TABLES as ALL_TABLES_FROM_SCHEMA } from './schema';

// ==================== Re-export from schema (無破壞) ====================

export const ALL_TABLES: readonly TableName[] = ALL_TABLES_FROM_SCHEMA;
export type { TableName };

// ==================== 錯誤輔助 ====================

function deprecationError(fnName: string): Error {
  return new Error(
    `[storage] ${fnName}() 已棄用 — V4 已改用 @/lib/apiClient 走 server-side SQLite。\n` +
    `本檔為 throw-stub，呼叫會拋錯。\n` +
    `請遷移：見 V4/ERRORS.md ERR-017。`
  );
}

function check(fnName: string): never {
  throw deprecationError(fnName);
}

// ==================== Stub exports (build compat only) ====================

/**
 * 通用查詢 — 已被 @/lib/apiClient 取代
 * @deprecated 見 ERR-017
 */
export function queryAll<T = any>(_sql: string, _params: any[] = []): T[] {
  check('queryAll');
}

/**
 * 通用單筆查詢 — 已被 @/lib/apiClient 取代
 * @deprecated 見 ERR-017
 */
export function queryOne<T = any>(_sql: string, _params: any[] = []): T | null {
  check('queryOne');
}

/**
 * 通用執行（INSERT/UPDATE/DELETE）— 已被 @/lib/apiClient 取代
 * @deprecated 見 ERR-017
 */
export function execute(_sql: string, _params: any[] = []): void {
  check('execute');
}

/**
 * lastInsertRowid — 已被 server-side response.id 取代
 * @deprecated 見 ERR-017
 */
export function lastInsertRowid(): number {
  check('lastInsertRowid');
  return 0;
}

/**
 * 交易 — 已被 server-side 路由取代
 * @deprecated 見 ERR-017
 */
export function transaction<T>(_fn: () => T): T {
  check('transaction');
}

/**
 * 取得底層 Database — 已無底層 db
 * @deprecated 見 ERR-017
 */
export function getDb(): never {
  check('getDb');
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
  getAll(_orderBy = 'id'): T[] { check('Repository.getAll'); }
  getById(_id: string): T | null { check('Repository.getById'); }
  create(_data: any): T { check('Repository.create'); }
  update(_id: string, _data: any): T | null { check('Repository.update'); }
  delete(_id: string): boolean { check('Repository.delete'); }
}

// ==================== 已被完全移除的函式（保留為 throw-stub）====================
// 以下為 App.tsx / StorageSettings / Onboarding 等模組原本呼叫的函式。
// Phase 9 移除；任何殘留 import 會在執行時拋錯。

/** @deprecated 見 ERR-017 */
export async function initDefaultStorage(): Promise<{ restored: boolean }> {
  check('initDefaultStorage');
}
/** @deprecated 見 ERR-017 */
export async function switchToFileSystemStorage(): Promise<void> {
  check('switchToFileSystemStorage');
}
/** @deprecated 見 ERR-017 */
export async function switchToIndexedDBStorage(): Promise<void> {
  check('switchToIndexedDBStorage');
}
/** @deprecated 見 ERR-017 */
export async function changeFolder(): Promise<void> {
  check('changeFolder');
}
/** @deprecated 見 ERR-017 */
export function scheduleSave(_immediate = false): void {
  check('scheduleSave');
}
/** @deprecated 見 ERR-017 */
export function exportDatabase(): Uint8Array {
  check('exportDatabase');
  return new Uint8Array(0);
}
/** @deprecated 見 ERR-017 */
export async function importDatabase(_bytes: Uint8Array): Promise<void> {
  check('importDatabase');
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
export function getDatabaseState(): never {
  check('getDatabaseState');
}
/** @deprecated 見 ERR-017 */
export async function initSqlJsEngine(): Promise<void> {
  check('initSqlJsEngine');
}

/** @deprecated 見 ERR-017 */
export async function selectFolderAndInit(): Promise<any> {
  check('selectFolderAndInit');
}
/** @deprecated 見 ERR-017 */
export async function tryRestorePrevious(): Promise<boolean> {
  check('tryRestorePrevious');
  return false;
}
