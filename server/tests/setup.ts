/**
 * Vitest setup — 每個測試檔啟動前：
 * 1. 設定 DATA_DIR 到隔離目錄 ★ 必須在頂層 module load 時設，
 *    因為 db/index.js 在 test file import 時就 load 完
 * 2. 初始化 in-memory DB（用 file-based 模擬因 better-sqlite3 不支援 :memory: 跨 module）
 * 3. 確保 FK ON DELETE 行為
 */
import { beforeEach, afterAll, beforeAll } from 'vitest';
import { mkdirSync, rmSync } from 'fs';
import path from 'path';

// ★ 關鍵：必須在頂層 module load 立刻設 DATA_DIR，
//   否則 db/index.ts 在 test file import 時就會讀到 production 路徑並凍結
// ★ 修正（task001）：尊重 caller 設定的 DATA_DIR（cron / CI 會指定不同位置），
//   只有沒設才 fallback 到預設隔離目錄
const TEST_DATA_DIR = process.env.DATA_DIR || path.resolve('tests/.tmp-data');
process.env.DATA_DIR = TEST_DATA_DIR;

beforeAll(() => {
  mkdirSync(TEST_DATA_DIR, { recursive: true });
});

beforeEach(async () => {
  // ★ 修正:DB 檔名是 resident-system.db（跟 db/index.ts DB_PATH 一致）
  //   舊版用 test-resident-system.db 永遠刪不到檔案，測試其實跑在 production DB 上！
  const dbFile = path.join(TEST_DATA_DIR, 'resident-system.db');
  for (const ext of ['', '-shm', '-wal']) {
    const p = dbFile + ext;
    try { rmSync(p, { force: true }); } catch {}
  }
  // 重新 import 以觸發 initDatabase
  const dbModule = await import('../src/db/index.js');
  await dbModule.initDatabase();
  // 確保 FK 開啟（每次都要，因為 SQLite 預設 OFF）
  dbModule.db.pragma('foreign_keys = ON');
  // 驗證 FK 真的有 ON（避免某些 SQLite 版本 silent ignore）
  const fkStatus = dbModule.db.pragma('foreign_keys', { simple: true });
  if (fkStatus !== 1) {
    throw new Error(`FK pragma not ON, got: ${fkStatus}`);
  }
});

afterAll(() => {
  // 測試結束清掉測試 DB
  try {
    const dbFile = path.join(TEST_DATA_DIR, 'resident-system.db');
    for (const ext of ['', '-shm', '-wal']) {
      const p = dbFile + ext;
      try { rmSync(p, { force: true }); } catch {}
    }
  } catch {}
});