#!/usr/bin/env node
/**
 * V4 verify.mjs — Node.js 版本（Windows 友好）
 * 對應 V4/check.sh — 跑 7 個 acceptance gate
 *
 * Usage:
 *   node V4/verify.mjs                  # 跑全部
 *   node V4/verify.mjs --gate=N         # 只跑 gate N (1-7)
 *   node V4/verify.mjs --skip=6,7       # 跳過 6 + 7
 *   node V4/verify.mjs --skip-build     # 跳過 gate 1+2
 *   node V4/verify.mjs --no-cleanup     # 不自動 kill 背景 process
 *   node V4/verify.mjs --help
 *
 * 退出碼:
 *   0 = 全部 P0 PASS
 *   1 = 有 P0 FAIL
 *   2 = 環境錯誤
 */

import { spawn, execSync, exec } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const execP = promisify(exec);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const SERVER_DIR = join(REPO_ROOT, 'server');
const CLIENT_DIR = join(REPO_ROOT, 'client');
const TEST_SCRIPT_CANDIDATES = [
  join(REPO_ROOT, '.mavis', 'sessions'),
  join(process.env.USERPROFILE || process.env.HOME || '', '.mavis', 'sessions'),
];
function findTestScript() {
  // 搜 .mavis/sessions/*/workspace/test-all-endpoints.mjs
  const candidates = [
    join(REPO_ROOT, '.mavis', 'sessions'),
    join(process.env.USERPROFILE || process.env.HOME || '', '.mavis', 'sessions'),
  ];
  for (const base of candidates) {
    if (!existsSync(base)) continue;
    try {
      const sessions = readdirSync(base);
      for (const s of sessions) {
        const candidate = join(base, s, 'workspace', 'test-all-endpoints.mjs');
        if (existsSync(candidate)) return candidate;
      }
    } catch {}
  }
  return null;
}
const TEST_SCRIPT = findTestScript();

const GATE_TOTAL = 7;
const GATE_RESULTS = []; // "NUM:NAME:STATUS"
const CLEANUP_PROCS = [];
let GATE_PASS = 0, GATE_FAIL = 0, GATE_SKIP = 0, GATE_WARN = 0;
let NO_CLEANUP = false;
let ONLY_GATE = '';
let SKIP_GATES = '';

// 顏色（無 TTY 自動關）
const isTTY = process.stdout.isTTY;
const C = {
  RED: isTTY ? '\x1b[0;31m' : '',
  GREEN: isTTY ? '\x1b[0;32m' : '',
  YELLOW: isTTY ? '\x1b[0;33m' : '',
  BLUE: isTTY ? '\x1b[0;34m' : '',
  CYAN: isTTY ? '\x1b[0;36m' : '',
  BOLD: isTTY ? '\x1b[1m' : '',
  RESET: isTTY ? '\x1b[0m' : '',
};

const ts = () => new Date().toTimeString().slice(0, 8);
const info  = (...a) => console.log(`${C.CYAN}[${ts()}]${C.RESET}`, ...a);
const ok    = (...a) => console.log(`${C.GREEN}[${ts()}] ✓${C.RESET}`, ...a);
const warn  = (...a) => console.log(`${C.YELLOW}[${ts()}] ⚠${C.RESET}`, ...a);
const err   = (...a) => console.log(`${C.RED}[${ts()}] ✗${C.RESET}`, ...a);
const section = (s) => {
  console.log(`\n${C.BOLD}${C.BLUE}========== ${s} ==========${C.RESET}\n`);
};

// ---- Args ----
for (const arg of process.argv.slice(2)) {
  if (arg === '--help' || arg === '-h') {
    console.log(`Usage: node verify.mjs [--gate=N] [--skip=6,7] [--skip-build] [--no-cleanup] [--help]`);
    process.exit(0);
  } else if (arg.startsWith('--gate=')) ONLY_GATE = arg.slice(7);
  else if (arg.startsWith('--skip=')) SKIP_GATES += ',' + arg.slice(7);
  else if (arg === '--skip-build') SKIP_GATES += ',1,2';
  else if (arg === '--no-cleanup') NO_CLEANUP = true;
  else { err(`Unknown arg: ${arg}`); process.exit(2); }
}
SKIP_GATES = SKIP_GATES.replace(/^,/, '');

