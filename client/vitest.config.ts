/**
 * Vitest 配置
 *
 * AI 友善說明：
 * - 用 jsdom 模擬瀏覽器環境
 * - 自動找出 *.test.ts / *.test.tsx / *.spec.ts / *.spec.tsx
 * - 排除 e2e/、node_modules/、dist/
 *
 * 跑測試：
 *   pnpm test         # 跑一次
 *   pnpm test:watch   # watch 模式
 *   pnpm test:cov     # 覆蓋率報告
 */

/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/**/index.ts',          // entry points 通常不含邏輯
        'src/test/**',
        'src/types/**',
        'src/**/*.d.ts',
      ],
      thresholds: {
        // 起步門檻較低，逐步提高
        lines: 50,
        functions: 50,
        branches: 50,
        statements: 50,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});