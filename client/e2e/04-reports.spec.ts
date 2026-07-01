/**
 * E2E 測試 4: 報表 / 住戶頁
 * 確認 /residents 路由能正確載入 ResidentsModule
 */

import { test, expect } from '@playwright/test';

test.describe('住戶管理', () => {
  test('直接訪問 /residents 可載入', async ({ page }) => {
    await page.goto('/');
    // 等主畫面 ready
    await expect(page.getByRole('navigation')).toBeVisible({ timeout: 15_000 });

    // 訪問住戶頁
    await page.goto('/residents');

    // 不應崩潰：Navigation 仍在
    await expect(page.getByRole('navigation')).toBeVisible({ timeout: 15_000 });

    // URL 正確
    await expect(page).toHaveURL(/\/residents/);
  });
});
