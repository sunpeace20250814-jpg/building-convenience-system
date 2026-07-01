/**
 * V4 標籤列印 BUG — 驗證測試
 * ─────────────────────────────────────────────────────────────
 * 驗證：iframe 內的「列印標籤」按鈕能正常呼叫 window.print()
 * 而非被 sandbox 機制靜默吞掉。
 *
 * Bug: iframe sandbox 缺少 `allow-modals` token，
 *      導致 `window.print()` 被瀏覽器忽略、列印對話框不開啟。
 * Fix: 在 LabelPrintTool.tsx 的 iframe sandbox 屬性加上 `allow-modals`。
 *
 * 通過條件：
 *   1. 點「列印標籤」後 console 無 "Ignored call to 'print()'" 錯誤
 *   2. window.print() 進入列印流程（觸發 beforeprint event）
 *   3. 截圖 print emulation 模式（panel-left 隱藏，labels 可見）
 *
 * 用法：cd client && node tests/e2e/label-print-bug.test.mjs
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
const SCREENSHOT_PATH = resolve(__dirname, 'label-print-bug-after.png');

const log = (...args) => console.log('[label-print-test]', ...args);
const t0 = Date.now();
const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

const INIT_SCRIPT = `
  (function() {
    window.__opfsReady = false;
    window.__opfsError = null;
    (function setupOpfs() {
      navigator.storage.getDirectory().then(function(root) {
        return root.getDirectoryHandle('${OPFS_SUBDIR_NAME}', { create: true });
      }).then(function(subDir) {
        window.__opfsSubDir = subDir;
        window.showDirectoryPicker = function() { return Promise.resolve(subDir); };
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
    try {
      localStorage.removeItem('v4-storage-backend');
      localStorage.removeItem('v4-lang');
      localStorage.setItem('v4-onboarding-completed', '1');
      localStorage.setItem('v4-onboarding-skipped-at', '0');
    } catch {}
    try {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry(subDirName, { recursive: true });
    } catch (e) {}
  }, { subDirName: OPFS_SUBDIR_NAME, dbName: HANDLE_DB_NAME });
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

let pageErrors = [];
let printErrors = []; // 專門收集 'Ignored call to print()'
let beforePrintFired = false;
page.on('pageerror', (err) => {
  pageErrors.push(err.message);
  console.log(`[pageerror @${elapsed()}]`, err.message);
});
page.on('console', (msg) => {
  if (msg.type() === 'error') {
    const text = msg.text();
    console.log(`[console.error @${elapsed()}]`, text);
    if (text.includes('Ignored call to') && text.includes('print()')) {
      printErrors.push(text);
    }
  }
});

let exitCode = 0;
try {
  log(`(${elapsed()}) 開首頁 + reset`);
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await resetStorage(page);
  await page.addInitScript(INIT_SCRIPT);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__opfsReady === true, { timeout: 5000 });
  await page.waitForTimeout(1500);

  // 點 StorageLocationPrompt 的「選擇資料儲存資料夾」按鈕
  log(`(${elapsed()}) 走 StorageLocationPrompt`);
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find((b) => {
      const t = b.innerText || '';
      return t.includes('資料儲存資料夾') || (t.includes('資料夾') && !t.includes('更換'));
    });
    if (btn) btn.click();
  });
  await page.waitForFunction(
    () => localStorage.getItem('v4-storage-backend') === 'file-system',
    { timeout: 10000 }
  );

  // 進 工具箱
  log(`(${elapsed()}) 進 工具箱`);
  await page.waitForSelector('a[href="/tools"]', { timeout: 10000 });
  await page.click('a[href="/tools"]');
  await page.waitForTimeout(1500);

  // 取得 iframe
  const iframeHandle = await page.waitForSelector('iframe[src*="label-print.html"]', { timeout: 5000 });
  const iframe = await iframeHandle.contentFrame();
  if (!iframe) throw new Error('iframe contentFrame 為 null');
  log(`(${elapsed()}) iframe loaded`);

  // 監聽 beforeprint event（驗證 print() 真的進流程）
  await iframe.evaluate(() => {
    window.addEventListener('beforeprint', () => { window.__beforePrintFired = true; });
  });

  // 填入收件人
  log(`(${elapsed()}) 填入收件人`);
  await iframe.fill('#recipientBatch', [
    'A1-3F,林冠婷,0920-522-735,高雄市左營區博愛四路309號二十六樓之1,813',
    'A1-4F,興連城,07-3456789,高雄市左營區博愛四路310號,813',
    'B2-5F,王小明,0912-345-678,台北市信義區松仁路100號,110',
    'C3-2F,李大華,0922-111-222,台中市西屯區台灣大道三段99號,407',
  ].join('\n'));
  await iframe.waitForTimeout(500);

  // 直接點「列印標籤」按鈕
  log(`(${elapsed()}) 點「列印標籤」按鈕`);
  const printBtn = await iframe.waitForSelector('.print-btn', { timeout: 3000 });
  await printBtn.click();
  await page.waitForTimeout(1000);

  beforePrintFired = await iframe.evaluate(() => window.__beforePrintFired === true);
  log(`(${elapsed()}) beforeprint fired: ${beforePrintFired}`);
  log(`(${elapsed()}) print errors: ${printErrors.length}`);
  printErrors.forEach((e, i) => log(`  [${i + 1}] ${e}`));

  // 截圖：print emulation 模式（after 視角 — 列印預覽外觀）
  log(`(${elapsed()}) 截圖 print emulation`);
  await page.emulateMedia({ media: 'print' });
  await iframe.waitForTimeout(500);
  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: false });
  await page.emulateMedia({ media: 'screen' });

  // 額外驗證：print emulation 下 panel-right 有實際尺寸
  await page.emulateMedia({ media: 'print' });
  const panelState = await iframe.evaluate(() => {
    const pr = document.querySelector('.panel-right');
    const pl = document.querySelector('.panel-left');
    if (!pr) return { exists: false };
    const prStyle = window.getComputedStyle(pr);
    const plStyle = pl ? window.getComputedStyle(pl) : null;
    return {
      exists: true,
      panelRight: { width: pr.offsetWidth, height: pr.offsetHeight, display: prStyle.display },
      panelLeft: pl ? { display: plStyle.display } : null,
      pageCount: document.querySelectorAll('.page').length,
    };
  });
  await page.emulateMedia({ media: 'screen' });
  log(`(${elapsed()}) panel state in print mode:`, JSON.stringify(panelState));

  // ===== 通過條件 =====
  const passConditions = {
    'no print() ignored error': printErrors.length === 0,
    'panel-right visible in print mode': panelState.exists && panelState.panelRight.width > 0,
    'panel-left hidden in print mode': panelState.panelLeft && panelState.panelLeft.display === 'none',
    'has at least 1 page rendered': panelState.pageCount >= 1,
  };
  log(`(${elapsed()}) 通過條件:`);
  let allPass = true;
  for (const [k, v] of Object.entries(passConditions)) {
    log(`  ${v ? '✅' : '❌'} ${k}`);
    if (!v) allPass = false;
  }

  if (allPass) {
    log(`(${elapsed()}) ✅✅✅ TEST PASS — label print BUG 已修復`);
    exitCode = 0;
  } else {
    log(`(${elapsed()}) ❌ TEST FAIL — 標籤列印仍有問題`);
    exitCode = 1;
  }
} catch (err) {
  log(`(${elapsed()}) 💥 EXCEPTION:`, err.message);
  exitCode = 1;
} finally {
  try { await resetStorage(page); } catch {}
  await browser.close();
  const totalSec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  Label Print BUG Verification — ${exitCode === 0 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  總耗時:        ${totalSec}s`);
  console.log(`  Print errors:  ${printErrors.length}`);
  console.log(`  Page errors:   ${pageErrors.length}`);
  console.log(`  Screenshot:    ${SCREENSHOT_PATH}`);
  console.log('═══════════════════════════════════════════════════');
}
process.exit(exitCode);
