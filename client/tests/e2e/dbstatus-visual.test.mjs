/**
 * DatabaseStatus visual overflow test
 *
 * 目標：當 lastSaveError 很長時（> 100 字），header 按鈕是否會破版。
 *
 * 策略：
 *   1. 走正常 onboarding → 選資料夾 → backend=file-system
 *   2. 模擬 lastSaveError 為超長字串（透過 DOM 注入覆寫 statusText）
 *   3. 量 button 寬度 + 截圖
 *   4. 若 overflow=true，之後再跑 with-fix 版驗證修復
 *
 * 為什麼用 DOM 注入而非真的觸發 save error：
 *   OPFS handle 在 IDB round-trip 後無法用 JS prototype patch 注入失敗
 *   （FileSystemDirectoryHandle.getFileHandle 是 native binding），
 *   而且 task brief 明列「或直接覆寫 lastSaveError」是允許的方式。
 *   我們要驗證的是：UI 在收到長錯誤字串時是否會破版 — DOM 注入達到同樣目的。
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:9527/';
const LONG_ERROR =
  'FileSystemFileHandle.createWritable() failed at OPFS path /v4-test-folder/v4-resident.db: ' +
  'NotFoundError: The requested file could not be found in the OPFS sandbox storage, ' +
  'possibly because it was deleted externally or the OPFS origin storage quota was exceeded. ' +
  '(code=8, domain=QuotaExceededError, stack trace truncated)';
const FULL_TEXT = `儲存失敗：${LONG_ERROR}`;

async function setup(page, context) {
  // === Phase A: clean state + OPFS mock ===
  await page.goto(BASE);
  await page.waitForTimeout(500);
  await page.evaluate(async () => {
    return new Promise((resolve) => {
      const req = indexedDB.deleteDatabase('v4-handle-db');
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    });
  });
  await page.evaluate(() => localStorage.clear());

  await context.addInitScript(() => {
    (async () => {
      try {
        const root = await navigator.storage.getDirectory();
        const subDir = await root.getDirectoryHandle('v4-test-folder', { create: true });
        window.__opfsSubDir = subDir;
        window.showDirectoryPicker = () => Promise.resolve(subDir);
        window.__mockReady = true;
      } catch (e) { window.__mockError = String(e); }
    })();
  });

  await page.goto(BASE);
  await page.waitForFunction(() => window.__mockReady === true, { timeout: 5000 });
  await page.waitForTimeout(800);

  // 點 wizard 的「選擇資料儲存資料夾」
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) =>
      /選擇資料儲存資料夾/.test(b.innerText || '')
    );
    btn?.click();
  });

  // 等 backend 變 file-system
  await page.waitForFunction(
    () => localStorage.getItem('v4-storage-backend') === 'file-system',
    { timeout: 15000 }
  );

  // 設定 wizard 跳過並 reload
  await page.evaluate(() => {
    localStorage.setItem('v4-onboarding-completed', '1');
    localStorage.setItem('v4-onboarding-skipped-at', '1');
  });
  await page.reload();
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll('button')).some((b) => /v4-test-folder|未選擇/.test(b.innerText || '')),
    { timeout: 15000 }
  );
  await page.waitForTimeout(1500);
}

async function injectLongErrorAndMeasure(page) {
  // 找出 DatabaseStatus button（含 Folder 圖示 + status text 的那個）
  return await page.evaluate((fullText) => {
    const allBtns = Array.from(document.querySelectorAll('button'));
    const btn = allBtns.find((b) => /v4-test-folder|未選擇/.test(b.innerText || ''));
    if (!btn) return { ok: false, reason: 'btn-not-found' };

    const spans = btn.querySelectorAll('span');
    let statusSpan = null;
    for (const s of spans) {
      if (/flex items-center gap-1/.test(s.className)) {
        statusSpan = s;
        break;
      }
    }
    if (!statusSpan) statusSpan = spans[2];
    if (!statusSpan) return { ok: false, reason: 'statusSpan-not-found', spanCount: spans.length };

    statusSpan.innerHTML = '';
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('class', 'lucide lucide-alert-circle w-3 h-3 text-red-500');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.innerHTML = '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>';
    statusSpan.appendChild(icon);
    statusSpan.appendChild(document.createTextNode(fullText));

    const r = btn.getBoundingClientRect();
    return {
      ok: true,
      btnWidth: r.width,
      btnHeight: r.height,
      btnRight: r.right,
      viewportWidth: window.innerWidth,
      statusTextLen: fullText.length,
      classList: btn.className,
      hasTruncate: /truncate/.test(btn.className),
    };
  }, FULL_TEXT);
}

/**
 * 注入 .tsx fix 等效的 CSS（因為 server 跑的是 fix 前的 build，無法 rebuild）
 * 模擬新加的 Tailwind class：w-full、overflow-hidden、truncate、min-w-0、flex-1、flex-shrink-0
 */
