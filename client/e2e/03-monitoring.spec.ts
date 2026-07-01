/**
 * E2E 測試 3: 監測系統
 * 確認 /monitoring 路由能正確載入 MonitoringModule
 */

import { test, expect } from '@playwright/test';

test.describe('監測系統', () => {
  test.beforeEach(async ({ page }) => {
    // 先到首頁等主畫面 ready（IndexedDB init）
    await page.goto('/');
    await expect(page.getByRole('navigation')).toBeVisible({ timeout: 15_000 });
  });

  test('/monitoring 直接訪問可載入', async ({ page }) => {
    await page.goto('/monitoring');

    // PageHeader 標題「監測系統」
    await expect(page.getByRole('heading', { name: '監測系統' })).toBeVisible({ timeout: 15_000 });

    // 應有 tab 切換
    await expect(page.getByRole('button', { name: '總覽' })).toBeVisible();
  });

  test('從 Sidebar 點擊可進入監測頁', async ({ page }) => {
    await page.getByRole('link', { name: /監測系統/ }).click();
    await expect(page).toHaveURL(/\/monitoring/);
    await expect(page.getByRole('heading', { name: '監測系統' })).toBeVisible({ timeout: 15_000 });
  });
});
