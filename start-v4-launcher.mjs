#!/usr/bin/env node
/**
 * V4 Launcher Server — 純後端啟動器（零依賴，只用 Node.js 內建 http）
 *
 * 用法：node start-v4-launcher.mjs
 *
 * 功能：
 *   - port 3002 跑極輕量 http server（只服務啟動器 UI + 控制 API）
 *   - GET  /              → 啟動器 UI 頁面
 *   - GET  /api/status    → server + vite 狀態
 *   - POST /api/launch    → 啟動 server + vite
 *   - POST /api/stop      → 停止 server + vite
 *   - POST /api/open      → 開 Edge App
 *
 * 雙擊 start-v4-launcher.bat 即可
 */

import http from 'node:http';
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const SERVER_DIR = join(ROOT, 'server');
const CLIENT_DIR = join(ROOT, 'client');
const LOGS_DIR = join(ROOT, 'logs');
const DATA_DIR = 'G:\\我的雲端硬碟\\V4住戶管理';

const PORT = 3002;
const V4_SERVER_PORT = 3001;
const V4_VITE_PORT = 9527;

let serverProc = null;
let viteProc = null;
const CMD_PATH = process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe';

if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });

// ---- Helpers ----
function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/health`, { timeout: 1500 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

function waitFor(url, timeoutMs) {
  return new Promise(async (resolve) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(1500) });
        if (r.status === 200) { resolve(true); return; }
      } catch {}
      await new Promise(r => setTimeout(r, 500));
    }
    resolve(false);
  });
}

function spawnCmd(cwd, command, logFile) {
  const out = require('node:fs').openSync(logFile, 'a');
  const err = require('node:fs').openSync(logFile, 'a');
  return spawn(CMD_PATH, ['/c', command], {
    cwd,
    env: { ...process.env, DATA_DIR, PORT: String(V4_SERVER_PORT) },
    detached: true,
    stdio: ['ignore', out, err],
    windowsHide: true,
  });
}

function killProc(proc) {
  if (!proc) return;
  try { execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: 'ignore' }); } catch {}
}

function killPort(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
    const pids = new Set();
    for (const line of out.split('\n')) {
      const m = line.match(/LISTENING\s+(\d+)/);
      if (m) pids.add(m[1]);
    }
    for (const pid of pids) {
      try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' }); } catch {}
    }
  } catch {}
}

// ---- HTML 啟動器頁面 ----
const HTML = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>V4 啟動器</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: "Microsoft JhengHei", "微軟正黑體", system-ui, sans-serif;
    background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
    margin: 0; padding: 20px; min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
  }
  .card {
    background: white; border-radius: 16px; padding: 32px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    max-width: 540px; width: 100%;
  }
  h1 { margin: 0 0 8px; color: #1e3a8a; font-size: 24px; }
  .subtitle { color: #6b7280; font-size: 13px; margin-bottom: 24px; }
  .status {
    background: #f9fafb; border-radius: 12px; padding: 20px; margin-bottom: 20px;
    font-family: 'Consolas', 'Monaco', monospace; font-size: 13px;
    line-height: 1.8; color: #374151; border: 1px solid #e5e7eb;
  }
  .status > div { display: flex; align-items: center; }
  .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 10px; flex-shrink: 0; }
  .dot-on { background: #10b981; box-shadow: 0 0 8px #10b981; }
  .dot-off { background: #ef4444; }
  .dot-pending { background: #f59e0b; animation: pulse 1.5s infinite; }
  @keyframes pulse { 50% { opacity: 0.4; } }
  .row { display: flex; gap: 10px; margin-bottom: 10px; }
  button {
    flex: 1; padding: 14px 18px; border: none; border-radius: 10px;
    font-size: 14px; font-weight: 600; cursor: pointer; transition: 0.2s;
    font-family: inherit;
  }
  button:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
  button:active:not(:disabled) { transform: translateY(0); }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-primary { background: #10b981; color: white; }
  .btn-danger  { background: #ef4444; color: white; }
  .btn-secondary { background: #6366f1; color: white; }
  .btn-gray { background: #e5e7eb; color: #374151; }
  .log {
    margin-top: 16px; padding: 12px; background: #1f2937; color: #d1d5db;
    border-radius: 8px; font-family: 'Consolas', 'Monaco', monospace;
    font-size: 11px; max-height: 160px; overflow-y: auto; line-height: 1.6;
  }
  .log .err { color: #fca5a5; }
  .log .ok  { color: #6ee7b7; }
  .data-path { font-size: 11px; color: #9ca3af; word-break: break-all; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb; }
</style>
</head>
<body>
<div class="card">
  <h1>🏢 V4 住戶管理系統</h1>
  <div class="subtitle">視覺化啟動器</div>

  <div class="status">
    <div><span class="dot dot-off" id="d-server"></span><b style="width:160px;display:inline-block">後端 Server</b><span style="color:#6b7280">port ${V4_SERVER_PORT}</span><span id="s-server" style="margin-left:12px">未啟動</span></div>
    <div><span class="dot dot-off" id="d-vite"></span><b style="width:160px;display:inline-block">前端 Vite</b><span style="color:#6b7280">port ${V4_VITE_PORT}</span><span id="s-vite" style="margin-left:12px">未啟動</span></div>
    <div class="data-path">📁 資料位置：${DATA_DIR}</div>
  </div>

  <div class="row">
    <button class="btn-primary" id="btn-launch" onclick="launch()">🚀 啟動 V4</button>
    <button class="btn-danger" id="btn-stop" onclick="stop()" disabled>⏹ 停止</button>
  </div>
  <div class="row">
    <button class="btn-secondary" id="btn-open" onclick="openApp()" disabled>🌐 開啟 V4</button>
    <button class="btn-gray" onclick="refresh()">🔄 刷新</button>
  </div>

  <div class="log" id="log"></div>
</div>

<script>
const log = document.getElementById('log');
function append(text, cls = '') {
  const ts = new Date().toLocaleTimeString();
  log.innerHTML += '<div class="' + cls + '">[' + ts + '] ' + text + '</div>';
  log.scrollTop = log.scrollHeight;
}
function setStatus(name, text, dotClass) {
  document.getElementById('s-' + name).textContent = text;
  document.getElementById('d-' + name).className = 'dot ' + dotClass;
}
async function refresh() {
  try {
    const r = await fetch('/api/status');
    const j = await r.json();
    setStatus('server', j.server ? '✓ 運行中' : '未啟動', j.server ? 'dot-on' : 'dot-off');
    setStatus('vite', j.vite ? '✓ 運行中' : '未啟動', j.vite ? 'dot-on' : 'dot-off');
    const running = !!(j.server || j.vite);
    document.getElementById('btn-launch').disabled = running;
    document.getElementById('btn-stop').disabled = !running;
    document.getElementById('btn-open').disabled = !(j.server && j.vite);
  } catch (e) {
    append('刷新失敗：' + e.message, 'err');
  }
}
async function launch() {
  document.getElementById('btn-launch').disabled = true;
  append('啟動中...');
  setStatus('server', '啟動中...', 'dot-pending');
  setStatus('vite', '啟動中...', 'dot-pending');
  try {
    const r = await fetch('/api/launch', { method: 'POST' });
    const j = await r.json();
    append(j.ok ? '✓ ' + j.message : '✗ ' + j.message, j.ok ? 'ok' : 'err');
  } catch (e) {
    append('✗ 啟動失敗：' + e.message, 'err');
  }
  await refresh();
}
async function stop() {
  if (!confirm('確定要停止 V4 服務嗎？')) return;
  append('停止中...');
  try {
    const r = await fetch('/api/stop', { method: 'POST' });
    const j = await r.json();
    append(j.ok ? '✓ ' + j.message : '✗ ' + j.message, j.ok ? 'ok' : 'err');
  } catch (e) {
    append('✗ ' + e.message, 'err');
  }
  await refresh();
}
async function openApp() {
  await fetch('/api/open', { method: 'POST' });
  append('已開啟 V4');
}
refresh();
setInterval(refresh, 3000);
</script>
</body>
</html>`;

