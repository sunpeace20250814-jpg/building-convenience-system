/**
 * 守護測試 — M-58 修復
 *
 * 通知系統從 client-side queryAll 搬到 server-side.
 * - server route 已註冊到 /api/notifications
 * - client 不再用 storage/database.ts 的 queryAll
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SERVER_ROUTES = join(__dirname, '../src/routes/notifications.ts');
const SERVER_INDEX = join(__dirname, '../src/index.ts');
const CLIENT_SYSTEM = join(__dirname, '../../client/src/notifications/system.ts');

describe('M-58 守護 — 通知系統 server-side migration', () => {
  it('server/src/routes/notifications.ts 存在', () => {
    const src = readFileSync(SERVER_ROUTES, 'utf-8');
    expect(src.length).toBeGreaterThan(0);
    expect(src).toMatch(/export async function notificationsRoutes/);
    expect(src).toMatch(/fastify\.get\(['"]\/notifications['"]/);
  });

  it('server route 處理 3 種通知類型', () => {
    const src = readFileSync(SERVER_ROUTES, 'utf-8');
    expect(src).toMatch(/合約到期/);
    expect(src).toMatch(/零用金餘額偏低/);
    expect(src).toMatch(/即將到來的假日/);
  });

  it('server/index.ts 註冊 notificationsRoutes', () => {
    const src = readFileSync(SERVER_INDEX, 'utf-8');
    expect(src).toMatch(/import.*notificationsRoutes.*notifications\.js/);
    expect(src).toMatch(/fastify\.register\(notificationsRoutes\)/);
  });

  it('client notifications/system.ts 改用 fetch (不再用 storage/database)', () => {
    const src = readFileSync(CLIENT_SYSTEM, 'utf-8');
    expect(src).toMatch(/import \{ apiClient \} from '@\/lib\/apiClient'/);
    // 不應再 import storage/database
    const importLines = src.split('\n').filter((l) => l.trim().startsWith('import'));
    expect(importLines.some((l) => /storage\/database/.test(l))).toBe(false);
    // 不應再 import queryAll
    expect(src).not.toMatch(/queryAll<any>/);
  });

  it('client refreshNotifications 呼叫 /api/notifications', () => {
    const src = readFileSync(CLIENT_SYSTEM, 'utf-8');
    expect(src).toMatch(/apiClient\.get<Notification\[\]>\(['"]\/api\/notifications['"]/);
  });
});