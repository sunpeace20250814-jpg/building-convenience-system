/**
 * ⚠️ DEPRECATED — useDatabase 已移除
 * ----------------------------------------------------------------------------
 * 此檔案為 V3 時代的瀏覽器資料庫 React Hook。
 *
 * 移除原因（Phase 9）：
 * - useDatabase() 內部呼叫 sql.js WASM + IndexedDB Adapter + FileSystemAccessAdapter
 * - 這三個依賴都已在 Phase 9 移除（見 ERR-014）
 *
 * 新架構（V4）：
 * - 前端不存任何用戶資料
 * - 不需要 useDatabase hook
 * - 模組啟用狀態走 apiClient（見 @/api/settings）
 *
 * 此檔保留為 deprecated stub。
 * 殘留的 useDatabase() 呼叫應：
 * - 完全移除（最常見）
 * - 或改用 @/modules-system/registry + apiClient
 *
 * 詳細錯誤規則：見 V4/ERRORS.md ERR-014
 */

export {}; // 確保是 module
