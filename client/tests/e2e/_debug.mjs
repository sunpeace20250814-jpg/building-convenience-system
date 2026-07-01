/**
 * Quick debug script — check what's on the page after picker click
 */
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const PLAYWRIGHT_PATH = resolve(
  __dirname,
  '../../../node_modules/.pnpm/playwright@1.61.0/node_modules/playwright/index.js'
);
const { chromium } = require(PLAYWRIGHT_PATH);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('console', (msg) => console.log(`[page ${msg.type()}]`, msg.text()));
page.on('pageerror', (err) => console.log('[pageerror]', err.message));

await page.goto('http://localhost:9527/');
await page.evaluate(async () => {
  await new Promise((resolve) => {
    const req = indexedDB.deleteDatabase('v4-handle-db');
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
  localStorage.clear();
});

await page.addInitScript(() => {
  window.__mockReady = false;
  (async () => {
    const root = await navigator.storage.getDirectory();
    const subDir = await root.getDirectoryHandle('v4-test-folder', { create: true });
    window.__opfsHandle = subDir;
    window.showDirectoryPicker = () => Promise.resolve(subDir);
    window.__mockReady = true;
  })();
});

await page.goto('http://localhost:9527/');
await page.waitForFunction(() => window.__mockReady === true, { timeout: 5000 });

console.log('--- before click picker ---');
console.log(await page.evaluate(() => ({
  body: document.body.innerText.slice(0, 500),
  buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim().slice(0, 40)),
})));

await page.click('button:has-text("選擇資料儲存資料夾")');
await page.waitForTimeout(5000);

console.log('--- 5s after picker click ---');
console.log(await page.evaluate(() => ({
  body: document.body.innerText.slice(0, 500),
  buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim().slice(0, 40)),
  backend: localStorage.getItem('v4-storage-backend'),
  opfsHandle: !!window.__opfsHandle,
})));

await browser.close();
