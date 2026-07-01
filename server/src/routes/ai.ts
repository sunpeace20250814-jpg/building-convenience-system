/**
 * AI Safe Query Routes — M-62 (2026-07-01)
 *
 * 從 client-side (ai/sql-executor.ts) 搬到 server-side.
 * 原本 client 用 queryAll (storage/database throw-stub), AI 自然語言查詢永遠拿到空陣列.
 *
 * Server-side 完整驗證 (不依賴 client hint, 永遠重新驗證):
 *   1. SQL 必須是 SELECT 或 WITH 開頭
 *   2. 不能有多語句 (分號分隔)
 *   3. 不能有禁用關鍵字 (INSERT/UPDATE/DELETE/DROP/CREATE/ALTER/TRUNCATE 等)
 *   4. 表名必須在 ALLOWED_TABLES 白名單
 *   5. 強制 LIMIT (沒寫就補 200)
 *   6. maxRows 上限 (避免一次撈太多)
 *
 * ⚠️ AI 用 SQL executor: 危險功能,只接受 server-side 驗證,不信任 client.
 */

import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';

const FORBIDDEN_KEYWORDS = [
  'insert', 'update', 'delete', 'drop', 'create', 'alter', 'truncate',
  'replace', 'attach', 'detach', 'vacuum', 'reindex', 'pragma',
  'grant', 'revoke', 'savepoint',
];

// 與 client-side ALLOWED_TABLES 對齊,但 server-side 是 single source of truth
const ALLOWED_TABLES = new Set([
  'residents', 'resident_members', 'resident_keycards',
  'expense_records', 'expense_categories',
  'allowance_holders', 'allowance_transactions',
  'employees', 'shift_statuses', 'schedule_entries', 'holidays',
  'home_tabs', 'home_records',
  'buildings', 'parking_spots', 'status_options',
  // 會計表 (Sprint 5+) — AI 可以查,但不能寫
  'accounts', 'journal_entries', 'journal_lines', 'accounting_periods',
]);

const DEFAULT_LIMIT = 200;
const MAX_ROWS_HARD_LIMIT = 1000;

interface SafeQueryInput {
  sql: string;
  maxRows?: number;
}

function validateSQL(sql: string): { valid: boolean; error?: string; normalizedSQL?: string } {
  if (!sql || typeof sql !== 'string') {
    return { valid: false, error: 'SQL 不可為空' };
  }

  // 移除多餘空白、註解
  const normalized = sql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // 必須以 SELECT 開頭 (或 WITH)
  if (!/^(SELECT|WITH)\s/i.test(normalized)) {
    return { valid: false, error: '只允許 SELECT 或 WITH 查詢' };
  }

  // 不能有多語句
  const statements = normalized.split(';').map((s) => s.trim()).filter(Boolean);
  if (statements.length > 1) {
    return { valid: false, error: '不允許多語句' };
  }

  // 檢查禁用關鍵字
  const upper = normalized.toUpperCase();
  for (const kw of FORBIDDEN_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`, 'i');
    if (re.test(upper)) {
      return { valid: false, error: `禁用關鍵字: ${kw}` };
    }
  }

  // 強制加 LIMIT
  let finalSQL = normalized;
  if (!/\bLIMIT\s+\d+/i.test(finalSQL)) {
    finalSQL += ' LIMIT 200';
  }

  // 解析表名 (FROM / JOIN)
  const tableMatches = finalSQL.matchAll(/\b(FROM|JOIN)\s+([a-z_][a-z0-9_]*)/gi);
  for (const m of tableMatches) {
    const table = m[2].toLowerCase();
    if (ALLOWED_TABLES.has(table)) continue;
    // CTE 內部名稱跳過
    const withMatch = upper.match(/WITH\s+(\w+(?:\s*,\s*\w+)*)\s+AS\s*\(/);
    if (withMatch) {
      const cteNames = withMatch[1].split(',').map((s) => s.trim().toLowerCase());
      if (cteNames.includes(table)) continue;
    }
    return { valid: false, error: `不允許存取表: ${table}` };
  }

  return { valid: true, normalizedSQL: finalSQL };
}

export async function aiRoutes(fastify: FastifyInstance) {
  // POST /api/ai/safe-query — 執行已驗證的安全 SQL 查詢
  fastify.post<{ Body: SafeQueryInput }>('/ai/safe-query', {
    schema: {
      tags: ['ai'],
      summary: 'AI 自然語言查詢用的安全 SQL 執行器 (server-side 完整驗證)',
      body: {
        type: 'object',
        required: ['sql'],
        properties: {
          sql: { type: 'string', description: '已驗證的 SELECT/WITH SQL' },
          maxRows: { type: 'integer', default: DEFAULT_LIMIT, maximum: MAX_ROWS_HARD_LIMIT },
        },
      },
    },
  }, async (req, reply) => {
    const input = req.body;
    const maxRows = Math.min(Math.max(input.maxRows ?? DEFAULT_LIMIT, 1), MAX_ROWS_HARD_LIMIT);

    const validation = validateSQL(input.sql);
    if (!validation.valid) {
      fastify.log.warn(`[ai/safe-query] SQL 驗證失敗: ${validation.error}`);
      return reply.code(400).send({ ok: false, error: validation.error });
    }

    try {
      const rows = db.prepare(validation.normalizedSQL!).all() as any[];
      const limited = rows.slice(0, maxRows);
      fastify.log.info(`[ai/safe-query] 執行成功, ${limited.length}/${rows.length} 筆`);
      return {
        ok: true,
        rows: limited,
        sql: validation.normalizedSQL,
        rowCount: limited.length,
      };
    } catch (err: any) {
      fastify.log.error(`[ai/safe-query] 執行失敗: ${err.message}`);
      return reply.code(500).send({ ok: false, error: err.message, sql: validation.normalizedSQL });
    }
  });

  // POST /api/ai/validate-sql — 只驗證,不執行 (讓 client UI 可以 preview 結果)
  fastify.post<{ Body: { sql: string } }>('/ai/validate-sql', {
    schema: {
      tags: ['ai'],
      summary: '驗證 SQL 是否安全 (不執行)',
      body: {
        type: 'object',
        required: ['sql'],
        properties: { sql: { type: 'string' } },
      },
    },
  }, async (req) => {
    return validateSQL(req.body.sql);
  });
}