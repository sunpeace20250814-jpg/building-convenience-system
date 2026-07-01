/**
 * 守護測試 — M-59 修復
 *
 * APP 系統紀錄從 client-side execute/queryAll 搬到 server-side.
 * - server schema 加 app_logs table
 * - server route 已註冊到 /api/app-logs
 * - client 不再用 storage/database.ts 的 execute/queryAll
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SERVER_SCHEMA = join(__dirname, '../src/db/schema.ts');
const SERVER_ROUTES = join(__dirname, '../src/routes/app-logs.ts');
const SERVER_INDEX = join(__dirname, '../src/index.ts');
const CLIENT_APPLOG = join(__dirname, '../../client/src/storage/appLog.ts');
const CLIENT_AUDIT = join(__dirname, '../../client/src/modules-system/pages/AuditLog.tsx');

describe('M-59 守護 — APP 系統紀錄 server-side migration', () => {
  it('server schema 加 app_logs table', () => {
    const src = readFileSync(SERVER_SCHEMA, 'utf-8');
    expect(src).toMatch(/CREATE TABLE IF NOT EXISTS app_logs/);
    expect(src).toMatch(/CREATE INDEX IF NOT EXISTS idx_app_logs_timestamp/);
    expect(src).toMatch(/'app_logs'/); // ALL_TABLES
  });

  it('server/src/routes/app-logs.ts 存在,提供 4 endpoints', () => {
    const src = readFileSync(SERVER_ROUTES, 'utf-8');
    expect(src.length).toBeGreaterThan(0);
    expect(src).toMatch(/fastify\.post[<(]/);
    expect(src).toMatch(/['"]\/app-logs['"]/);
    expect(src).toMatch(/['"]\/app-logs\/stats['"]/);
    expect(src).toMatch(/fastify\.delete[<(]/);
  });

  it('server route 有 log 上限清理 (10000 筆)', () => {
    const src = readFileSync(SERVER_ROUTES, 'utf-8');
    expect(src).toMatch(/MAX_LOG_ROWS\s*=\s*10_000/);
    expect(src).toMatch(/DELETE FROM app_logs WHERE id IN/);
  });

  it('server/index.ts 註冊 appLogsRoutes', () => {
    const src = readFileSync(SERVER_INDEX, 'utf-8');
    expect(src).toMatch(/import.*appLogsRoutes.*app-logs\.js/);
    expect(src).toMatch(/fastify\.register\(appLogsRoutes\)/);
  });

  it('client appLog.ts 改用 fetch (不再用 storage/database)', () => {
    const src = readFileSync(CLIENT_APPLOG, 'utf-8');
    expect(src).toMatch(/import \{ apiClient \} from '@\/lib\/apiClient'/);
    // 不應再 import execute/queryAll from database
    expect(src).not.toMatch(/import \{ execute, queryAll \}/);
    // 不應再用 execute(...)
    expect(src).not.toMatch(/execute\(/);
    // 不應再用 queryAll<AppLog>
    expect(src).not.toMatch(/queryAll<AppLog>/);
  });

  it('client log() 是 fire-and-forget (不 await)', () => {
    const src = readFileSync(CLIENT_APPLOG, 'utf-8');
    // log() 內呼叫 apiClient.post 不 await
    const logMatch = src.match(/export function log\([\s\S]*?\n\}/);
    expect(logMatch).toBeTruthy();
    expect(logMatch![0]).toMatch(/apiClient\.post/);
    expect(logMatch![0]).toMatch(/\.catch\(/);
  });

  it('client getLogs/clearLogs/getLogStats 改 async', () => {
    const src = readFileSync(CLIENT_APPLOG, 'utf-8');
    expect(src).toMatch(/export async function getLogs/);
    expect(src).toMatch(/export async function clearLogs/);
    expect(src).toMatch(/export async function getLogStats/);
  });

  it('AuditLog.tsx 配合 async API (refresh 是 async)', () => {
    const src = readFileSync(CLIENT_AUDIT, 'utf-8');
    expect(src).toMatch(/const refresh = async/);
    expect(src).toMatch(/await clearLogs/);
    // 不應再直接呼叫 sync getLogs() (除 import 外)
    expect(src).not.toMatch(/setLogs\(getLogs\(/);
    expect(src).not.toMatch(/setStats\(getLogStats\(\)\)/);
  });
});