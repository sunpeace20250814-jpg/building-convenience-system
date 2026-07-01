/**
 * 工具箱 UI 風格統一 — 視覺驗證
 *
 * 流程：
 *   1. OPFS 注入 showDirectoryPicker mock（沿用 storage-lifecycle 模式）
 *   2. 開首頁 → 點「選擇資料儲存資料夾」→ app 初始化 SQLite
 *   3. 等 sidebar 出現
 *   4. 導航到 /tools
 *   5. 點「標籤列印」tab → 截圖
 *   6. 點「PDF 工具箱」tab → 截圖
 *
 * 預期結果：
 *   - Header 一致：Wrench icon + 「工具箱」+ 副標 + 全螢幕/在新視窗開啟
 *   - Tab strip 一致：書籤頁 strip 顯示兩個工具
 *   - iframe 100% 填滿剩餘空間（不需滾輪）
 *
 * 用法：
 *   node tests/e2e/tools-tabs.test.mjs
 */

import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const PLAYWRIGHT_PATH = resolve(
  __dirname,
  '../../../node_modules/.pnpm/playwright@1.61.0/node_modules/playwright/index.js',
);
const { chromium } = require(PLAYWRIGHT_PATH);

const APP_URL = 'http://localhost:9527/';
const TOOLS_URL = 'http://localhost:9527/tools';
const OPFS_SUBDIR_NAME = 'v4-screenshot-folder';
const HANDLE_DB_NAME = 'v4-handle-db';
const OUT_LABEL = resolve(__dirname, 'tools-label-print.png');
const OUT_PDF = resolve(__dirname, 'tools-pdf.png');

const log = (...args) => console.log('[tools-shot]', ...args);
const t0 = Date.now();
const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

// OPFS 真實 handle mock — showDirectoryPicker 用普通 function 避免 DataCloneError
const INIT_SCRIPT = `
  (function() {
    window.__opfsReady = false;
    window.__opfsError = null;
    (function setupOpfs() {
      navigator.storage.getDirectory().then(function(root) {
        return root.getDirectoryHandle('${OPFS_SUBDIR_NAME}', { create: true });
      }).then(function(subDir) {
        window.__opfsSubDir = subDir;
        window.showDirectoryPicker = function() {
          return Promise.resolve(subDir);
        };
        window.__opfsReady = true;
      }).catch(function(e) {
        window.__opfsError = String(e);
        window.__opfsReady = true;
      });
    })();
  })();
`;

