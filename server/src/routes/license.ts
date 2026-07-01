/**
 * License 系統 — Server 端
 *
 * AI 友善說明：
 * - 輕量版：in-memory Map 存 key → license metadata
 * - 不接金流、不發信、不需 DB
 * - key 格式：V4-{TIER}-{YYYYMMDD}-{RANDOM}
 *   例如：V4-PRO-20260620-A7K9
 * - 三種層級：free（試用 30 天）、pro（年訂閱）、enterprise（永久）
 * - 實際商業化時可改成 DB 儲存 + Stripe webhook
 */

import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';

type Tier = 'free' | 'pro' | 'enterprise';

interface LicenseRecord {
  key: string;
  email: string;
  tier: Tier;
  expiresAt: string; // ISO 8601
  activatedAt: string;
  deviceLimit: number;
}

const LICENSES = new Map<string, LicenseRecord>();

// 預設種子 key（給 demo 用）
LICENSES.set('V4-FREE-DEMO-0001-AAAA', {
  key: 'V4-FREE-DEMO-0001-AAAA',
  email: 'demo@v4.local',
  tier: 'free',
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  activatedAt: new Date().toISOString(),
  deviceLimit: 1,
});

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

/** 啟用新 license */
function activateLicense(key: string, email: string): LicenseRecord {
  const parsed = parseKey(key);
  if (!parsed.valid || !parsed.tier) {
    throw new Error('無效的 License Key 格式（應為 V4-{FREE|PRO|ENT}-{YYYYMMDD}-{XXXX}）');
  }
  if (LICENSES.has(key)) {
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
  LICENSES.set(key, record);
  return record;
}

/** 檢查 license 狀態 */
function checkLicense(key: string): {
  valid: boolean;
  tier?: Tier;
  expiresAt?: string;
  daysLeft?: number;
  deviceLimit?: number;
  reason?: string;
} {
  const record = LICENSES.get(key);
  if (!record) return { valid: false, reason: 'Key 不存在' };
  const now = new Date();
  const expiresAt = new Date(record.expiresAt);
  if (now > expiresAt) {
    return { valid: false, tier: record.tier, expiresAt: record.expiresAt, reason: '已過期' };
  }
  const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  return {
    valid: true,
    tier: record.tier,
    expiresAt: record.expiresAt,
    daysLeft,
    deviceLimit: record.deviceLimit,
  };
}

export async function licenseRoutes(fastify: FastifyInstance) {
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
    const existed = LICENSES.delete(body.key);
    return { ok: existed };
  });

  // 列出全部（admin 用）
  fastify.get('/list', async () => {
    return Array.from(LICENSES.values());
  });

  // 健康檢查
  fastify.get('/health', async () => {
    return {
      ok: true,
      totalLicenses: LICENSES.size,
      tiers: TIER_LIMITS,
    };
  });
}