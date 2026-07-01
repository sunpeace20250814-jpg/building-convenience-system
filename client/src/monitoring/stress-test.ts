/**
 * 壓力測試工具
 *
 * V4 Phase 9 重寫：
 * - 原本直接用本地 SQLite 跑效能測試（getDb() / db.prepare / db.exec / db.export）
 * - Phase 9 已移除本地 SQLite（見 ERR-014）
 * - 此檔保留為 stub，等待 server-side 壓力測試 API 完成
 *
 * 詳細錯誤規則：見 V4/ERRORS.md ERR-014, ERR-017
 */

export interface StressTestResult {
  totalMs: number;
  written: number;
  avgQueryMs: number;
  p95QueryMs: number;
  p50QueryMs: number;
  maxQueryMs: number;
  dbSizeBytes: number;
  bottlenecks: string[];
}

/**
 * 壓力測試（stub）
 *
 * @returns 空結果 + 提示訊息（local-db-removed）
 */
export async function runStressTest(_count = 500): Promise<StressTestResult> {
  console.warn('[stress-test] 本地 SQLite 已移除，需 server-side API 支援（見 ERR-017）');

  return {
    totalMs: 0,
    written: 0,
    avgQueryMs: 0,
    p95QueryMs: 0,
    p50QueryMs: 0,
    maxQueryMs: 0,
    dbSizeBytes: 0,
    bottlenecks: ['local-db-removed: V4 已不再有本地 SQLite，需 server-side 壓力測試 API'],
  };
}