// ---- HTTP routes ----
const routes = {
  'GET /': (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML);
  },
  'GET /api/status': async (req, res) => {
    const serverUp = await checkPort(V4_SERVER_PORT);
    const viteUp = await checkPort(V4_VITE_PORT);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      server: serverUp ? { pid: serverProc?.pid || '?' } : null,
      vite: viteUp ? { pid: viteProc?.pid || '?' } : null,
    }));
  },
  'POST /api/launch': async (req, res) => {
    if (await checkPort(V4_SERVER_PORT)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, message: 'Server 已在 :3001 運行中' }));
      return;
    }
    if (!existsSync(DATA_DIR)) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, message: `DATA_DIR 不存在：${DATA_DIR}` }));
      return;
    }
    serverProc = spawnCmd(SERVER_DIR, 'node --import tsx/esm src/index.ts', join(LOGS_DIR, 'server.log'));
    viteProc = spawnCmd(CLIENT_DIR, `node ./node_modules/vite/bin/vite.js preview --port ${V4_VITE_PORT} --strictPort --host`, join(LOGS_DIR, 'vite.log'));
    const ok1 = await waitFor(`http://localhost:${V4_SERVER_PORT}/api/health`, 30000);
    const ok2 = await waitFor(`http://localhost:${V4_VITE_PORT}/`, 30000);
    if (!ok1) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, message: 'Server 啟動逾時' }));
      return;
    }
    if (!ok2) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, message: 'Vite 啟動逾時（Server 已起）' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, message: `Server + Vite 已啟動（PID ${serverProc.pid} + ${viteProc.pid}）` }));
  },
  'POST /api/stop': (req, res) => {
    killProc(serverProc); killProc(viteProc);
    killPort(V4_SERVER_PORT); killPort(V4_VITE_PORT);
    serverProc = null; viteProc = null;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, message: '已停止' }));
  },
  'POST /api/open': (req, res) => {
    const url = `http://localhost:${V4_VITE_PORT}`;
    const edges = [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ];
    for (const p of edges) {
      if (existsSync(p)) {
        spawn(p, [`--app=${url}`], { detached: true, stdio: 'ignore' }).unref();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, message: '已開啟 Edge App' }));
        return;
      }
    }
    spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, message: '已開啟預設瀏覽器' }));
  },
};

