/**
 * 守護測試 — M-50 修復
 *
 * 確保 client/src/storage/database.ts stub 不會 throw
 * （原本 throw-stub 會讓 NotificationBell 等 UI 一渲染就 crash）
 *
 * 注意：這是 client-side 邏輯，理論上要用 vitest in jsdom 環境跑
 * 但目前 setup 只在 server-side。先用檔案內容 + 簡易解析守護
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const STUB_PATH = join(
  __dirname,
  '../../client/src/storage/database.ts'
);

describe('M-50 守護 — client storage/database.ts 不再 throw', () => {
  const source = readFileSync(STUB_PATH, 'utf-8');

  it('檔案存在', () => {
    expect(source.length).toBeGreaterThan(0);
  });

  it('不應再 export deprecationError helper（已改為 deprecationWarn）', () => {
    expect(source).not.toMatch(/export function deprecationError/);
  });

  it('不應再 export check function（會 throw）', () => {
    // check() 內部 throw deprecationError,移除避免殘留
    expect(source).not.toMatch(/^export function check\(/m);
  });

  it('應有 deprecationWarn 函式（console.warn 替代 throw）', () => {
    expect(source).toMatch(/function deprecationWarn/);
  });

  it('queryAll stub 應回傳空陣列（不再 throw）', () => {
    expect(source).toMatch(/export function queryAll[\s\S]*?return \[\]/);
  });

  it('queryOne stub 應回傳 null（不再 throw）', () => {
    expect(source).toMatch(/export function queryOne[\s\S]*?return null/);
  });

  it('execute stub 應為 void（不再 throw）', () => {
    expect(source).toMatch(/export function execute\(_sql[\s\S]*?deprecationWarn/);
  });

  it('註解應標示 M-50 修復日期', () => {
    expect(source).toMatch(/M-50 修復 \(2026-07-01\)/);
  });
});

// ★ M-60 修復 (2026-07-01):
//   原本 M-50 有「會計模組已從 sidebar 移除」的守護 (lines 57-84),
//   但 Sprint 7 已重新啟用 double-entry module (server backend 已實作).
//   此守護已過時,改由 M-60 守護取代 (tests/m60-accounting-ui.test.ts).
//   accounts / audit / reporting 等仍 stub-driven,保留 defaultEnabled: false
//   是它們各自的 module manifest 職責,不需 m50 級別的 sidebar 守護.