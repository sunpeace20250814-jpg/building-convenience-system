/**
 * 會計核心 Routes — M-55 修復 (2026-07-02)
 *
 * 涵蓋功能（最小可用版 — 商業化前可繼續擴充）：
 *   - /api/accounts        — Chart of Accounts CRUD
 *   - /api/journal-entries — Journal Entries + Lines 複合 CRUD
 *   - /api/accounting-periods — 會計期間 CRUD + 關帳
 *
 * AI 友善說明：
 *   - 走 server-side Fastify,前端不再用 storage/database.ts 的 throw-stub
 *   - 所有 POST 都驗證「借貸必平」(sum(debit) === sum(credit))
 *   - 關帳期間不允許新增分錄
 */

import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { repositories } from '../db/repository.js';
import { idParamSchema, notFoundSchema, tryDbOp } from './_crud.js';
import { randomUUID } from 'crypto';

// ============================================================
// Accounts (Chart of Accounts)
// ============================================================

type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

const ACCOUNT_TYPES: readonly AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense'];

function isAccountType(s: string): s is AccountType {
  return ACCOUNT_TYPES.includes(s as AccountType);
}

function seedDefaultAccounts(): void {
  // 只在表為空時 seed,避免重複
  const count = (db.prepare('SELECT COUNT(*) as c FROM accounts').get() as { c: number }).c;
  if (count > 0) return;

  const now = new Date().toISOString();
  const seed: Array<{ code: string; name: string; type: AccountType }> = [
    { code: '1101', name: '現金', type: 'asset' },
    { code: '1102', name: '銀行存款', type: 'asset' },
    { code: '1201', name: '應收帳款', type: 'asset' },
    { code: '2101', name: '應付帳款', type: 'liability' },
    { code: '3101', name: '累積盈餘', type: 'equity' },
    { code: '4101', name: '管理費收入', type: 'revenue' },
    { code: '4102', name: '其他收入', type: 'revenue' },
    { code: '5101', name: '清潔費', type: 'expense' },
    { code: '5102', name: '維護費', type: 'expense' },
    { code: '5103', name: '水電費', type: 'expense' },
    { code: '5104', name: '管理人員薪資', type: 'expense' },
  ];

  const insert = db.prepare(
    `INSERT INTO accounts (id, code, name, type, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const tx = db.transaction((rows: typeof seed) => {
    for (const r of rows) {
      insert.run(`${r.code}-${randomUUID().slice(0, 8)}`, r.code, r.name, r.type, 0, now, now);
    }
  });
  tx(seed);
}

export async function accountingRoutes(fastify: FastifyInstance) {
  seedDefaultAccounts();

  // ---------- Accounts ----------

  // GET /api/accounts — 列出全部
  fastify.get('/accounts', {
    schema: {
      tags: ['accounting'],
      summary: '列出所有會計科目',
      response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
    },
  }, async () => {
    return db.prepare('SELECT * FROM accounts ORDER BY code').all().map((r: any) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      type: r.type,
      parentId: r.parent_id,
      description: r.description,
      isActive: !!r.is_active,
      sortOrder: r.sort_order,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  });

  // GET /api/accounts/:id
  fastify.get<{ Params: { id: string } }>('/accounts/:id', {
    schema: {
      tags: ['accounting'],
      summary: '取得單一會計科目',
      params: idParamSchema,
      response: { 200: { type: 'object', additionalProperties: true }, ...notFoundSchema },
    },
  }, async (request) => {
    const r = db.prepare('SELECT * FROM accounts WHERE id = ?').get(request.params.id) as any;
    if (!r) throw { statusCode: 404, message: '找不到會計科目' };
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      type: r.type,
      parentId: r.parent_id,
      description: r.description,
      isActive: !!r.is_active,
      sortOrder: r.sort_order,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  });

  // POST /api/accounts — 新增科目
  fastify.post<{ Body: Record<string, unknown> }>('/accounts', {
    schema: {
      tags: ['accounting'],
      summary: '新增會計科目',
      body: {
        type: 'object',
        required: ['code', 'name', 'type'],
        properties: {
          code: { type: 'string', minLength: 1 },
          name: { type: 'string', minLength: 1 },
          type: { type: 'string', enum: ['asset', 'liability', 'equity', 'revenue', 'expense'] },
          parentId: { type: 'string' },
          description: { type: 'string' },
          sortOrder: { type: 'integer' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
  }, async (request, reply) => {
    const { code, name, type } = request.body as any;
    if (!isAccountType(type)) {
      return reply.code(400).send({ error: `type 必須是 ${ACCOUNT_TYPES.join('|')}` });
    }
    try {
      const account = tryDbOp(() => repositories.accounts.create({
        code,
        name,
        type,
        parentId: request.body.parentId ?? null,
        description: request.body.description ?? null,
        isActive: 1,
        sortOrder: request.body.sortOrder ?? 0,
      } as any));
      return account;
    } catch (e: any) {
      if (String(e?.message ?? e).includes('UNIQUE')) {
        return reply.code(400).send({ error: `科目代碼 ${code} 已存在` });
      }
      throw e;
    }
  });

  // PUT /api/accounts/:id — 更新
  fastify.put<{ Params: { id: string }; Body: Record<string, unknown> }>('/accounts/:id', {
    schema: {
      tags: ['accounting'],
      summary: '更新會計科目',
      params: idParamSchema,
      body: { type: 'object', additionalProperties: true },
      response: { 200: { type: 'object', additionalProperties: true }, ...notFoundSchema },
    },
  }, async (request) => {
    const updated = repositories.accounts.update(request.params.id, request.body);
    if (!updated) throw { statusCode: 404, message: '找不到會計科目' };
    return updated;
  });

  // DELETE /api/accounts/:id
  fastify.delete<{ Params: { id: string } }>('/accounts/:id', {
    schema: {
      tags: ['accounting'],
      summary: '刪除會計科目（有交易記錄時禁止刪除）',
      params: idParamSchema,
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' } } }, ...notFoundSchema },
    },
  }, async (request, reply) => {
    // 檢查是否有任何分錄引用
    const usage = db
      .prepare('SELECT COUNT(*) as c FROM journal_lines WHERE account_id = ?')
      .get(request.params.id) as { c: number };
    if (usage.c > 0) {
      return reply.code(400).send({
        error: `此科目已被 ${usage.c} 筆分錄引用,無法刪除（請先將 isActive=false）`,
      });
    }
    const ok = repositories.accounts.delete(request.params.id);
    if (!ok) throw { statusCode: 404, message: '找不到會計科目' };
    return { success: true };
  });

  // ---------- Journal Entries ----------

  // GET /api/journal-entries — 列出分錄（包含明細）
  fastify.get('/journal-entries', {
    schema: {
      tags: ['accounting'],
      summary: '列出日記帳分錄',
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          status: { type: 'string', enum: ['draft', 'posted', 'voided'] },
        },
      },
      response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
    },
  }, async (request) => {
    const q = request.query as { startDate?: string; endDate?: string; status?: string };
    let sql = `
      SELECT je.*,
             COALESCE(SUM(jl.debit), 0) as total_debit,
             COALESCE(SUM(jl.credit), 0) as total_credit
      FROM journal_entries je
      LEFT JOIN journal_lines jl ON jl.entry_id = je.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (q.startDate) {
      sql += ' AND je.entry_date >= ?';
      params.push(q.startDate);
    }
    if (q.endDate) {
      sql += ' AND je.entry_date <= ?';
      params.push(q.endDate);
    }
    if (q.status) {
      sql += ' AND je.status = ?';
      params.push(q.status);
    }
    sql += ' GROUP BY je.id ORDER BY je.entry_date DESC, je.created_at DESC LIMIT 500';
    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map(rowToJournalEntrySummary);
  });

  // GET /api/journal-entries/:id — 單筆含明細
  fastify.get<{ Params: { id: string } }>('/journal-entries/:id', {
    schema: {
      tags: ['accounting'],
      summary: '取得單一分錄（含明細行）',
      params: idParamSchema,
      response: { 200: { type: 'object', additionalProperties: true }, ...notFoundSchema },
    },
  }, async (request) => {
    const entry = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(request.params.id) as any;
    if (!entry) throw { statusCode: 404, message: '找不到分錄' };
    const lines = db.prepare('SELECT * FROM journal_lines WHERE entry_id = ? ORDER BY sort_order').all(request.params.id) as any[];
    return rowToJournalEntryDetail(entry, lines);
  });

  // POST /api/journal-entries — 新增（含明細，自動檢查借貸必平）
  fastify.post<{ Body: Record<string, unknown> }>('/journal-entries', {
    schema: {
      tags: ['accounting'],
      summary: '新增分錄（自動驗證借貸必平 + 期間未關帳）',
      body: {
        type: 'object',
        required: ['entryDate', 'description', 'lines'],
        properties: {
          entryDate: { type: 'string' },
          description: { type: 'string', minLength: 1 },
          reference: { type: 'string' },
          autoPost: { type: 'boolean' },
          lines: {
            type: 'array',
            minItems: 2,
            items: {
              type: 'object',
              required: ['accountId', 'amount'],
              properties: {
                accountId: { type: 'string' },
                amount: { type: 'number', exclusiveMinimum: 0 },
                side: { type: 'string', enum: ['debit', 'credit'] },
                memo: { type: 'string' },
              },
            },
          },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
  }, async (request, reply) => {
    const body = request.body as any;
    const lines = body.lines as Array<{ accountId: string; amount: number; side?: 'debit' | 'credit'; memo?: string }>;

    // 驗證 1:每個 accountId 存在
    for (const l of lines) {
      const exists = db.prepare('SELECT 1 FROM accounts WHERE id = ?').get(l.accountId);
      if (!exists) return reply.code(400).send({ error: `科目 ${l.accountId} 不存在` });
    }

    // 驗證 2:借貸必平
    const totalDebit = lines.filter((l) => (l.side ?? 'debit') === 'debit').reduce((s, l) => s + l.amount, 0);
    const totalCredit = lines.filter((l) => l.side === 'credit').reduce((s, l) => s + l.amount, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return reply.code(400).send({
        error: `借貸不平衡: 借 ${totalDebit} ≠ 貸 ${totalCredit}`,
      });
    }
    if (totalDebit === 0) {
      return reply.code(400).send({ error: '分錄金額不可為 0' });
    }

    // 驗證 3:會計期間未關帳
    const period = db
      .prepare('SELECT id, is_closed FROM accounting_periods WHERE start_date <= ? AND end_date >= ?')
      .get(body.entryDate, body.entryDate) as { id: string; is_closed: number } | undefined;
    if (period?.is_closed) {
      return reply.code(400).send({ error: `會計期間 ${period.id} 已關帳,無法新增分錄` });
    }

    // 建立分錄 + 明細(用 transaction)
    const entryId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const insertEntry = db.prepare(
      `INSERT INTO journal_entries (id, entry_date, description, reference, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const insertLine = db.prepare(
      `INSERT INTO journal_lines (id, entry_id, account_id, debit, credit, memo, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const status = body.autoPost ? 'posted' : 'draft';
    const postedAt = body.autoPost ? now : null;

    db.transaction(() => {
      insertEntry.run(
        entryId,
        body.entryDate,
        body.description,
        body.reference ?? null,
        status,
        now,
        now
      );
      lines.forEach((l, idx) => {
        const side = l.side ?? 'debit';
        insertLine.run(
          `${entryId}-L${idx}-${randomUUID().slice(0, 4)}`,
          entryId,
          l.accountId,
          side === 'debit' ? l.amount : 0,
          side === 'credit' ? l.amount : 0,
          l.memo ?? null,
          idx,
          now
        );
      });
      if (postedAt) {
        db.prepare('UPDATE journal_entries SET posted_at = ? WHERE id = ?').run(postedAt, entryId);
      }
    })();

    const created = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(entryId) as any;
    const detailLines = db.prepare('SELECT * FROM journal_lines WHERE entry_id = ?').all(entryId) as any[];
    return rowToJournalEntryDetail(created, detailLines);
  });

  // DELETE /api/journal-entries/:id — 刪除（連同明細）
  fastify.delete<{ Params: { id: string } }>('/journal-entries/:id', {
    schema: {
      tags: ['accounting'],
      summary: '刪除分錄（草稿可刪；已過帳需先 force voided）',
      params: idParamSchema,
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' } } }, ...notFoundSchema },
    },
  }, async (request, reply) => {
    const entry = db.prepare('SELECT status FROM journal_entries WHERE id = ?').get(request.params.id) as { status: string } | undefined;
    if (!entry) throw { statusCode: 404, message: '找不到分錄' };
    if (entry.status === 'posted') {
      return reply.code(400).send({ error: '已過帳的分錄不可直接刪除,請用 voided 流程' });
    }
    const result = db.prepare('DELETE FROM journal_entries WHERE id = ?').run(request.params.id);
    return { success: result.changes > 0 };
  });

  // POST /api/journal-entries/:id/post — 過帳
  fastify.post<{ Params: { id: string } }>('/journal-entries/:id/post', {
    schema: {
      tags: ['accounting'],
      summary: '過帳（從 draft → posted）',
      params: idParamSchema,
      response: { 200: { type: 'object', additionalProperties: true }, ...notFoundSchema },
    },
  }, async (request) => {
    const entry = db.prepare('SELECT status FROM journal_entries WHERE id = ?').get(request.params.id) as { status: string } | undefined;
    if (!entry) throw { statusCode: 404, message: '找不到分錄' };
    if (entry.status !== 'draft') {
      throw { statusCode: 400, message: `只有 draft 可過帳,目前是 ${entry.status}` };
    }
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE journal_entries SET status = 'posted', posted_at = ?, updated_at = ? WHERE id = ?`
    ).run(now, now, request.params.id);
    return repositories.journal_entries.getById(request.params.id);
  });

  // ---------- Accounting Periods ----------

  // GET /api/accounting-periods
  fastify.get('/accounting-periods', {
    schema: {
      tags: ['accounting'],
      summary: '列出會計期間',
      response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
    },
  }, async () => {
    return db.prepare('SELECT * FROM accounting_periods ORDER BY start_date DESC').all().map(rowToPeriod);
  });

  // POST /api/accounting-periods
  fastify.post<{ Body: Record<string, unknown> }>('/accounting-periods', {
    schema: {
      tags: ['accounting'],
      summary: '新增會計期間',
      body: {
        type: 'object',
        required: ['periodCode', 'startDate', 'endDate'],
        properties: {
          periodCode: { type: 'string', minLength: 1 },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
  }, async (request, reply) => {
    const body = request.body as any;
    try {
      const result = repositories.accounting_periods.create({
        periodCode: body.periodCode,
        startDate: body.startDate,
        endDate: body.endDate,
      } as any);
      return result;
    } catch (e: any) {
      if (String(e?.message ?? e).includes('UNIQUE')) {
        return reply.code(400).send({ error: `會計期間代碼 ${body.periodCode} 已存在` });
      }
      throw e;
    }
  });

  // POST /api/accounting-periods/:id/close — 關帳
  fastify.post<{ Params: { id: string } }>('/accounting-periods/:id/close', {
    schema: {
      tags: ['accounting'],
      summary: '關帳（關帳後不可新增分錄到該期間）',
      params: idParamSchema,
      response: { 200: { type: 'object', additionalProperties: true }, ...notFoundSchema },
    },
  }, async (request) => {
    const period = repositories.accounting_periods.getById(request.params.id);
    if (!period) throw { statusCode: 404, message: '找不到會計期間' };
    if ((period as any).isClosed) {
      throw { statusCode: 400, message: '此期間已關帳' };
    }
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE accounting_periods SET is_closed = 1, closed_at = ?, updated_at = ? WHERE id = ?`
    ).run(now, now, request.params.id);
    return repositories.accounting_periods.getById(request.params.id);
  });
}

// ============================================================
// Row mappers
// ============================================================

function rowToJournalEntrySummary(row: any): any {
  return {
    id: row.id,
    entryDate: row.entry_date,
    description: row.description,
    reference: row.reference,
    status: row.status,
    postedAt: row.posted_at,
    totalDebit: row.total_debit,
    totalCredit: row.total_credit,
    balanced: Math.abs((row.total_debit ?? 0) - (row.total_credit ?? 0)) < 0.01,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToJournalEntryDetail(entry: any, lines: any[]): any {
  return {
    id: entry.id,
    entryDate: entry.entry_date,
    description: entry.description,
    reference: entry.reference,
    status: entry.status,
    postedAt: entry.posted_at,
    createdAt: entry.created_at,
    updatedAt: entry.updated_at,
    lines: lines.map((l) => ({
      id: l.id,
      entryId: l.entry_id,
      accountId: l.account_id,
      debit: l.debit,
      credit: l.credit,
      memo: l.memo,
      sortOrder: l.sort_order,
      createdAt: l.created_at,
    })),
  };
}

function rowToPeriod(row: any): any {
  return {
    id: row.id,
    periodCode: row.period_code,
    startDate: row.start_date,
    endDate: row.end_date,
    isClosed: !!row.is_closed,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}