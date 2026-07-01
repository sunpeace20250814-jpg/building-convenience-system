/**
 * E2E 測試 1: 應用程式啟動
 *
 * 驗證 Vite dev server 啟動後，應用能成功完成 IndexedDB 自動初始化
 * 並渲染主畫面（Sidebar + 路由）。這是後續所有測試的基礎。
 */

import { test, expect } from '@playwright/test';

test.describe('應用程式啟動', () => {
  test('首頁 title 正確', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/大樓住戶系統/);
  });

  test('主畫面渲染成功（IndexedDB 自動 init）', async ({ page }) => {
    await page.goto('/');

    // Sidebar 應出現（IndexedDB 自動 init 成功 → 進入主畫面）
    await expect(page.getByRole('navigation')).toBeVisible({ timeout: 15_000 });

    // Sidebar Logo 標題
    await expect(page.locator('h1').filter({ hasText: /住戶系統/ }).first()).toBeVisible();
  });

  test('顯示隱私聲明（透過設定頁進入 storage 區塊）', async ({ page }) => {
    await page.goto('/');

    // 等主畫面載入
    await expect(page.getByRole('navigation')).toBeVisible({ timeout: 15_000 });

    // 點 sidebar 的「系統設定」連結
    await page.getByRole('link', { name: /系統設定/ }).click();

    // 設定頁有「儲存位置」區塊（compact 模式）
    await expect(page.getByRole('heading', { name: '儲存位置' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/瀏覽器 IndexedDB/)).toBeVisible();
  });
});