const isSkipped = (n) => SKIP_GATES && SKIP_GATES.split(',').includes(String(n));
const shouldRun = (n) => (!ONLY_GATE || ONLY_GATE === String(n)) && !isSkipped(n);

const recordGate = (num, name, status, level = 'P0') => {
  if (level === 'P1' && status === 'FAIL') status = 'WARN';
  GATE_RESULTS.push(`${num}:${name}:${status}`);
  if (status === 'PASS') GATE_PASS++;
  else if (status === 'FAIL') GATE_FAIL++;
  else if (status === 'SKIP') GATE_SKIP++;
  else if (status === 'WARN') GATE_WARN++;
};

// ---- 環境檢查 ----
async function checkEnv() {
  section('環境檢查');
  let miss = 0;
  for (const tool of ['pnpm', 'node']) {
    try {
      const { stdout } = await execP(`${tool} --version`);
      ok(`${tool}: ${stdout.trim()}`);
    } catch {
      err(`${tool}: NOT FOUND`);
      miss = 1;
    }
  }
  if (miss) {
    err('請先安裝 pnpm + node 後再跑');
    process.exit(2);
  }
  ok(`Repo root: ${REPO_ROOT}`);
  ok(`Server:    ${SERVER_DIR}`);
  ok(`Client:    ${CLIENT_DIR}`);
  ok(`Test:      ${TEST_SCRIPT}`);
}

// ---- 啟 server (背景) ----
async function startServerBg() {
  // 先試 reuse
  for (let i = 0; i < 3; i++) {
    if (await curlOk('http://localhost:3001/api/health', 3000)) {
      ok('Server already running on :3001 (reuse)');
      return 0;
    }
    await sleep(1000);
  }
  info('啟 server (port 3001)...');
  const logfile = join(REPO_ROOT, 'tmp-server.log');
  const child = spawn('cmd.exe', ['/c', 'pnpm', 'dev'], {
    cwd: SERVER_DIR,
    shell: false,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  CLEANUP_PROCS.push(child.pid);
  const logStream = (data) => {
    try { writeFileSync(logfile, data, { flag: 'a' }); } catch {}
  };
  child.stdout.on('data', logStream);
  child.stderr.on('data', logStream);
  info(`  PID=${child.pid}  log=${logfile}`);

  for (let i = 0; i < 60; i++) {
    if (await curlOk('http://localhost:3001/api/health', 3000)) {
      ok(`Server ready (took ${(i+1)*0.5}s)`);
      return 0;
    }
    if (child.killed || child.exitCode !== null) {
      err(`Server process died (PID=${child.pid})`);
      try { info('--- log tail ---'); const c = readFileSync(logfile, 'utf8'); console.log(c.split('\n').slice(-20).join('\n')); } catch {}
      return 1;
    }
    await sleep(500);
  }
  err('Server failed to start within 30s');
  return 1;
}

async function startVitePreviewBg() {
  for (let i = 0; i < 3; i++) {
    if (await curlOk('http://localhost:9527/', 3000, false)) {
      ok('Vite preview already running on :9527 (reuse)');
      return 0;
    }
    await sleep(1000);
  }
  info('啟 vite preview (port 9527)...');
  const logfile = join(REPO_ROOT, 'tmp-preview.log');
  const child = spawn('cmd.exe', ['/c', 'pnpm', 'preview', '--port', '9527', '--strictPort'], {
    cwd: CLIENT_DIR,
    shell: false,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  CLEANUP_PROCS.push(child.pid);
  const logStream = (data) => {
    try { writeFileSync(logfile, data, { flag: 'a' }); } catch {}
  };
  child.stdout.on('data', logStream);
  child.stderr.on('data', logStream);
  info(`  PID=${child.pid}  log=${logfile}`);

  for (let i = 0; i < 60; i++) {
    if (await curlOk('http://localhost:9527/', 3000, false)) {
      ok(`Vite preview ready (took ${(i+1)*0.5}s)`);
      return 0;
    }
    if (child.killed || child.exitCode !== null) {
      err(`Vite preview process died (PID=${child.pid})`);
      return 1;
    }
    await sleep(500);
  }
  err('Vite preview failed to start within 30s');
  return 1;
}

async function curlOk(url, timeoutMs = 5000, followBody = false) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (res.status !== 200) return false;
    if (followBody) {
      const body = await res.text();
      return body;
    }
    return true;
  } catch {
    return false;
  }
}

async function curlJson(url, timeoutMs = 5000) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return { status: res.status, body: await res.text() };
  } catch (e) {
    return { status: 0, body: '' };
  }
}

