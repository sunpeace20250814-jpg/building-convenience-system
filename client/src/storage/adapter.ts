/**
 * ⚠️ DEPRECATED — 已廢棄
 * ----------------------------------------------------------------------------
 * 此檔案為 V3 時代的瀏覽器本地儲存適配層。
 *
 * 移除原因（Phase 9）：
 * - W3C File System Access API（showDirectoryPicker）只能在 Chrome/Edge 使用
 * - OPFS（navigator.storage.getDirectory）跨瀏覽器支援差
 * - FSA handle 必須存 IndexedDB 才能跨 session 保留（與「不用 IDB」目標衝突）
 *
 * 新架構（V4 Phase 2+）：
 * - 純前端 React + Fastify 後端
 * - 用戶資料完全在 server-side SQLite（better-sqlite3）
 * - 99% API 走 /api/* REST，前端不需任何本地持久化
 * - 唯一本地儲存只剩 localStorage（少量偏好設定）
 *
 * 此檔保留為 deprecated stub，避免殘留 import 破壞 build。
 * 任何引用 StorageAdapter / createStorageAdapter / DB_FILE_NAME 的程式碼都應：
 * - 完全刪除（如果只是過渡引用）
 * - 或改用 apiClient（推薦）
 *
 * 詳細錯誤規則：見 V4/ERRORS.md ERR-014
 */

export {}; // 確保是 module，避免 ambient declarations 汙染全域
