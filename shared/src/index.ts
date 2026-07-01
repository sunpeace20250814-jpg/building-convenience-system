/**
 * ⚠️ DEPRECATED — 此 package 0 consumer (M-19)
 *
 * 從 V4 改寫後此 package 已無任何 source code 引用：
 *   - client/src 不再 import '@v4-resident/shared'
 *   - server/src 不再 import '@v4-resident/shared'
 *
 * 保留原因：
 *   - root package.json 的 build script 還依賴它
 *   - Docker build step 還呼叫 `pnpm --filter @v4-resident/shared run build`
 *   - 完整移除需要先改 build pipeline（Phase 5 task）
 *
 * 短期處理：
 *   - 凍結內容（不再新增 export）
 *   - 新功能請寫在 server/src/domain 或 client/src/types
 *
 * 長期處理（Phase 5）：
 *   - 從 root package.json 移除 shared build step
 *   - 從 Dockerfile 移除 shared build
 *   - 整個 shared/ 目錄刪除
 *
 * 背景：V3 時代用 shared package 集中 type/zod schema，V4 改寫時 service-layer
 * 獨立化後每個 module 自己管理型別，shared 變成孤兒。
 */

console.warn(
  '[DEPRECATED] @v4-resident/shared is no longer used. ' +
  'This package will be removed in a future cleanup. ' +
  'See shared/src/index.ts for migration notes.'
);

// 保留 export（向後相容 — 但 0 consumer）
export * from './types';
export * from './validation';