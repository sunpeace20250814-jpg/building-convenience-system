/**
 * E2E 測試 2: UI 導航
 * 確認 Sidebar 結構正確，路由切換正常
 */

import { test, expect } from '@playwright/test';

test.describe('UI 導航', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // 等待主畫面載入（IndexedDB init 完成）
    await expect(page.getByRole('navigation')).toBeVisible({ timeout: 15_000 });
  });

  test('Sidebar 顯示所有核心導航項目', async ({ page }) => {
    const nav = page.getByRole('navigation');
    await expect(nav).toBeVisible();

    // 業務核心
    await expect(nav.getByRole('link', { name: /住戶管理/ })).toBeVisible();
    await expect(nav.getByRole('link', { name: /記帳系統/ })).toBeVisible();
    await expect(nav.getByRole('link', { name: /班表日曆/ })).toBeVisible();
    await expect(nav.getByRole('link', { name: /公告/ })).toBeVisible();
    await expect(nav.getByRole('link', { name: /資料備份/ })).toBeVisible();

    // 工具
    await expect(nav.getByRole('link', { name: /監測系統/ })).toBeVisible();
  });

  test('點擊導航連結可切換路由', async ({ page }) => {
    // 點「班表日曆」
    await page.getByRole('link', { name: /班表日曆/ }).click();
    await expect(page).toHaveURL(/\/schedule/);

    // 點「記帳系統」
    await page.getByRole('link', { name: /記帳系統/ }).click();
    await expect(page).toHaveURL(/\/expenses/);
  });
});

test.describe('頁面標題', () => {
  test('首頁 title 包含 V4 大樓住戶系統', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/大樓住戶系統/);
  });
});
