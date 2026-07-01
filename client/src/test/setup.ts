/**
 * 測試環境初始化
 * 給所有測試檔的全域 mock 與 polyfill
 */

import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock sql.js（WASM 太大，測試環境不引入）
vi.mock('sql.js', () => ({
  default: vi.fn().mockResolvedValue({
    Database: vi.fn().mockImplementation(() => ({
      exec: vi.fn(),
      prepare: vi.fn(),
      run: vi.fn(),
      export: vi.fn().mockReturnValue(new Uint8Array(0)),
      close: vi.fn(),
    })),
  }),
}));

// Mock IndexedDB（jsdom 內建 indexedDB，但有些功能缺失）
if (typeof global.indexedDB === 'undefined') {
  // simple-idb 或 fake-indexeddb 套件可選用
  // 這裡留空，jsdom 28+ 已有基礎實作
}