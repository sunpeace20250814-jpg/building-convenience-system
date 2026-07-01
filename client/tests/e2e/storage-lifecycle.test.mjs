/**
 * V4 Storage Lifecycle E2E Test
 * ─────────────────────────────────────────────────────────────
 * 模擬「選擇資料夾 → Edge 重啟 → 自動還原」完整 lifecycle。
 *
 * 流程：
 *   1. 清乾淨 IndexedDB + localStorage + OPFS subDir（重置環境）
 *   2. 開 http://localhost:9527/，用 addInitScript 注入 OPFS 真實 handle mock
 *      （showDirectoryPicker → OPFS subDir「v4-test-folder」）
 *   3. 點「選擇資料儲存資料夾」按鈕 → 等 5s
 *      預期：localStorage['v4-storage-backend'] = 'file-system'，header 出現
 *   4. 重新 goto（同 URL，模擬 Edge restart）
 *      addInitScript 會再次跑，subDir 已存在所以直接拿 handle
 *   5. 等 7s，預期：backend 仍是 'file-system'，header 仍出現
 *   6. Cleanup：刪 OPFS subDir、刪 IndexedDB `v4-handle-db`、清 localStorage
 *
 * 用法：
 *   # server 已在 :9527 跑（client/public/start-server.ps1）
 *   node tests/e2e/storage-lifecycle.test.mjs
 *
 * 環境前置：
 *   - playwright 1.61.0（pnpm store，透過 require 絕對路徑載入，不需裝在 client/）
 *   - chromium 已裝（C:\Users\sunpe\AppData\Local\ms-playwright\chromium-1228）
 *   - HTTP server listening on :9527
 *
 * 重要 mock 細節：
 *   - addInitScript 內用 `(async () => {...})()` IIFE 先把 OPFS subDir 建好
 *   - showDirectoryPicker 用普通 function（非 async function object）避免 DataCloneError
 *     （OPFS FileSystemDirectoryHandle 是 structured-cloneable，可存進 IndexedDB）
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
const OPFS_SUBDIR_NAME = 'v4-test-folder';
const HANDLE_DB_NAME = 'v4-handle-db';

const log = (...args) => console.log('[lifecycle]', ...args);
const t0 = Date.now();
const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

// OPFS + IndexedDB 真實 handle mock
// 關鍵：showDirectoryPicker 必須是普通 function（return Promise.resolve(handle)），
// 不能是 async function — async function 包成物件後丟進 IndexedDB 會 DataCloneError
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
        window.__opfsReady = true; // 標記完成（即使失敗）避免測試卡死
      });
    })();
  })();
`;

async function resetStorage(page) {
  // 完整重置：刪 handle-db、刪 OPFS subDir、清 localStorage
  await page.evaluate(async ({ subDirName, dbName }) => {
    // 1) 刪 IndexedDB
    await new Promise((resolve) => {
      const req = indexedDB.deleteDatabase(dbName);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
    // 2) 清 localStorage
    try {
      localStorage.removeItem('v4-storage-backend');
      localStorage.removeItem('v4-lang');
    } catch {}
    // 3) 嘗試刪 OPFS subDir（可能不存在）
    try {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry(subDirName, { recursive: true });
    } catch (e) {
      // subDir 不存在或無權限 — 略過
    }
  }, { subDirName: OPFS_SUBDIR_NAME, dbName: HANDLE_DB_NAME });
}

async function snapshot(page, label) {
  return await page.evaluate(() => ({
    backend: localStorage.getItem('v4-storage-backend'),
    hasHeader: !!document.querySelector('header'),
    bodyStart: (document.body && document.body.innerText || '').slice(0, 120),
    opfsReady: window.__opfsReady === true,
    opfsError: window.__opfsError || null,
  }));
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

let pageErrors = [];
page.on('pageerror', (err) => {
  pageErrors.push(err.message);
  console.log(`[pageerror @${elapsed()}]`, err.message);
});
page.on('console', (msg) => {
  if (msg.type() === 'error') {
    console.log(`[console.error @${elapsed()}]`, msg.text());
  }
});

const results = { phase1: null, phase2: null, cleanup: null };
let exitCode = 0;

try {
  // ===== Phase 1: Initial setup + click folder =====
  log(`(${elapsed()}) Phase 1: open page, inject OPFS mock, click folder`);
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await resetStorage(page);
  // 重置後重新注入 mock（因為 resetStorage 後 page state 還在，但 OPFS handle 物件可能失效）
  // 注意 addInitScript 只在新 navigation 觸發；reload 也會重跑
  await page.addInitScript(INIT_SCRIPT);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__opfsReady === true, { timeout: 5000 });
  await page.waitForTimeout(800); // 給 React mount 一點時間

  // 點「選擇資料儲存資料夾」按鈕
  const clicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find((b) => {
      const t = b.innerText || '';
      return t.includes('資料儲存資料夾') || (t.includes('資料夾') && !t.includes('更換'));
    });
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (!clicked) throw new Error('找不到「選擇資料儲存資料夾」按鈕');

  log(`(${elapsed()}) 等待 5s 讓 backend 切到 file-system…`);
  await page.waitForTimeout(5000);

  results.phase1 = await snapshot(page, 'phase1');
  log(`(${elapsed()}) phase1 snapshot:`, JSON.stringify(results.phase1));

  const phase1Pass =
    results.phase1.backend === 'file-system' &&
    results.phase1.hasHeader === true &&
    pageErrors.length === 0;
  if (!phase1Pass) {
    log(`(${elapsed()}) ❌ Phase 1 FAIL`);
    log(`  預期 backend='file-system', hasHeader=true, 0 errors`);
    log(`  實際 backend='${results.phase1.backend}', hasHeader=${results.phase1.hasHeader}, errors=${pageErrors.length}`);
    exitCode = 1;
  } else {
    log(`(${elapsed()}) ✅ Phase 1 PASS (backend=file-system, hasHeader=true)`);
  }

  // ===== Phase 2: Reload (simulate Edge restart) =====
  if (phase1Pass) {
    log(`(${elapsed()}) Phase 2: reload page (模擬 Edge restart)`);
    // 不要清 storage — handle 還在 IndexedDB 裡
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // addInitScript 會自動重跑（OPFS subDir 已存在，getDirectoryHandle 會直接返回）
    await page.waitForFunction(() => window.__opfsReady === true, { timeout: 5000 });

    log(`(${elapsed()}) 等待 7s 讓 initDefaultStorage 自動還原…`);
    await page.waitForTimeout(7000);

    results.phase2 = await snapshot(page, 'phase2');
    log(`(${elapsed()}) phase2 snapshot:`, JSON.stringify(results.phase2));

    const phase2Pass =
      results.phase2.backend === 'file-system' &&
      results.phase2.hasHeader === true &&
      pageErrors.length === 0;
    if (!phase2Pass) {
      log(`(${elapsed()}) ❌ Phase 2 FAIL`);
      log(`  預期 backend='file-system', hasHeader=true, 0 errors`);
      log(`  實際 backend='${results.phase2.backend}', hasHeader=${results.phase2.hasHeader}, errors=${pageErrors.length}`);
      exitCode = 1;
    } else {
      log(`(${elapsed()}) ✅ Phase 2 PASS (DB 自動還原成功)`);
    }
  } else {
    log(`(${elapsed()}) ⏭ 跳過 Phase 2（Phase 1 失敗）`);
    exitCode = 1;
  }
} catch (err) {
  log(`(${elapsed()}) 💥 EXCEPTION:`, err.message);
  exitCode = 1;
} finally {
  // ===== Cleanup =====
  log(`(${elapsed()}) Cleanup: 刪 OPFS subDir + IndexedDB + localStorage`);
  try {
    await resetStorage(page);
    results.cleanup = 'ok';
    log(`(${elapsed()}) ✅ Cleanup 完成`);
  } catch (e) {
    results.cleanup = `failed: ${e.message}`;
    log(`(${elapsed()}) ⚠ Cleanup 失敗:`, e.message);
  }

  await browser.close();

  // ===== Final report =====
  const totalSec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  V4 Storage Lifecycle E2E — ${exitCode === 0 ? '✅ PASS' : '❌ FAIL'}`);
  console.log('═══════════════════════════════════════════════════');
  console.log(`  總耗時:        ${totalSec}s`);
  console.log(`  Phase 1 (選資料夾):    ${results.phase1 ? `${results.phase1.backend}/${results.phase1.hasHeader ? 'header✓' : 'no-header'}` : 'skipped'}`);
  console.log(`  Phase 2 (重啟還原):    ${results.phase2 ? `${results.phase2.backend}/${results.phase2.hasHeader ? 'header✓' : 'no-header'}` : 'skipped'}`);
  console.log(`  Page errors:   ${pageErrors.length}`);
  console.log(`  Cleanup:       ${results.cleanup}`);
  if (pageErrors.length > 0) {
    console.log('  Page errors detail:');
    pageErrors.forEach((e, i) => console.log(`    ${i + 1}. ${e}`));
  }
  console.log('═══════════════════════════════════════════════════');
}

process.exit(exitCode);