async function applyFixCSS(page) {
  await page.evaluate(() => {
    // 移除舊的 fix style（如果有）
    const old = document.getElementById('__dbstatus-fix-style');
    if (old) old.remove();

    const style = document.createElement('style');
    style.id = '__dbstatus-fix-style';
    style.textContent = `
      /* 對應 .tsx fix：button 加 w-full + overflow-hidden + flex-shrink-0 + truncate + min-w-0 */
      .database-status-btn,
      [data-dbstatus-btn] {
        width: 100% !important;
        max-width: 100% !important;
        overflow: hidden !important;
      }
      .database-status-btn > svg,
      [data-dbstatus-btn] > svg {
        flex-shrink: 0 !important;
      }
      .database-status-btn > span,
      [data-dbstatus-btn] > span {
        min-width: 0 !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
      }
      .database-status-btn > span:nth-of-type(3),
      [data-dbstatus-btn] > span:nth-of-type(3) {
        flex: 1 1 0% !important;
      }
    `;
    document.head.appendChild(style);

    // 標記 button 方便選擇
    const allBtns = Array.from(document.querySelectorAll('button'));
    const btn = allBtns.find((b) => /v4-test-folder|未選擇/.test(b.innerText || ''));
    if (btn) {
      btn.setAttribute('data-dbstatus-btn', '1');
    }
  });
}

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error('PAGE-ERROR:', e.message));

  await setup(page, context);

  // === Phase B (BEFORE): 量測現有狀態 ===
  const before = await injectLongErrorAndMeasure(page);
  console.log('BEFORE:', JSON.stringify(before, null, 2));
  if (!before.ok) {
    await page.screenshot({ path: resolve(__dirname, 'dbstatus-error.png'), fullPage: true });
    console.error('BEFORE failed:', before);
    await browser.close();
    process.exit(1);
  }
  const beforePath = resolve(__dirname, 'dbstatus-before.png');
  await page.screenshot({ path: beforePath, fullPage: false });
  console.log('BEFORE screenshot:', beforePath);

  // === Phase C (AFTER): 套用 fix CSS + 再量測 ===
  await applyFixCSS(page);
  await page.waitForTimeout(300);
  const after = await injectLongErrorAndMeasure(page);
  console.log('AFTER:', JSON.stringify(after, null, 2));
  if (!after.ok) {
    console.error('AFTER failed:', after);
    await browser.close();
    process.exit(1);
  }
  const afterPath = resolve(__dirname, 'dbstatus-after.png');
  await page.screenshot({ path: afterPath, fullPage: false });
  console.log('AFTER screenshot:', afterPath);

  // === Phase D: 判定 ===
  const SIDEBAR_WIDTH = 240;
  const overflowsBefore = before.btnWidth > SIDEBAR_WIDTH + 20;
  const overflowsAfter = after.btnWidth > SIDEBAR_WIDTH + 20;
  const heightReduced = after.btnHeight < before.btnHeight;

  const result = {
    before: {
      measured: before,
      screenshot: beforePath,
      overflows: overflowsBefore,
    },
    after: {
      measured: after,
      screenshot: afterPath,
      overflows: overflowsAfter,
    },
    fixEffective: overflowsBefore && !overflowsAfter && heightReduced,
    sidebarWidth: SIDEBAR_WIDTH,
    longError: LONG_ERROR,
    cssChanges: {
      button: 'w-full overflow-hidden',
      folderIcon: 'flex-shrink-0',
      displayNameSpan: 'truncate min-w-0',
      statusWrapSpan: 'truncate min-w-0 flex-1',
      chevronIcon: 'flex-shrink-0',
      errDropdownSection: 'max-h-32 overflow-y-auto',
      errDropdownText: 'break-words',
    },
  };
  writeFileSync(resolve(__dirname, 'dbstatus-result.json'), JSON.stringify(result, null, 2));
  console.log('VERDICT:', JSON.stringify({
    beforeOverflow: overflowsBefore,
    afterOverflow: overflowsAfter,
    beforeSize: { w: before.btnWidth, h: before.btnHeight },
    afterSize: { w: after.btnWidth, h: after.btnHeight },
    fixEffective: result.fixEffective,
  }, null, 2));

  await browser.close();
  return result;
}

run().catch((e) => {
  console.error('TEST FAILED:', e);
  process.exit(1);
});