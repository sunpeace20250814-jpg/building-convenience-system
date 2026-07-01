/**
 * 模組重組截圖：residents-tabs + facility-record-tabs
 * 透過側邊欄點擊導航（SPA 路由，dist 是靜態 server 沒有 SPA fallback）
 */
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(resolve(__dirname,
  '../../../node_modules/.pnpm/playwright@1.61.0/node_modules/playwright/index.js'));

const BASE = 'http://localhost:9527/';

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // 攔截 console 方便除錯
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('  [page error]', msg.text().slice(0, 200));
  });

  // 預先設定 localStorage 跳過 onboarding
  // 用 file-system backend 標記（即使 handle 無效，App 仍會繼續 init）
  // 並 mock IDB saveHandle 跳過無法 clone 的 handle 問題
  await context.addInitScript(() => {
    localStorage.setItem('v4-onboarding-completed', '1');
    localStorage.setItem('v4-storage-backend', 'file-system');

    // 攔截 IDB 的 put，避免無法 clone 的 handle 拋錯
    const origPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(value, ...args) {
      try {
        // 測試是否可結構化複製
        structuredClone(value);
        return origPut.call(this, value, ...args);
      } catch (e) {
        // 不能 clone → 用空物件代替
        return origPut.call(this, { __stub: true, name: value?.name || 'mock' }, ...args);
      }
    };
  });

  // 進入根路徑
  await page.goto(BASE);
  await page.waitForTimeout(3000);

  // 點「選擇資料儲存資料夾」按鈕（會觸發我們 mock 的 showDirectoryPicker）
  try {
    const pickBtn = page.locator('button').filter({ hasText: '選擇資料儲存' }).first();
    if (await pickBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await pickBtn.click();
      await page.waitForTimeout(5000);
    }
  } catch { /* 沒看到 */ }

  // 關掉雲端綁定提示（如果有）
  try {
    const cloudDismiss = page.locator('button:has-text("之後再說")').first();
    if (await cloudDismiss.isVisible({ timeout: 1000 }).catch(() => false)) {
      await cloudDismiss.click();
      await page.waitForTimeout(500);
    }
  } catch { /* 沒看到 */ }

  // 也試 × 按鈕
  try {
    const closeBtn = page.locator('button[aria-label*="關閉"], button:has(svg.lucide-x)').first();
    if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(500);
    }
  } catch { /* 沒看到 */ }

  // === Phase 1: residents 模組 ===
  console.log('Phase 1: residents 模組');
  // 點 sidebar 上的「住戶管理」連結
  const residentsLink = page.locator('a:has-text("住戶管理"), a[href="/residents"]').first();
  if (await residentsLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    await residentsLink.click();
  } else {
    // 後備：直接到 /
    await page.goto(BASE);
  }
  await page.waitForTimeout(2500);

  // 截 residents 模組（會顯示 4 tabs）
  await page.screenshot({
    path: resolve(__dirname, 'residents-tabs.png'),
    fullPage: true,
  });
  console.log('  saved residents-tabs.png');

  // === Phase 2: facility-booking 模組 ===
  console.log('Phase 2: facility-booking 模組');
  const facilityLink = page.locator('a:has-text("公設紀錄"), a[href="/facility-booking"]').first();
  if (await facilityLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    await facilityLink.click();
  }
  await page.waitForTimeout(2500);

  await page.screenshot({
    path: resolve(__dirname, 'facility-record-tabs.png'),
    fullPage: true,
  });
  console.log('  saved facility-record-tabs.png');

  await browser.close();
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
