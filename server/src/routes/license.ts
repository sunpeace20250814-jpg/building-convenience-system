/**
 * License 系統 — Server 端
 *
 * M-52 修復 (2026-07-01):
 *   - 原本 in-memory Map → server 重啟資料全失 (商業化致命)
 *   - 改用 SQLite 持久化 (licenses 表)
 *
 * AI 友善說明：
 * - key 格式：V4-{TIER}-{YYYYMMDD}-{RANDOM}
 *   例如：V4-PRO-20260620-A7K9
 * - 三種層級：free（試用 30 天）、pro（年訂閱）、enterprise（永久）
 * - 預設種子 key 給 demo 用
 */

import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';

type Tier = 'free' | 'pro' | 'enterprise';

interface LicenseRecord {
  key: string;
  email: string;
  tier: Tier;
  expiresAt: string;
  activatedAt: string;
  deviceLimit: number;
}

interface LicenseRow {
  key: string;
  email: string;
  tier: string;
  expires_at: string;
  activated_at: string;
  device_limit: number;
}

const TIER_LIMITS: Record<Tier, { days: number; deviceLimit: number; name: string }> = {
  free: { days: 30, deviceLimit: 1, name: '免費試用' },
  pro: { days: 365, deviceLimit: 5, name: '專業版（年訂閱）' },
  enterprise: { days: 36500, deviceLimit: 999, name: '企業版（永久）' },
};

/** 解析 key 格式 */
function parseKey(key: string): { valid: boolean; tier?: Tier } {
  const m = key.match(/^V4-(FREE|PRO|ENT)-\d{8}-[A-Z0-9]{4}$/);
  if (!m) return { valid: false };
  const tierMap: Record<string, Tier> = { FREE: 'free', PRO: 'pro', ENT: 'enterprise' };
  return { valid: true, tier: tierMap[m[1]] };
}

/** SQLite row → API DTO */
function rowToRecord(row: LicenseRow): LicenseRecord {
  return {
    key: row.key,
    email: row.email,
    tier: row.tier as Tier,
    expiresAt: row.expires_at,
    activatedAt: row.activated_at,
    deviceLimit: row.device_limit,
  };
}

/** 確保預設 demo key 存在 (idempotent) */
function ensureSeedLicense(): void {
  const exists = db.prepare('SELECT 1 FROM licenses WHERE key = ?').get('V4-FREE-DEMO-0001-AAAA');
  if (!exists) {
    const now = new Date();
    const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    db.prepare(`
      INSERT INTO licenses (key, email, tier, expires_at, activated_at, device_limit, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'V4-FREE-DEMO-0001-AAAA',
      'demo@v4.local',
      'free',
      expires.toISOString(),
      now.toISOString(),
      1,
      now.toISOString(),
      now.toISOString()
    );
  }
}

/** 啟用新 license */
function activateLicense(key: string, email: string): LicenseRecord {
  const parsed = parseKey(key);
  if (!parsed.valid || !parsed.tier) {
    throw new Error('無效的 License Key 格式（應為 V4-{FREE|PRO|ENT}-{YYYYMMDD}-{XXXX}）');
  }
  const existing = db.prepare('SELECT 1 FROM licenses WHERE key = ?').get(key);
  if (existing) {
    throw new Error('此 Key 已被使用，請聯繫客服');
  }
  const tier = parsed.tier;
  const limits = TIER_LIMITS[tier];
  const now = new Date();
  const record: LicenseRecord = {
    key,
    email,
    tier,
    expiresAt: new Date(now.getTime() + limits.days * 24 * 60 * 60 * 1000).toISOString(),
    activatedAt: now.toISOString(),
    deviceLimit: limits.deviceLimit,
  };
  db.prepare(`
    INSERT INTO licenses (key, email, tier, expires_at, activated_at, device_limit, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.key,
    record.email,
    record.tier,
    record.expiresAt,
    record.activatedAt,
    record.deviceLimit,
    now.toISOString(),
    now.toISOString()
  );
  return record;
}

/** 查詢 license 狀態 */
function checkLicense(key: string): {
  valid: boolean;
  tier?: Tier;
  expiresAt?: string;
  daysLeft?: number;
  deviceLimit?: number;
  reason?: string;
} {
  const row = db.prepare('SELECT * FROM licenses WHERE key = ?').get(key) as LicenseRow | undefined;
  if (!row) return { valid: false, reason: 'Key 不存在' };
  const now = new Date();
  const expiresAt = new Date(row.expires_at);
  if (now > expiresAt) {
    return { valid: false, tier: row.tier as Tier, expiresAt: row.expires_at, reason: '已過期' };
  }
  const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  return {
    valid: true,
    tier: row.tier as Tier,
    expiresAt: row.expires_at,
    daysLeft,
    deviceLimit: row.device_limit,
  };
}

export async function licenseRoutes(fastify: FastifyInstance) {
  // 初始化時 seed demo key
  ensureSeedLicense();

  // 啟用 license
  fastify.post('/activate', async (req, reply) => {
    const body = req.body as { key?: string; email?: string };
    if (!body.key || !body.email) {
      return reply.code(400).send({ error: '需要 key 與 email' });
    }
    try {
      const record = activateLicense(body.key, body.email);
      return {
        ok: true,
        license: {
          key: record.key,
          tier: record.tier,
          expiresAt: record.expiresAt,
          deviceLimit: record.deviceLimit,
        },
      };
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // 查詢狀態
  fastify.get('/status', async (req, reply) => {
    const key = (req.query as { key?: string }).key;
    if (!key) return reply.code(400).send({ error: '需要 key 參數' });
    const status = checkLicense(key);
    return status;
  });

  // 停用
  fastify.post('/deactivate', async (req, reply) => {
    const body = req.body as { key?: string };
    if (!body.key) return reply.code(400).send({ error: '需要 key' });
    const result = db.prepare('DELETE FROM licenses WHERE key = ?').run(body.key);
    return { ok: result.changes > 0 };
  });

  // 列出全部（admin 用）
  fastify.get('/list', async () => {
    const rows = db.prepare('SELECT * FROM licenses ORDER BY activated_at DESC').all() as LicenseRow[];
    return rows.map(rowToRecord);
  });

  // 健康檢查
  fastify.get('/health', async () => {
    const count = (db.prepare('SELECT COUNT(*) as c FROM licenses').get() as { c: number }).c;
    return {
      ok: true,
      totalLicenses: count,
      tiers: TIER_LIMITS,
    };
  });
}