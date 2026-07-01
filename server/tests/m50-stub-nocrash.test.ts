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

describe('M-50 守護 — 會計模組已從 sidebar 移除', () => {
  // 確保 7 個會計 module manifest 已從 ALL_MODULES 移除
  it('modules-system/index.ts 不應 import 任何會計 module manifest', () => {
    const indexPath = join(
      __dirname,
      '../../client/src/modules-system/index.ts'
    );
    const source = readFileSync(indexPath, 'utf-8');

    // 檢查 import 是否被註解掉
    const imports = source.match(/^import\s+\{[^}]+\}\s+from\s+'\.\/modules\/[^']+'/gm) || [];
    // 只允許 audit / reporting 等已被 disable 的,但不能 import 到 ALL_MODULES
    // 驗證:active import 數量 = 0 (全部用 // 註解掉)
    const activeImports = imports.filter(line => !line.match(/^\s*\/\//));
    expect(activeImports.length).toBe(0);
  });

  it('各會計 module 的 defaultEnabled 應為 false', () => {
    const modules = ['accounts', 'audit', 'reporting'];
    for (const m of modules) {
      const path = join(
        __dirname,
        `../../client/src/modules-system/modules/${m}.ts`
      );
      const source = readFileSync(path, 'utf-8');
      expect(source).toMatch(/defaultEnabled:\s*false/);
    }
  });
});