async function cleanup() {
  if (NO_CLEANUP) { warn('Skipping cleanup (--no-cleanup)'); return; }
  if (CLEANUP_PROCS.length === 0) return;
  section('Cleanup');
  for (const pid of CLEANUP_PROCS) {
    try {
      // Windows: taskkill /F /T /PID
      execSync(`taskkill /F /T /PID ${pid} 2>nul`, { stdio: 'ignore' });
      info(`Killed PID ${pid}`);
    } catch {}
  }
  await sleep(1000);
  for (const pid of CLEANUP_PROCS) {
    try {
      execSync(`taskkill /F /T /PID ${pid} 2>nul`, { stdio: 'ignore' });
      warn(`Force killed PID ${pid}`);
    } catch {}
  }
}

// ---- Gate 1: Server build ----
async function gate1() {
  section(`Gate 1 / ${GATE_TOTAL} — Server build`);
  const start = Date.now();
  try {
    await execP('pnpm build', { cwd: SERVER_DIR });
    const dur = ((Date.now() - start) / 1000).toFixed(1);
    ok(`Server build PASS (${dur}s)`);
    recordGate(1, 'Server build', 'PASS', 'P0');
    return 0;
  } catch (e) {
    const dur = ((Date.now() - start) / 1000).toFixed(1);
    err(`Server build FAIL (${dur}s)`);
    console.log(String(e.stdout || e.message).split('\n').slice(-30).map(l => '  ' + l).join('\n'));
    recordGate(1, 'Server build', 'FAIL', 'P0');
    return 1;
  }
}

// ---- Gate 2: Client build ----
async function gate2() {
  section(`Gate 2 / ${GATE_TOTAL} — Client build`);
  const start = Date.now();
  try {
    await execP('pnpm build', { cwd: CLIENT_DIR });
    const dur = ((Date.now() - start) / 1000).toFixed(1);
    ok(`Client build PASS (${dur}s)`);
    recordGate(2, 'Client build', 'PASS', 'P0');
    return 0;
  } catch (e) {
    const dur = ((Date.now() - start) / 1000).toFixed(1);
    err(`Client build FAIL (${dur}s)`);
    console.log(String(e.stdout || e.message).split('\n').slice(-30).map(l => '  ' + l).join('\n'));
    recordGate(2, 'Client build', 'FAIL', 'P0');
    return 1;
  }
}

