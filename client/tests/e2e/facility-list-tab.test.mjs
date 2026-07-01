/**
 * 公設借用「記錄表」Tab 視覺截圖
 *
 * 流程：
 *   1. OPFS 注入 showDirectoryPicker mock（沿用 storage-lifecycle 模式）
 *   2. 開首頁，點「選擇資料儲存資料夾」→ app 初始化 SQLite
 *   3. 等 App 出現 header（表示 DB ready）
 *   4. 直接 goto /facility-booking
 *   5. 點「記錄表」tab
 *   6. 截圖存到 tests/e2e/facility-list-tab.png
 *
 * 環境前置（與既有 e2e 共用）：
 *   - HTTP server listening on :9527
 *   - playwright 1.61.0 在 pnpm store
 *   - chromium-1228 已安裝
 *
 * 用法：
 *   node tests/e2e/facility-list-tab.test.mjs
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
const FB_URL = 'http://localhost:9527/facility-booking';
const OPFS_SUBDIR_NAME = 'v4-screenshot-folder';
const HANDLE_DB_NAME = 'v4-handle-db';
const OUT_PNG = resolve(__dirname, 'facility-list-tab.png');

const log = (...args) => console.log('[screenshot]', ...args);
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

async function trySeedData(page) {
  /**
   * 嘗試透過 page context 注入測試資料。
   * 沒拿到 db handle 就跳過 — 截圖仍可展示空狀態。
   *
   * 注意：app 內的 execute/queryAll 沒掛到 window，所以這裡直接用 sql.js WASM
   * 開一個記憶體 DB，再把 fixture INSERT 的 SQL 透過 page.evaluate 餵進去。
   * 但更簡單可靠的做法 — 不在這裡注入資料，改用 UI 操作新增 3 筆。
   */
  return false;
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
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

  // 跳過 onboarding（首次啟動會擋住主畫面）
  await skipOnboarding(page);
  log('onboarding skipped');

  // 重新整理讓 onboarding 狀態生效
  await page.reload();
  await page.waitForSelector('text=選擇資料儲存資料夾', { timeout: 30_000 });

  // 等 StorageLocationPrompt 出現
  await page.waitForSelector('text=選擇資料儲存資料夾', { timeout: 30_000 });
  log('StorageLocationPrompt visible');

  // 點「選擇資料儲存資料夾」按鈕
  await page.click('button:has-text("選擇資料儲存資料夾")');
  log('clicked folder picker');

  // 等 App 主介面出現（sidebar 連結）
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

  // 嘗試 seed data（透過 UI 操作新增幾筆借用）
  const seeded = await trySeedData(page);
  if (!seeded) {
    log('skipping seed (not implemented in headless) — will screenshot empty state');
  }

  // 導航到 facility-booking — 用 sidebar 連結（伺服器是 SPA，直接 goto 會 404）
  log('navigate via sidebar');
  await page.click('a[href="/facility-booking"]', { timeout: 15_000 });
  await page.waitForSelector('h1:has-text("公設借用")', { timeout: 15_000 });
  log('facility-booking page loaded');

  // 點「記錄表」tab
  log('click 記錄表 tab');
  await page.click('button:has-text("記錄表")');
  await page.waitForTimeout(500); // 動畫緩衝

  // 截圖
  log('take screenshot →', OUT_PNG);
  await page.screenshot({ path: OUT_PNG, fullPage: false });

  if (pageErrors.length > 0) {
    console.log('[screenshot] WARN page errors:', pageErrors.length);
  } else {
    log('no page errors');
  }

  log('done in', elapsed());
} catch (err) {
  console.error('[screenshot] FAILED:', err.message);
  // 失敗時也截一張供 debug
  try {
    await page.screenshot({ path: OUT_PNG + '.error.png', fullPage: false });
    console.log('[screenshot] error screenshot at', OUT_PNG + '.error.png');
  } catch {}
  process.exit(1);
} finally {
  // 清理：刪 OPFS subDir + IndexedDB
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
