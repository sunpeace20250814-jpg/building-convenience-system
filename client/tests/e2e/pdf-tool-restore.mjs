// PDF 工具箱 iframe 還原視覺驗證
// 載入首頁 → 注入 OPFS mock + 點「選擇資料夾」→ 進到 app → 導航 /tools → 切到 PDF 工具箱 tab → 截圖
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(
  resolve(
    __dirname,
    '../../../node_modules/.pnpm/playwright@1.61.0/node_modules/playwright/index.js'
  )
);

const APP_URL = 'http://localhost:9527/';
const OPFS_SUBDIR_NAME = 'v4-pdf-test-folder';
const SCREENSHOT_PATH = resolve(__dirname, 'pdf-tool-restore.png');

// OPFS 真實 handle mock（從 storage-lifecycle.test.mjs 抄過來）
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

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console.error: ' + m.text());
});

try {
  console.log('[1/6] navigate to', APP_URL);
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });

  // 清乾淨舊的 storage（避免污染）
  await page.evaluate(async (dbName) => {
    await new Promise((r) => {
      const req = indexedDB.deleteDatabase(dbName);
      req.onsuccess = () => r(); req.onerror = () => r(); req.onblocked = () => r();
    });
    try { localStorage.removeItem('v4-storage-backend'); } catch {}
    try {
      const root = await navigator.storage.getDirectory();
      try { await root.removeEntry('v4-pdf-test-folder', { recursive: true }); } catch {}
    } catch {}
  }, 'v4-handle-db');

  console.log('[2/6] inject OPFS mock + reload');
  await page.addInitScript(INIT_SCRIPT);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__opfsReady === true, { timeout: 5000 });
  await page.waitForTimeout(800);

  console.log('[3/6] click 「選擇資料儲存資料夾」 button');
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

  // 等 backend 切到 file-system
  await page.waitForFunction(
    () => localStorage.getItem('v4-storage-backend') === 'file-system',
    { timeout: 10000 }
  );
  // 給 app 一點時間 mount StorageLocationPrompt
  await page.waitForTimeout(1500);
  const st1 = await page.evaluate(() => ({
    aside: !!document.querySelector('aside'),
    body: (document.body.innerText || '').slice(0, 200),
  }));
  console.log('   state1:', JSON.stringify(st1));

  // 強制設 onboarding 為已完成（避免 wizard 流程干擾測試）
  // 注意：onboarding.ts 檢查 '1'（不是 'true'）才視為 completed
  await page.evaluate(() => {
    localStorage.setItem('v4-onboarding-completed', '1');
    localStorage.setItem('v4-onboarding-skipped-at', '0');
  });
  // 重新 reload 讓 React 重 mount（用 OPFS mock 仍會 work）
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__opfsReady === true, { timeout: 5000 });
  await page.waitForTimeout(1500);
  const st2 = await page.evaluate(() => ({
    aside: !!document.querySelector('aside'),
    backend: localStorage.getItem('v4-storage-backend'),
    onboardCompleted: localStorage.getItem('v4-onboarding-completed'),
    onboardSkipped: localStorage.getItem('v4-onboarding-skipped-at'),
    body: (document.body.innerText || '').slice(0, 200),
  }));
  console.log('   state2:', JSON.stringify(st2));

  // 等 main app mount（nav 出現 — V4 Sidebar 用 <nav> 不是 <aside>）
  await page.waitForSelector('nav', { timeout: 10000 });
  console.log('   nav mounted');

  // 關掉雲端備份提示 banner（如果有）
  const dismissBanner = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const dismiss = btns.find((b) => (b.innerText || '').includes('之後再說'));
    if (dismiss) { dismiss.click(); return true; }
    return false;
  });
  if (dismissBanner) {
    await page.waitForTimeout(500);
    console.log('   關掉雲端備份 banner');
  }

  console.log('[4/6] navigate to /tools via in-page click (trigger React Router)');
  // 觸發 React Router 內部導航：直接 click 元素讓 React 攔截 onClick
  const navigated = await page.evaluate(() => {
    const link = document.querySelector('a[href="/tools"]');
    if (link) { link.click(); return true; }
    return false;
  });
  if (!navigated) {
    // fallback: 透過 history.pushState（V4 server 沒有 SPA fallback，不能 goto /tools）
    await page.evaluate(() => window.history.pushState({}, '', '/tools'));
  }
  // popstate 觸發 react-router 監聽
  await page.evaluate(() => window.dispatchEvent(new PopStateEvent('popstate')));
  await page.waitForTimeout(1000);
  // Debug: 印出當前 url + body 前 200 字
  const dbg = await page.evaluate(() => ({
    url: location.href,
    body: (document.body && document.body.innerText || '').slice(0, 200),
    hasAside: !!document.querySelector('aside'),
  }));
  console.log('   debug:', JSON.stringify(dbg));
  // 等 tools module 標題出現
  await page.waitForFunction(
    () => /工具箱/.test(document.body.innerText) && /標籤列印/.test(document.body.innerText),
    { timeout: 10000 }
  );
  await page.waitForTimeout(500);

  console.log('[5/6] click PDF 工具箱 tab');
  const pdfTab = page.locator('button:has-text("PDF 工具箱")').first();
  await pdfTab.waitFor({ timeout: 10000 });
  await pdfTab.click();

  // 等 iframe 載入
  const iframeEl = await page.waitForSelector('iframe[src="pdf-tools.html"]', {
    timeout: 10000,
  });
  const frame = await iframeEl.contentFrame();
  if (!frame) throw new Error('iframe contentFrame is null');
  // 等 iframe 內的 tabs 出現（原版 10 個工具）
  await frame.waitForSelector('.logo-wrapper, [id*="convert"], .tab, .app-name', {
    timeout: 15000,
  });
  await page.waitForTimeout(800); // 給 toast / animation 一點時間

  console.log('[6/6] take screenshot');
  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: false });
  console.log('screenshot saved:', SCREENSHOT_PATH);

  if (errors.length > 0) {
    console.log('PAGE ERRORS:');
    for (const e of errors) console.log('  ' + e);
  } else {
    console.log('0 page errors ✓');
  }

  // 也計算 iframe 內的 tab 數量（驗證 10 個工具）
  const tabCount = await frame.evaluate(() => {
    return document.querySelectorAll('.tab, [class*="tab"]').length;
  });
  console.log('iframe tab count =', tabCount);
} catch (err) {
  console.error('TEST FAILED:', err.message);
  errors.push('exception: ' + err.message);
  try { await page.screenshot({ path: SCREENSHOT_PATH, fullPage: false }); } catch {}
} finally {
  await browser.close();
  console.log('done. errors =', errors.length);
  process.exit(errors.length > 0 ? 1 : 0);
}
