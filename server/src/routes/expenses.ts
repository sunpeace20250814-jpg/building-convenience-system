/**
 * 收支 Routes（V4 完整欄位版）
 *
 * 路徑前綴：/api/expenses
 *
 * AI 友善說明：
 * - 對應資料表：expense_categories + expense_records + allowance_holders +
 *              allowance_transactions + allowance_records
 * - 對應 client/src/storage/database.ts 對應 Repository
 * - 注意：predefined categories 預設資料由 db/index.ts 在 init 階段寫入
 *
 * 費用類別端點（/api/expenses/categories）：
 *   GET    /categories                       列出所有
 *   GET    /categories/type/:type            依類型（income/expense）
 *   GET    /categories/:id                   單筆
 *   POST   /categories                       新增
 *   PUT    /categories/:id                   更新
 *   DELETE /categories/:id                   刪除
 *
 * 收支記錄端點（/api/expenses）：
 *   GET    /                                 列出所有
 *   GET    /range?start=&end=                依日期區間
 *   GET    /:id                              單筆
 *   POST   /                                 新增
 *   PUT    /:id                              更新
 *   DELETE /:id                              刪除
 *
 * 零用金持有人（/api/expenses/allowance）：
 *   GET    /allowance                        列出所有持有人
 *   GET    /allowance/:id                    單筆
 *   POST   /allowance                        新增
 *   PUT    /allowance/:id                    更新
 *   DELETE /allowance/:id                    刪除
 *   GET    /allowance/:id/transactions       該持有人所有交易
 *   POST   /allowance/:id/transactions       新增交易（自動重算 balance）
 *   DELETE /allowance/:holderId/transactions/:txId  刪除單筆交易
 */

import type { FastifyInstance } from 'fastify';
import { repositories, nowIso } from '../db/repository.js';
import { idParamSchema, notFoundSchema } from './_crud.js';

