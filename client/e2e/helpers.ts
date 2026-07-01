/**
 * E2E 測試 helper
 * 提供共用的 setup、mocking、輔助函式
 */

import type { Page } from '@playwright/test';

/**
 * 模擬 FSA API 不可用，強制使用 OPFS
 * （headless 環境比較穩定）
 */
export async function mockFileSystemUnavailable(page: Page) {
  await page.addInitScript(() => {
    // 移除 showDirectoryPicker
    Object.defineProperty(window, 'showDirectoryPicker', {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });
}

/**
 * 直接在 OPFS / IndexedDB 注入一個預先建立的 SQLite 資料庫
 * 讓測試跳過 FolderPicker
 *
 * 注意：這個比較 hacky，實際 production 流程不適用
 */
export async function skipFolderPickerWithOPFS(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });
}

/** 等到指定的 selector 出現，自動重試最多 N 次 */
export async function waitForReady(page: Page, selector: string, timeout = 10_000) {
  await page.waitForSelector(selector, { state: 'visible', timeout });
}

/** 確認 toast / 通知出現 */
export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.locator('[data-testid="toast"]').filter({ hasText: text })).toBeVisible({ timeout: 5000 });
}
