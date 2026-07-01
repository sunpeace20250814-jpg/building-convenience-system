/**
 * ⚠️ DEPRECATED — 瀏覽器端 schema migrations 已移除
 * ----------------------------------------------------------------------------
 * 此檔案為 V3 時代的瀏覽器本地 SQLite schema migrations。
 *
 * 移除原因（Phase 9 / ERR-014）：
 * - V4 已改用 server-side Fastify + better-sqlite3，schema migrations 在 server 端
 * - 瀏覽器端不再持有 SQLite DB（sql.js WASM + IndexedDB 已移除）
 * - server 端 schema 由 server/src/db/schema.ts + server/src/db/migrations.ts 統一管理
 *
 * 此檔保留為 deprecated stub。
 *
 * 詳細錯誤規則：見 V4/ERRORS.md ERR-014
 */

export {};