async function resetStorage(page) {
  await page.evaluate(async ({ subDirName, dbName }) => {
    await new Promise((resolve) => {
      const req = indexedDB.deleteDatabase(dbName);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
    try { localStorage.clear(); } catch {}
    try {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry(subDirName, { recursive: true });
    } catch {}
  }, { subDirName: OPFS_SUBDIR_NAME, dbName: HANDLE_DB_NAME });
}

// 跳過 onboarding 精靈（首次啟動時會擋住主畫面）
async function skipOnboarding(page) {
  await page.evaluate(() => {
    localStorage.setItem('v4-onboarding-completed', '1');
    localStorage.setItem('v4-onboarding-skipped-at', '0');
  });
}

const browser = await chromium.launch({ headless: true });
// Edge App mode 視窗是 1400x900，這裡用同尺寸驗證
const ctx = await browser.newContext({
  viewport: { width: 1400, height: 900 },
});
const page = await ctx.newPage();

let pageErrors = [];
page.on('pageerror', (err) => {
  pageErrors.push(err.message);
  console.log(`[pageerror @${elapsed()}]`, err.message);
});
page.on('console', (msg) => {
  const t = msg.type();
  if (t === 'error') console.log(`[page ${t} @${elapsed()}]`, msg.text());
});

try {
  log('reset state');
  await page.goto(APP_URL);
  await page.waitForTimeout(500);
  await resetStorage(page);
  log('state cleared');

  log('add OPFS init script');
  await page.addInitScript(INIT_SCRIPT);

  log('reload with mock');
  await page.goto(APP_URL);

  await skipOnboarding(page);
  log('onboarding skipped');

  await page.reload();
  await page.waitForSelector('text=選擇資料儲存資料夾', { timeout: 30_000 });

  await page.waitForSelector('text=選擇資料儲存資料夾', { timeout: 30_000 });
  log('StorageLocationPrompt visible');

  await page.click('button:has-text("選擇資料儲存資料夾")');
  log('clicked folder picker');

  await page.waitForSelector('a[href="/facility-booking"]', { timeout: 30_000 });
  log('sidebar visible');

  // 關閉雲端綁定提示 modal（如有）
  try {
    const dismissBtn = page.locator('button:has-text("之後再說")').first();
    if (await dismissBtn.isVisible({ timeout: 2000 })) {
      await dismissBtn.click();
      log('dismissed cloud binding prompt');
      await page.waitForTimeout(300);
    }
  } catch {
    log('no cloud binding prompt to dismiss');
  }

  // 導航到 /tools（用 sidebar 連結）
  log('navigate to /tools');
  await page.click('a[href="/tools"]', { timeout: 15_000 });
  await page.waitForSelector('h1:has-text("工具箱")', { timeout: 15_000 });
  log('tools page loaded');

  // 等「標籤列印」tab 顯示
  await page.waitForSelector('button:has-text("標籤列印")', { timeout: 5_000 });
  // 等 iframe 載入
  await page.waitForSelector('iframe[title="標籤列印工具"]', { timeout: 10_000 });
  // 等 iframe 內部 PDF/label content 載入
  await page.waitForTimeout(1500);
  log('label-print iframe loaded');

  // 截圖 1：標籤列印 tab
  log('screenshot label-print →', OUT_LABEL);
  await page.screenshot({ path: OUT_LABEL, fullPage: false });

  // 點「PDF 工具箱」tab
  log('click PDF 工具箱 tab');
  await page.click('button:has-text("PDF 工具箱")');
  // 等新 iframe 載入
  await page.waitForSelector('iframe[title="PDF 工具箱"]', { timeout: 10_000 });
  log('pdf-tools iframe attached');

  // pdf-tools.html 從 CDN 載入 pdf.js + pdf-lib，需要時間
  // 用 frameLocator 等 iframe 內的 nav-tabs 出現
  const pdfFrame = page.frameLocator('iframe[title="PDF 工具箱"]');
  try {
    await pdfFrame.locator('.nav-tabs').waitFor({ state: 'visible', timeout: 20_000 });
    log('pdf-tools nav-tabs visible (CDN loaded)');
  } catch (e) {
    log('pdf-tools nav-tabs NOT visible after 20s — CDN may have failed:', e.message);
  }
  await page.waitForTimeout(1000);

  // 截圖 2：PDF 工具箱 tab
  log('screenshot pdf →', OUT_PDF);
  await page.screenshot({ path: OUT_PDF, fullPage: false });

  // 量 iframe 高度來驗證「不用滾輪就完整可見」
  const iframeMetrics = await page.evaluate(() => {
    const ifr = document.querySelector('iframe[title="PDF 工具箱"]');
    if (!ifr) return null;
    const rect = ifr.getBoundingClientRect();
    return { width: rect.width, height: rect.height, top: rect.top };
  });
  log('iframe metrics:', JSON.stringify(iframeMetrics));

  if (pageErrors.length > 0) {
    console.log('[tools-shot] WARN page errors:', pageErrors.length);
  } else {
    log('no page errors');
  }

  log('done in', elapsed());
} catch (err) {
  console.error('[tools-shot] FAILED:', err.message);
  try {
    await page.screenshot({ path: OUT_LABEL + '.error.png', fullPage: false });
    console.log('[tools-shot] error screenshot at', OUT_LABEL + '.error.png');
  } catch {}
  process.exit(1);
} finally {
  try {
    await page.evaluate(async ({ subDirName, dbName }) => {
      try {
        const root = await navigator.storage.getDirectory();
        await root.removeEntry(subDirName, { recursive: true });
      } catch {}
      await new Promise((resolve) => {
        const req = indexedDB.deleteDatabase(dbName);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });
      try { localStorage.clear(); } catch {}
    }, { subDirName: OPFS_SUBDIR_NAME, dbName: HANDLE_DB_NAME });
  } catch {}

  await browser.close();
}