const server = http.createServer(async (req, res) => {
  const key = `${req.method} ${req.url.split('?')[0]}`;
  const handler = routes[key];
  if (handler) {
    try { await handler(req, res); } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, message: e.message }));
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, message: 'Not found' }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('  ╔════════════════════════════════════════════╗');
  console.log('  ║   V4 啟動器已啟動                          ║');
  console.log('  ╚════════════════════════════════════════════╝');
  console.log('');
  console.log(`  🌐 http://localhost:${PORT}`);
  console.log('');
  console.log('  雙擊 start-v4-launcher.bat 也會自動開啟');
  console.log('');

  // 自動開瀏覽器到啟動器
  setTimeout(() => {
    const edges = [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ];
    for (const p of edges) {
      if (existsSync(p)) {
        spawn(p, [`--app=http://localhost:${PORT}`], { detached: true, stdio: 'ignore' }).unref();
        return;
      }
    }
    spawn('cmd', ['/c', 'start', '', `http://localhost:${PORT}`], { detached: true, stdio: 'ignore' }).unref();
  }, 500);
});

// 退出時清掉
process.on('SIGINT', async () => {
  console.log('\n[launcher] 關閉中...');
  killProc(serverProc); killProc(viteProc);
  killPort(V4_SERVER_PORT); killPort(V4_VITE_PORT);
  server.close(() => process.exit(0));
});
process.on('SIGTERM', () => process.kill(process.pid, 'SIGINT'));