// ---- Gate 3: Server smoke ----
async function gate3() {
  section(`Gate 3 / ${GATE_TOTAL} — Server smoke (5 endpoints)`);
  if (await startServerBg() !== 0) {
    err('Cannot start server, aborting gate 3');
    recordGate(3, 'Server smoke', 'FAIL', 'P0');
    return 1;
  }
  const endpoints = [
    { method: 'GET', path: '/api/health',          expect: { key: 'ok', val: 'true', quoted: false } },
    { method: 'GET', path: '/api/info',            expect: { key: 'name', val: 'v4-resident-system', quoted: true } },
    { method: 'GET', path: '/api/residents',       expect: null },
    { method: 'GET', path: '/api/settings/buildings', expect: null },
    { method: 'GET', path: '/api/schedule',        expect: null },
  ];
  let rc = 0;
  for (const ep of endpoints) {
    const url = `http://localhost:3001${ep.path}`;
    let body = '', status = 0;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const r = await curlJson(url, 5000);
      status = r.status;
      body = r.body;
      if (status === 200) break;
      info(`  ${ep.method} ${ep.path} → ${status} (retry ${attempt}/3)`);
      await sleep(1000);
    }
    if (status === 200) {
      if (!ep.expect) {
        ok(`${ep.method} ${ep.path} → 200`);
      } else {
        const { key, val, quoted } = ep.expect;
        const pattern = quoted ? `"${key}":"${val}"` : `"${key}":${val}`;
        if (body.includes(pattern)) {
          ok(`${ep.method} ${ep.path} → 200 (contains ${key}=${val})`);
        } else {
          err(`${ep.method} ${ep.path} → 200 but missing ${key}=${val}`);
          console.log('  body: ' + body.slice(0, 200));
          rc = 1;
        }
      }
    } else {
      err(`${ep.method} ${ep.path} → ${status} (expected 200)`);
      rc = 1;
    }
  }
  if (rc === 0) {
    ok('Server smoke PASS');
    recordGate(3, 'Server smoke', 'PASS', 'P0');
  } else {
    err('Server smoke FAIL');
    recordGate(3, 'Server smoke', 'FAIL', 'P0');
  }
  return rc;
}

// ---- Gate 4: Client proxy ----
async function gate4() {
  section(`Gate 4 / ${GATE_TOTAL} — Client proxy smoke (vite :9527 → server :3001)`);
  if (await startServerBg() !== 0) {
    err('Cannot start server, aborting gate 4');
    recordGate(4, 'Client proxy', 'FAIL', 'P0');
    return 1;
  }
  if (await startVitePreviewBg() !== 0) {
    err('Cannot start vite preview, aborting gate 4');
    recordGate(4, 'Client proxy', 'FAIL', 'P0');
    return 1;
  }
  let rc = 0;
  const r1 = await curlJson('http://localhost:9527/api/health', 5000);
  if (r1.status !== 200) {
    err(`GET http://localhost:9527/api/health → ${r1.status} (expected 200)`);
    rc = 1;
  } else if (!r1.body.includes('"ok":true')) {
    err('Proxy response missing ok:true');
    console.log('  body: ' + r1.body.slice(0, 200));
    rc = 1;
  } else {
    ok('GET http://localhost:9527/api/health → 200 (proxied to :3001, ok:true)');
  }
  const r2 = await curlJson('http://localhost:9527/', 5000);
  if (r2.status === 200) {
    ok('GET http://localhost:9527/ → 200 (index.html served)');
  } else {
    err(`GET http://localhost:9527/ → ${r2.status} (expected 200)`);
    rc = 1;
  }
  if (rc === 0) {
    ok('Client proxy smoke PASS');
    recordGate(4, 'Client proxy', 'PASS', 'P0');
  } else {
    err('Client proxy smoke FAIL');
    recordGate(4, 'Client proxy', 'FAIL', 'P0');
  }
  return rc;
}

