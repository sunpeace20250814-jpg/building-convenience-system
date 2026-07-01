/**
 * 快速截圖：screen mode（before 視角 — 使用者點 print 但什麼都沒發生時的頁面狀態）
 * 跟 test.mjs 流程一樣，但截圖在 screen mode（emulateMedia 不切到 print）
 */
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(resolve(__dirname,
  '../../../node_modules/.pnpm/playwright@1.61.0/node_modules/playwright/index.js'));

const APP_URL = 'http://localhost:9527/';
const INIT_SCRIPT = `
  (function() {
    window.__opfsReady = false;
    (function setupOpfs() {
      navigator.storage.getDirectory().then(function(root) {
        return root.getDirectoryHandle('v4-test-folder', { create: true });
      }).then(function(subDir) {
        window.__opfsSubDir = subDir;
        window.showDirectoryPicker = function() { return Promise.resolve(subDir); };
        window.__opfsReady = true;
      }).catch(function() { window.__opfsReady = true; });
    })();
  })();
`;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
try {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  // pre-set onboarding + storage so we skip the prompt
  await page.evaluate(() => {
    localStorage.setItem('v4-onboarding-completed', '1');
    localStorage.setItem('v4-onboarding-skipped-at', '0');
  });
  await page.addInitScript(INIT_SCRIPT);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__opfsReady === true, { timeout: 5000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find((b) => (b.innerText || '').includes('資料儲存資料夾') || ((b.innerText || '').includes('資料夾') && !(b.innerText || '').includes('更換')));
    if (btn) btn.click();
  });
  await page.waitForFunction(() => localStorage.getItem('v4-storage-backend') === 'file-system', { timeout: 10000 });
  await page.waitForSelector('a[href="/tools"]', { timeout: 10000 });
  await page.click('a[href="/tools"]');
  await page.waitForTimeout(1500);
  const iframeHandle = await page.waitForSelector('iframe[src*="label-print.html"]', { timeout: 5000 });
  const iframe = await iframeHandle.contentFrame();
  await iframe.fill('#recipientBatch', [
    'A1-3F,林冠婷,0920-522-735,高雄市左營區博愛四路309號二十六樓之1,813',
    'A1-4F,興連城,07-3456789,高雄市左營區博愛四路310號,813',
    'B2-5F,王小明,0912-345-678,台北市信義區松仁路100號,110',
    'C3-2F,李大華,0922-111-222,台中市西屯區台灣大道三段99號,407',
  ].join('\n'));
  await iframe.waitForTimeout(500);
  // screen mode (不要 emulateMedia) — 這是 user 點 print 後頁面實際狀態
  await page.screenshot({ path: resolve(__dirname, 'label-print-bug-before.png'), fullPage: false });
  console.log('[done] saved label-print-bug-before.png (screen mode)');
} finally {
  await browser.close();
}
