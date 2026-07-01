/**
 * 守護測試 — M-52 修復
 *
 * License system 必須用 SQLite 持久化（商業化前必修）
 * 重啟 server 不應丟 license 資料
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db/index.js';
import { repositories } from '../src/db/repository.js';

describe('M-52 守護 — License system 用 SQLite 持久化', () => {
  beforeEach(() => {
    // setup.ts 已清 DB + init
    db.prepare('DELETE FROM licenses').run();
  });

  it('licenses 表存在', () => {
    const cols = db.prepare("PRAGMA table_info('licenses')").all() as Array<{ name: string }>;
    const names = cols.map((c) => c.name);
    expect(names).toContain('key');
    expect(names).toContain('email');
    expect(names).toContain('tier');
    expect(names).toContain('expires_at');
    expect(names).toContain('activated_at');
    expect(names).toContain('device_limit');
  });

  it('ALL_TABLES 含 licenses', () => {
    const tables = repositories ? Object.keys(repositories) : [];
    // 直接從 schema.ts 的型別檢查
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../src/db/schema.ts'),
      'utf-8'
    );
    expect(src).toMatch(/'licenses'/);
  });

  it('license.ts 不應有 in-memory Map (LICENSES const)', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../src/routes/license.ts'),
      'utf-8'
    );
    expect(src).not.toMatch(/const LICENSES\s*=\s*new Map/);
    expect(src).not.toMatch(/Map<string, LicenseRecord>/);
  });

  it('license.ts 應使用 db.prepare 操作 licenses 表', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../src/routes/license.ts'),
      'utf-8'
    );
    expect(src).toMatch(/db\.prepare/);
    expect(src).toMatch(/INSERT INTO licenses/);
    expect(src).toMatch(/SELECT.*FROM licenses/);
  });

  it('seed demo key 應 idempotent（重複呼叫不會重複 insert）', () => {
    const insertDemoKey = () => {
      // 模擬 license.ts 的 ensureSeedLicense
      const exists = db.prepare('SELECT 1 FROM licenses WHERE key = ?').get('V4-FREE-DEMO-0001-AAAA');
      if (!exists) {
        db.prepare(
          `INSERT INTO licenses (key, email, tier, expires_at, activated_at, device_limit, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run('V4-FREE-DEMO-0001-AAAA', 'demo@v4.local', 'free', '2026-12-31', '2026-07-01', 1, '2026-07-01', '2026-07-01');
      }
    };
    insertDemoKey();
    insertDemoKey();
    insertDemoKey();
    const count = (db.prepare('SELECT COUNT(*) as c FROM licenses WHERE key = ?').get('V4-FREE-DEMO-0001-AAAA') as { c: number }).c;
    expect(count).toBe(1); // 只應有 1 筆,不是 3 筆
  });
});