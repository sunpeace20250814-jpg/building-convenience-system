/**
 * V4 標籤列印 BUG 重現測試
 * ─────────────────────────────────────────────────────────────
 * 流程：
 *   1. 開 http://localhost:9527/
 *   2. 注入 OPFS 真實 handle mock（pattern 跟 storage-lifecycle 一樣）
 *   3. 走完 StorageLocationPrompt，進主畫面
 *   4. 切到「工具箱」tab，再切到「標籤列印」子 tab
 *   5. 在 iframe 內填入收件人資料
 *   6. 點「列印標籤」按鈕
 *   7. 用 emulateMedia('print') 模擬列印狀態 + 截圖
 *   8. 比較 before / after 截圖差異
 *
 * 用法：cd client && node tests/e2e/label-print-bug-repro.mjs
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
const SCREENSHOT_BEFORE = resolve(__dirname, 'label-print-bug-before.png');
const SCREENSHOT_AFTER = resolve(__dirname, 'label-print-bug-after.png');

const log = (...args) => console.log('[label-print-bug]', ...args);
const t0 = Date.now();
const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

// OPFS 真實 handle mock（跟 storage-lifecycle.test.mjs 一樣）
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
    try {
      localStorage.removeItem('v4-storage-backend');
      localStorage.removeItem('v4-lang');
      // 標記 onboarding 完成，避免精靈頁擋住主畫面
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
page.on('pageerror', (err) => {
  pageErrors.push(err.message);
  console.log(`[pageerror @${elapsed()}]`, err.message);
});
page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') {
    console.log(`[console.${msg.type()} @${elapsed()}]`, msg.text());
  }
});

let dialogSeen = null;
page.on('dialog', async (d) => {
  dialogSeen = { type: d.type(), message: d.message() };
  console.log(`[dialog @${elapsed()}] type=${d.type()} message=${d.message().slice(0, 100)}`);
  await d.dismiss();
});

let exitCode = 0;
try {
  log(`(${elapsed()}) 開首頁 + reset`);
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await resetStorage(page);
  await page.addInitScript(INIT_SCRIPT);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__opfsReady === true, { timeout: 5000 });
  log(`(${elapsed()}) OPFS ready, 等待 storage init`);
  await page.waitForTimeout(1500);

  // 點 StorageLocationPrompt 的「選擇資料儲存資料夾」按鈕
  const folderClicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find((b) => {
      const t = b.innerText || '';
      return t.includes('資料儲存資料夾') || (t.includes('資料夾') && !t.includes('更換'));
    });
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (!folderClicked) throw new Error('找不到 StorageLocationPrompt 按鈕');
  log(`(${elapsed()}) 選擇資料夾, 等待 backend=file-system`);
  await page.waitForFunction(
    () => localStorage.getItem('v4-storage-backend') === 'file-system',
    { timeout: 10000 }
  );
  log(`(${elapsed()}) ✅ backend 切到 file-system`);

  // 透過 sidebar 的 <a href="/tools"> 導航（避免 server 沒 SPA fallback）
  log(`(${elapsed()}) 透過 sidebar 點 /tools 連結`);
  // 等 sidebar 出現（主畫面 render 完成）
  await page.waitForSelector('a[href="/tools"]', { timeout: 10000 });
  const navResult = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href]'));
    const toolsLink = links.find((a) => a.getAttribute('href') === '/tools');
    if (toolsLink) { toolsLink.click(); return toolsLink.innerText.trim(); }
    const allHrefs = links.map((a) => a.getAttribute('href')).filter(Boolean);
    return `not-found, available: ${allHrefs.slice(0, 10).join(', ')}`;
  });
  log(`(${elapsed()}) /tools click result: ${navResult}`);
  await page.waitForTimeout(1500);
  // 確認 標籤列印 子 tab 是 active（tools/index.tsx 預設第一個工具就是 label-print）

  // 找到 iframe
  const iframeHandle = await page.waitForSelector('iframe[src*="label-print.html"]', { timeout: 5000 });
  const iframe = await iframeHandle.contentFrame();
  if (!iframe) throw new Error('找不到 iframe contentFrame');
  log(`(${elapsed()}) iframe loaded, url=${iframe.url()}`);

  // 填入收件人
  log(`(${elapsed()}) 填入收件人`);
  await iframe.fill('#recipientBatch', [
    'A1-3F,林冠婷,0920-522-735,高雄市左營區博愛四路309號二十六樓之1,813',
    'A1-4F,興連城,07-3456789,高雄市左營區博愛四路310號,813',
    'B2-5F,王小明,0912-345-678,台北市信義區松仁路100號,110',
    'C3-2F,李大華,0922-111-222,台中市西屯區台灣大道三段99號,407',
  ].join('\n'));
  await iframe.waitForTimeout(500);

  // 截圖：正常螢幕狀態（before）
  log(`(${elapsed()}) 截圖 screen mode (before)`);
  await page.screenshot({ path: SCREENSHOT_BEFORE, fullPage: false });

  // 檢查 iframe 內的 panel-right 是否有渲染（labels 已生成）
  const labelStats = await iframe.evaluate(() => {
    const panelRight = document.querySelector('.panel-right');
    const pages = document.querySelectorAll('.page');
    const labels = document.querySelectorAll('.label-container > div, .label');
    const printBtn = document.querySelector('.print-btn');
    return {
      hasPanelRight: !!panelRight,
      panelRightText: panelRight ? panelRight.innerText.slice(0, 200) : null,
      pageCount: pages.length,
      labelCount: labels.length,
      hasPrintBtn: !!printBtn,
      printBtnText: printBtn ? printBtn.innerText : null,
      previewInfo: document.getElementById('previewInfo')?.innerText || null,
    };
  });
  log(`(${elapsed()}) iframe state:`, JSON.stringify(labelStats));

  // 模擬 print media
  log(`(${elapsed()}) emulateMedia('print') 模擬列印狀態`);
  await page.emulateMedia({ media: 'print' });
  await iframe.waitForTimeout(300);

  // 點「列印標籤」按鈕（如果它需要點擊才會 print）
  // 先在 iframe 內手動觸發 window.print() 並看 console
  log(`(${elapsed()}) 在 iframe 內呼叫 window.print()`);
  await iframe.evaluate(() => {
    try {
      window.print();
    } catch (e) {
      window.__printError = String(e);
    }
  });
  await page.waitForTimeout(800);

  const printError = await iframe.evaluate(() => window.__printError || null);
  log(`(${elapsed()}) print error:`, printError);
  log(`(${elapsed()}) dialog seen:`, JSON.stringify(dialogSeen));

  // 截圖：print 狀態（after 概念上的"如果列印會怎樣"）
  // emulateMedia('print') 已經把 .panel-left 隱藏，截圖就是列印預覽
  await page.screenshot({ path: SCREENSHOT_AFTER, fullPage: false });
  log(`(${elapsed()}) 截圖 print mode (after) — before/after 比較用`);

  // 額外：截圖 iframe 在 print mode 的內容（驗證 panel-right 是否還在）
  const iframeBox = await iframeHandle.boundingBox();
  if (iframeBox) {
    await page.screenshot({
      path: resolve(__dirname, 'label-print-bug-iframe-print.png'),
      clip: iframeBox,
    });
  }

  // 截圖：iframe 在 print mode 下的 panel-right 內部狀態
  const panelRightVisible = await iframe.evaluate(() => {
    const pr = document.querySelector('.panel-right');
    if (!pr) return { exists: false };
    const style = window.getComputedStyle(pr);
    return {
      exists: true,
      display: style.display,
      visibility: style.visibility,
      width: pr.offsetWidth,
      height: pr.offsetHeight,
      childCount: pr.children.length,
    };
  });
  log(`(${elapsed()}) panel-right in print mode:`, JSON.stringify(panelRightVisible));

  // 復原 emulateMedia（避免影響其他測試）
  await page.emulateMedia({ media: 'screen' });

  if (panelRightVisible.exists && panelRightVisible.width > 0 && panelRightVisible.height > 0) {
    log(`(${elapsed()}) ✅ panel-right 在 print mode 下有實際尺寸，列印應該有內容`);
  } else {
    log(`(${elapsed()}) ❌ panel-right 在 print mode 下寬高為 0，列印會是空白`);
    exitCode = 1;
  }

  if (pageErrors.length > 0) {
    log(`(${elapsed()}) ⚠ 有 page errors：${pageErrors.length}`);
  }
} catch (err) {
  log(`(${elapsed()}) 💥 EXCEPTION:`, err.message);
  log(err.stack);
  exitCode = 1;
} finally {
  try { await resetStorage(page); } catch {}
  await browser.close();
  const totalSec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  Repro — ${exitCode === 0 ? '✅ reproduce confirmed OK' : '❌ reproduce failed'}`);
  console.log(`  總耗時: ${totalSec}s`);
  console.log(`  Before screenshot: ${SCREENSHOT_BEFORE}`);
  console.log(`  After screenshot:  ${SCREENSHOT_AFTER}`);
  console.log(`  Page errors: ${pageErrors.length}`);
  console.log('═══════════════════════════════════════════════════');
}
process.exit(exitCode);