export default async function expensesRoutes(fastify: FastifyInstance) {
  // ============================================================
  // Expense Categories
  // ============================================================
  const catRepo = repositories.expense_categories;

  fastify.get('/categories', {
    schema: {
      tags: ['expenses'],
      summary: '列出所有費用類別',
      response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
    },
  }, async () => catRepo.findBy('1=1', [], 'type, sort_order'));

  fastify.get<{ Params: { type: string } }>(
    '/categories/type/:type',
    {
      schema: {
        tags: ['expenses'],
        summary: '依類型列出費用類別（income/expense）',
        params: {
          type: 'object',
          properties: { type: { type: 'string', enum: ['income', 'expense'] } },
          required: ['type'],
        },
      },
    },
    async (request) =>
      catRepo.findBy('type = ?', [request.params.type], 'sort_order'),
  );

  fastify.get<{ Params: { id: string } }>(
    '/categories/:id',
    {
      schema: {
        tags: ['expenses'],
        summary: '取得單筆類別',
        params: idParamSchema,
        response: { 200: { type: 'object', additionalProperties: true }, ...notFoundSchema },
      },
    },
    async (request) => {
      const r = catRepo.getById(request.params.id);
      if (!r) throw { statusCode: 404, message: '找不到類別' };
      return r;
    },
  );

  fastify.post<{ Body: Record<string, unknown> }>(
    '/categories',
    {
      schema: {
        tags: ['expenses'],
        summary: '新增費用類別',
        body: {
          type: 'object',
          required: ['name', 'type'],
          properties: {
            name: { type: 'string', minLength: 1 },
            type: { type: 'string', enum: ['income', 'expense'] },
            color: { type: 'string' },
            sortOrder: { type: 'integer', minimum: 0 },
          },
        },
      },
    },
    async (request) => catRepo.create(request.body),
  );

  fastify.put<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/categories/:id',
    {
      schema: {
        tags: ['expenses'],
        summary: '更新費用類別',
        params: idParamSchema,
        body: { type: 'object', additionalProperties: true },
        response: { 200: { type: 'object', additionalProperties: true }, ...notFoundSchema },
      },
    },
    async (request) => {
      const updated = catRepo.update(request.params.id, request.body);
      if (!updated) throw { statusCode: 404, message: '找不到類別' };
      return updated;
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    '/categories/:id',
    {
      schema: {
        tags: ['expenses'],
        summary: '刪除費用類別',
        params: idParamSchema,
        response: {
          200: { type: 'object', properties: { success: { type: 'boolean' } } },
          ...notFoundSchema,
        },
      },
    },
    async (request) => {
      const ok = catRepo.delete(request.params.id);
      if (!ok) throw { statusCode: 404, message: '找不到類別' };
      return { success: true };
    },
  );

  // ============================================================
  // Expense Records
  // ============================================================
  const recRepo = repositories.expense_records;

  fastify.get('/', {
    schema: {
      tags: ['expenses'],
      summary: '列出所有收支記錄',
      response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
    },
  }, async () => recRepo.findBy('1=1', [], 'date DESC'));

  fastify.get<{ Querystring: { start?: string; end?: string } }>(
    '/range',
    {
      schema: {
        tags: ['expenses'],
        summary: '依日期區間列出記錄',
        querystring: {
          type: 'object',
          properties: {
            start: { type: 'string' },
            end: { type: 'string' },
          },
        },
        response: {
          200: { type: 'array', items: { type: 'object', additionalProperties: true } },
          400: {
            type: 'object',
            properties: { statusCode: { type: 'integer' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request) => {
      const { start, end } = request.query;
      if (!start || !end) {
        throw { statusCode: 400, message: '需要 start 和 end 參數' };
      }
      return recRepo.findBy('date BETWEEN ? AND ?', [start, end], 'date DESC');
    },
  );

  fastify.get<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        tags: ['expenses'],
        summary: '取得單筆記錄',
        params: idParamSchema,
        response: { 200: { type: 'object', additionalProperties: true }, ...notFoundSchema },
      },
    },
    async (request) => {
      const r = recRepo.getById(request.params.id);
      if (!r) throw { statusCode: 404, message: '找不到記錄' };
      return r;
    },
  );

  fastify.post<{ Body: Record<string, unknown> }>(
    '/',
    {
      schema: {
        tags: ['expenses'],
        summary: '新增收支記錄',
        body: {
          type: 'object',
          required: ['date', 'amount', 'type'],
          properties: {
            date: { type: 'string' },
            type: { type: 'string', enum: ['income', 'expense'] },
            category: { type: 'string' },
            categoryId: { type: 'string' },
            amount: { type: 'number' },
            source: { type: 'string' },
            paidBy: { type: 'string' },
            item: { type: 'string' },
            quantity: { type: 'number' },
            unitPrice: { type: 'number' },
            sharedBy: { type: 'string' },
            splitMethod: { type: 'string', enum: ['none', 'equal', 'by_count', 'manual'] },
            participants: { type: 'string' },
            description: { type: 'string' },
            notes: { type: 'string' },
          },
          additionalProperties: true,
        },
      },
    },
    async (request) => recRepo.create(request.body),
  );

  fastify.put<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/:id',
    {
      schema: {
        tags: ['expenses'],
        summary: '更新記錄',
        params: idParamSchema,
        body: { type: 'object', additionalProperties: true },
        response: { 200: { type: 'object', additionalProperties: true }, ...notFoundSchema },
      },
    },
    async (request) => {
      const updated = recRepo.update(request.params.id, request.body);
      if (!updated) throw { statusCode: 404, message: '找不到記錄' };
      return updated;
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        tags: ['expenses'],
        summary: '刪除記錄',
        params: idParamSchema,
        response: {
          200: { type: 'object', properties: { success: { type: 'boolean' } } },
          ...notFoundSchema,
        },
      },
    },
    async (request) => {
      const ok = recRepo.delete(request.params.id);
      if (!ok) throw { statusCode: 404, message: '找不到記錄' };
      return { success: true };
    },
  );

  // ============================================================
  // Allowance Holders
  // ============================================================
  const holderRepo = repositories.allowance_holders;

  fastify.get('/allowance', {
    schema: {
      tags: ['expenses'],
      summary: '列出所有零用金持有人',
      response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
    },
  }, async () => holderRepo.findBy('1=1', [], 'name'));

  fastify.get<{ Params: { id: string } }>(
    '/allowance/:id',
    {
      schema: {
        tags: ['expenses'],
        summary: '取得單筆持有人',
        params: idParamSchema,
        response: { 200: { type: 'object', additionalProperties: true }, ...notFoundSchema },
      },
    },
    async (request) => {
      const r = holderRepo.getById(request.params.id);
      if (!r) throw { statusCode: 404, message: '找不到持有人' };
      return r;
    },
  );

  fastify.post<{ Body: Record<string, unknown> }>(
    '/allowance',
    {
      schema: {
        tags: ['expenses'],
        summary: '新增持有人',
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1 },
            balance: { type: 'number' },
            notes: { type: 'string' },
          },
        },
      },
    },
    async (request) => holderRepo.create(request.body),
  );

  fastify.put<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/allowance/:id',
    {
      schema: {
        tags: ['expenses'],
        summary: '更新持有人',
        params: idParamSchema,
        body: { type: 'object', additionalProperties: true },
        response: { 200: { type: 'object', additionalProperties: true }, ...notFoundSchema },
      },
    },
    async (request) => {
      const updated = holderRepo.update(request.params.id, request.body);
      if (!updated) throw { statusCode: 404, message: '找不到持有人' };
      return updated;
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    '/allowance/:id',
    {
      schema: {
        tags: ['expenses'],
        summary: '刪除持有人（FK CASCADE 連帶刪 transactions）',
        params: idParamSchema,
        response: {
          200: { type: 'object', properties: { success: { type: 'boolean' } } },
          ...notFoundSchema,
        },
      },
    },
    async (request) => {
      const ok = holderRepo.delete(request.params.id);
      if (!ok) throw { statusCode: 404, message: '找不到持有人' };
      return { success: true };
    },
  );

  // ============================================================
  // Allowance Transactions
  // ============================================================
  const txRepo = repositories.allowance_transactions;

  fastify.get<{ Params: { id: string } }>(
    '/allowance/:id/transactions',
    {
      schema: {
        tags: ['expenses'],
        summary: '該持有人所有交易紀錄',
        params: idParamSchema,
        response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
      },
    },
    async (request) =>
      txRepo.findBy(
        'allowance_id = ?',
        [request.params.id],
        'date DESC, created_at DESC',
      ),
  );

  fastify.post<{
    Params: { id: string };
    Body: { date: string; amount: number; type: 'add' | 'deduct'; description?: string };
  }>(
    '/allowance/:id/transactions',
    {
      schema: {
        tags: ['expenses'],
        summary: '新增交易（自動重算持有人 balance）',
        params: idParamSchema,
        body: {
          type: 'object',
          required: ['date', 'amount', 'type'],
          properties: {
            date: { type: 'string' },
            amount: { type: 'number' },
            type: { type: 'string', enum: ['add', 'deduct'] },
            description: { type: 'string' },
          },
        },
      },
    },
    async (request) => {
      const holder = holderRepo.getById(request.params.id) as
        | (Record<string, unknown> & { id: string })
        | null;
      if (!holder) throw { statusCode: 404, message: '找不到持有人' };
      const delta = request.body.type === 'add' ? request.body.amount : -request.body.amount;
      const currentBalance = typeof holder.balance === 'number' ? holder.balance : 0;
      const newBalance = currentBalance + delta;
      const tx = txRepo.create({
        allowanceId: request.params.id,
        date: request.body.date,
        amount: request.body.amount,
        type: request.body.type,
        description: request.body.description,
        balanceAfter: newBalance,
      });
      holderRepo.update(request.params.id, {
        balance: newBalance,
        updatedAt: nowIso(),
      });
      return tx;
    },
  );

  fastify.delete<{ Params: { holderId: string; transactionId: string } }>(
    '/allowance/:holderId/transactions/:transactionId',
    {
      schema: {
        tags: ['expenses'],
        summary: '刪除單筆交易',
        params: {
          type: 'object',
          properties: {
            holderId: { type: 'string' },
            transactionId: { type: 'string' },
          },
          required: ['holderId', 'transactionId'],
        },
        response: {
          200: { type: 'object', properties: { success: { type: 'boolean' } } },
          ...notFoundSchema,
        },
      },
    },
    async (request) => {
      const tx = txRepo.getById(request.params.transactionId);
      if (!tx) throw { statusCode: 404, message: '找不到交易記錄' };
      txRepo.delete(request.params.transactionId);

      // 重算持有人 balance 與後續 tx 的 balanceAfter
      const holderId = request.params.holderId;
      const allTx = txRepo.findBy(
        'allowance_id = ?',
        [holderId],
        'date ASC, created_at ASC'
      );
      let running = 0;
      for (const t of allTx as Array<Record<string, unknown>>) {
        const delta =
          t.type === 'add' ? Number(t.amount) || 0 : -(Number(t.amount) || 0);
        running += delta;
        // 只重算 balanceAfter（金額、日期、類型都不變）
        txRepo.update(String(t.id), { balanceAfter: running });
      }
      holderRepo.update(holderId, {
        balance: running,
        updatedAt: nowIso(),
      });
      return { success: true };
    },
  );
}
