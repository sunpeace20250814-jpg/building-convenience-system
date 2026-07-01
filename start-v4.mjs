#!/usr/bin/env node
/**
 * V4 一鍵啟動器（Node.js 版，跨平台）
 *
 * 流程：
 *   1. 啟 server（DATA_DIR 指向用戶雲端硬碟）
 *   2. 啟 vite preview（:9527）
 *   3. 開瀏覽器（Edge App mode）
 *   4. 等 Ctrl+C 一起關
 *
 * Usage:
 *   node start-v4.mjs                    # 預設雲端硬碟
 *   node start-v4.mjs --local            # 用 server/data 本地 .db
 *   node start-v4.mjs --no-browser       # 不開瀏覽器
 *   node start-v4.mjs --data-dir=<path>  # 自訂 DATA_DIR
 */

import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import http from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname; // start-v4.mjs 本身就在 repo root
const SERVER_DIR = join(ROOT, 'server');
const CLIENT_DIR = join(ROOT, 'client');

// 預設雲端硬碟路徑
const DEFAULT_CLOUD = 'G:\\我的雲端硬碟\\V4住戶管理';

// Args
const args = process.argv.slice(2);
let dataDir = DEFAULT_CLOUD;
let openBrowser = true;
for (const arg of args) {
  if (arg === '--local') dataDir = join(SERVER_DIR, 'data');
  else if (arg === '--no-browser') openBrowser = false;
  else if (arg.startsWith('--data-dir=')) dataDir = arg.slice(11);
  else if (arg === '--help' || arg === '-h') {
    console.log(`Usage: node start-v4.mjs [--local] [--no-browser] [--data-dir=<path>]`);
    process.exit(0);
  }
}

console.log('\n========================================');
console.log('  V4 啟動器');
console.log('========================================');
console.log(`  DATA_DIR : ${dataDir}`);
console.log(`  Repo     : ${ROOT}`);
console.log(`  Server   : http://localhost:3001`);
console.log(`  Client   : http://localhost:9527`);
console.log('========================================\n');

// 確保 DATA_DIR 存在
if (!existsSync(dataDir)) {
  console.log(`[start-v4] DATA_DIR 不存在，建立中: ${dataDir}`);
  mkdirSync(dataDir, { recursive: true });
}

// 找出實際可用的 node 執行檔（process.execPath 有時是 nvm symlink 失敗）
function findNode() {
  return 'node'; // 靠 PATH（cmd 確認 C:\APP\nodejs\node.exe 在 PATH）
}

// 啟 server（用 cmd.exe 處理 spawn，避免 Node.js spawn API 在 Windows 上的 ENOENT 問題）
// Windows 上 Node.js spawn 對 PATHEXT 處理有限制，所以給完整路徑 + .exe 副檔名
const CMD_PATH = process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe';

function startServer() {
  console.log('[start-v4] 啟 server (port 3001)...');
  const child = spawn(
    CMD_PATH,
    ['/c', 'node --import tsx/esm src/index.ts'],
    {
      cwd: SERVER_DIR,
      env: { ...process.env, DATA_DIR: dataDir, PORT: '3001' },
      stdio: 'inherit',
      windowsHide: true,
    }
  );
  return child;
}

// 啟 vite preview
function startVite() {
  console.log('[start-v4] 啟 vite preview (port 9527)...');
  const child = spawn(
    CMD_PATH,
    ['/c', 'node ./node_modules/vite/bin/vite.js preview --port 9527 --strictPort --host'],
    {
      cwd: CLIENT_DIR,
      stdio: 'inherit',
      windowsHide: true,
    }
  );
  return child;
}

async function waitForUrl(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          if (res.statusCode && res.statusCode < 500) resolve(res);
          else reject(new Error(`status=${res.statusCode}`));
          res.resume();
        });
        req.on('error', reject);
        req.setTimeout(2000, () => req.destroy());
      });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return false;
}

async function openBrowserApp(url) {
  // Edge App mode（獨立視窗，無網址列）
  const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const fallback = 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe';
  const target = existsSync(edge) ? edge : fallback;
  if (!existsSync(target)) {
    console.log('[start-v4] Edge 不在標準路徑，開預設瀏覽器');
    execSync(`start "" "${url}"`, { stdio: 'ignore', shell: 'cmd.exe' });
    return;
  }
  console.log('[start-v4] 開啟 Edge App mode...');
  spawn(target, [`--app=${url}`], {
    detached: true,
    stdio: 'ignore',
  }).unref();
}

const serverProc = startServer();
const viteProc = startVite();

console.log('[start-v4] 等 server ready...');
const serverOk = await waitForUrl('http://localhost:3001/api/health', 30000);
console.log(`[start-v4] server: ${serverOk ? '✓' : '✗'}`);

console.log('[start-v4] 等 vite preview ready...');
const viteOk = await waitForUrl('http://localhost:9527/', 30000);
console.log(`[start-v4] vite:   ${viteOk ? '✓' : '✗'}`);

if (openBrowser && serverOk && viteOk) {
  await openBrowserApp('http://localhost:9527');
}

console.log('\n[start-v4] 全部就緒，按 Ctrl+C 關閉\n');

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[start-v4] 收到 ${signal}，關閉中...`);
  try { serverProc.kill('SIGTERM'); } catch {}
  try { viteProc.kill('SIGTERM'); } catch {}
  setTimeout(() => process.exit(0), 1500);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// 任一 child 死了就一起關
serverProc.on('exit', (code) => {
  if (!shuttingDown) {
    console.log(`[start-v4] server exit(${code})，關閉 vite...`);
    try { viteProc.kill(); } catch {}
    process.exit(code ?? 0);
  }
});
viteProc.on('exit', (code) => {
  if (!shuttingDown) {
    console.log(`[start-v4] vite exit(${code})，關閉 server...`);
    try { serverProc.kill(); } catch {}
    process.exit(code ?? 0);
  }
});