// ---- Gate 5: Full API test ----
async function gate5() {
  section(`Gate 5 / ${GATE_TOTAL} — Full API test (30 endpoints)`);
  if (!existsSync(TEST_SCRIPT)) {
    err(`Test script not found: ${TEST_SCRIPT}`);
    recordGate(5, 'Full API test', 'FAIL', 'P0');
    return 1;
  }
  if (await startServerBg() !== 0) {
    err('Cannot start server, aborting gate 5');
    recordGate(5, 'Full API test', 'FAIL', 'P0');
    return 1;
  }
  const start = Date.now();
  try {
    const { stdout, stderr } = await execP(`node "${TEST_SCRIPT}"`);
    const dur = ((Date.now() - start) / 1000).toFixed(1);
    console.log(stdout.split('\n').map(l => '  ' + l).join('\n'));
    if (stderr) console.log(stderr.split('\n').map(l => '  ' + l).join('\n'));
    ok(`Full API test PASS (${dur}s)`);
    recordGate(5, 'Full API test', 'PASS', 'P0');
    return 0;
  } catch (e) {
    const dur = ((Date.now() - start) / 1000).toFixed(1);
    const out = (e.stdout || '') + (e.stderr || '');
    console.log(out.split('\n').map(l => '  ' + l).join('\n'));
    err(`Full API test FAIL (${dur}s)`);
    recordGate(5, 'Full API test', 'FAIL', 'P0');
    return 1;
  }
}

// ---- Gate 6: 0 queryAll in stores/ ----
async function gate6() {
  section(`Gate 6 / ${GATE_TOTAL} — 0 queryAll/execute in client/src/stores/`);
  const storesDir = join(CLIENT_DIR, 'src', 'stores');
  if (!existsSync(storesDir)) {
    err(`Stores dir not found: ${storesDir}`);
    recordGate(6, 'No queryAll', 'FAIL', 'P0');
    return 1;
  }
  const matches = [];
  const files = readdirSync(storesDir).filter(f => f.endsWith('.ts'));
  for (const f of files) {
    const content = readFileSync(join(storesDir, f), 'utf8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.match(/^\s*[\/*]/) || line.match(/^\s*\*\s/)) continue; // 跳過註解
      if (line.match(/\b(queryAll|execute)\(/)) {
        matches.push(`${storesDir}\\${f}:${i+1}: ${line.trim()}`);
      }
    }
  }
  if (matches.length === 0) {
    ok('0 queryAll/execute in stores/ ✓');
    recordGate(6, 'No queryAll', 'PASS', 'P0');
    return 0;
  } else {
    err('Found queryAll/execute in stores/:');
    matches.forEach(m => console.log('  ' + m));
    recordGate(6, 'No queryAll', 'FAIL', 'P0');
    return 1;
  }
}

// ---- Gate 7: Dead code ----
async function gate7() {
  section(`Gate 7 / ${GATE_TOTAL} — 死碼檢查 (sql.js / IndexedDB / FSA in client/src/{api,modules}/)`);
  let rc = 0;
  const dirs = [join(CLIENT_DIR, 'src', 'api'), join(CLIENT_DIR, 'src', 'modules')];
  // 1. sql.js / fake-indexeddb / indexedDB
  const sqljs = [];
  for (const d of dirs) {
    if (!existsSync(d)) continue;
    const files = readdirSync(d, { recursive: true }).filter(f => (f.endsWith('.ts') || f.endsWith('.tsx')));
    for (const f of files) {
      const fp = join(d, f);
      if (fp.includes('StorageSettings.tsx')) continue; // 白名單
      const content = readFileSync(fp, 'utf8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(/from\s+['"]sql\.js|from\s+['"]sql\.js\/dist|from\s+['"]fake-indexeddb|indexedDB/)) {
          sqljs.push(`${fp}:${i+1}: ${lines[i].trim()}`);
        }
      }
    }
  }
  if (sqljs.length === 0) {
    ok('0 sql.js / indexedDB import in api/ + modules/ (StorageSettings.tsx whitelisted)');
  } else {
    err('Found sql.js / indexedDB in api/ + modules/:');
    sqljs.forEach(m => console.log('  ' + m));
    rc = 1;
  }
  // 2. FSA API
  const fsa = [];
  for (const d of dirs) {
    if (!existsSync(d)) continue;
    const files = readdirSync(d, { recursive: true }).filter(f => (f.endsWith('.ts') || f.endsWith('.tsx')));
    for (const f of files) {
      const fp = join(d, f);
      const content = readFileSync(fp, 'utf8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(/showSaveFilePicker|showOpenFilePicker|FileSystemDirectoryHandle|FileSystemFileHandle/)) {
          fsa.push(`${fp}:${i+1}: ${lines[i].trim()}`);
        }
      }
    }
  }
  if (fsa.length === 0) {
    ok('0 FSA API usage in api/ + modules/');
  } else {
    err('Found File System Access API in api/ + modules/:');
    fsa.forEach(m => console.log('  ' + m));
    rc = 1;
  }
  if (rc === 0) {
    ok('Dead code check PASS');
    recordGate(7, 'Dead code', 'PASS', 'P1');
  } else {
    err('Dead code check FAIL (P1 — warning only)');
    recordGate(7, 'Dead code', 'FAIL', 'P1');
  }
  return rc;
}

// ---- Final summary ----
function finalSummary() {
  section('最終總結');
  console.log(`${C.BOLD}Gate results:${C.RESET}`);
  for (const r of GATE_RESULTS) {
    const [num, name, status] = r.split(':');
    if (status === 'PASS') console.log(`  ${C.GREEN}✓ Gate ${num}${C.RESET} ${name}`);
    else if (status === 'FAIL') console.log(`  ${C.RED}✗ Gate ${num}${C.RESET} ${name}`);
    else if (status === 'SKIP') console.log(`  ${C.YELLOW}⊘ Gate ${num}${C.RESET} ${name} (skipped)`);
    else if (status === 'WARN') console.log(`  ${C.YELLOW}! Gate ${num}${C.RESET} ${name} (P1 warning)`);
  }
  console.log();
  console.log(`${C.BOLD}Totals:${C.RESET} ${C.GREEN}PASS=${GATE_PASS}${C.RESET}  ${C.RED}FAIL=${GATE_FAIL}${C.RESET}  ${C.YELLOW}WARN=${GATE_WARN}${C.RESET}  ${C.YELLOW}SKIP=${GATE_SKIP}${C.RESET}  (total=${GATE_TOTAL})`);
  console.log();
  if (GATE_FAIL === 0 && GATE_WARN === 0) {
    ok('🎉 ALL GATES PASSED');
  } else if (GATE_FAIL === 0) {
    ok(`🎉 ALL P0 GATES PASSED (with ${GATE_WARN} P1 warning(s))`);
  } else {
    err(`❌ ${GATE_FAIL} P0 GATE(S) FAILED — see above`);
  }
}

// ---- Main ----
async function main() {
  console.log(`${C.BOLD}${C.BLUE}V4 Acceptance Gates — ${new Date().toISOString().slice(0,19).replace('T',' ')}${C.RESET}`);
  console.log(`Repo: ${REPO_ROOT}`);
  await checkEnv();
  process.on('exit', cleanup);
  process.on('SIGINT', async () => { await cleanup(); process.exit(1); });
  process.on('SIGTERM', async () => { await cleanup(); process.exit(1); });

  if (shouldRun(1)) await gate1(); else recordGate(1, 'Server build', 'SKIP', 'P0');
  if (shouldRun(2)) await gate2(); else recordGate(2, 'Client build', 'SKIP', 'P0');
  if (shouldRun(3)) await gate3(); else recordGate(3, 'Server smoke', 'SKIP', 'P0');
  if (shouldRun(4)) await gate4(); else recordGate(4, 'Client proxy', 'SKIP', 'P0');
  if (shouldRun(5)) await gate5(); else recordGate(5, 'Full API test', 'SKIP', 'P0');
  if (shouldRun(6)) await gate6(); else recordGate(6, 'No queryAll', 'SKIP', 'P0');
  if (shouldRun(7)) await gate7(); else recordGate(7, 'Dead code', 'SKIP', 'P1');

  finalSummary();
  process.exit(GATE_FAIL === 0 ? 0 : 1);
}

main().catch(async (e) => { err('FATAL: ' + e.message); console.error(e); await cleanup(); process.exit(2); });