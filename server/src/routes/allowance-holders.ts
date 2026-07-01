/**
 * 零用金持有人 Routes
 *
 * 路徑前綴：/api/allowance-holders
 *
 * AI 友善說明：
 * - 對應資料表：allowance_holders
 * - 對應 client/src/storage/database.ts 的 allowanceHolders Repository
 *
 * 欄位（schema.ts allowance_holders）：
 *   id, name, balance, notes, createdAt, updatedAt
 *
 * 端點：
 *   GET    /                                列出所有持有人
 *   GET    /:id                             單筆
 *   POST   /                                新增
 *   PUT    /:id                             更新
 *   DELETE /:id                             刪除（FK CASCADE 連帶刪 transactions）
 *   GET    /:id/transactions                該持有人的所有交易
 *   POST   /:id/transactions                新增交易（會自動重算 balance + 寫 holders.updatedAt）
 */

import type { FastifyInstance } from 'fastify';
import { repositories } from '../db/repository.js';
import { createCrudRoutes, idParamSchema } from './_crud.js';
import { nowIso } from '../db/repository.js';

export default async function allowanceHoldersRoutes(fastify: FastifyInstance) {
  await createCrudRoutes(fastify, {
    tag: 'allowance-holders',
    resourceLabel: '零用金持有人',
    repository: repositories.allowance_holders,
    orderBy: 'name',
  });

  // GET /api/allowance-holders/:id/transactions
  fastify.get<{ Params: { id: string } }>(
    '/:id/transactions',
    {
      schema: {
        tags: ['allowance-holders'],
        summary: '列出某持有人的所有交易',
        params: idParamSchema,
        response: {
          200: { type: 'array', items: { type: 'object', additionalProperties: true } },
        },
      },
    },
    async (request) =>
      repositories.allowance_transactions.findBy(
        'allowance_id = ?',
        [request.params.id],
        'date DESC, created_at DESC',
      ),
  );

  // POST /api/allowance-holders/:id/transactions
  fastify.post<{
    Params: { id: string };
    Body: { date: string; amount: number; type: 'add' | 'deduct'; description?: string };
  }>(
    '/:id/transactions',
    {
      schema: {
        tags: ['allowance-holders'],
        summary: '新增零用金交易（自動重算持有人 balance）',
        params: idParamSchema,
        body: {
          type: 'object',
          required: ['date', 'amount', 'type'],
          properties: {
            date: { type: 'string', description: '日期 YYYY-MM-DD' },
            amount: { type: 'number' },
            type: { type: 'string', enum: ['add', 'deduct'] },
            description: { type: 'string' },
          },
        },
        response: {
          201: { type: 'object', additionalProperties: true },
          404: {
            type: 'object',
            properties: { statusCode: { type: 'integer' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request) => {
      const holder = repositories.allowance_holders.getById(request.params.id) as
        | (Record<string, unknown> & { id: string })
        | null;
      if (!holder) throw { statusCode: 404, message: '找不到零用金持有人' };

      const delta = request.body.type === 'add'
        ? request.body.amount
        : -request.body.amount;
      const currentBalance = typeof holder.balance === 'number' ? holder.balance : 0;
      const newBalance = currentBalance + delta;

      const tx = repositories.allowance_transactions.create({
        allowanceId: request.params.id,
        date: request.body.date,
        amount: request.body.amount,
        type: request.body.type,
        description: request.body.description,
        balanceAfter: newBalance,
      });

      repositories.allowance_holders.update(request.params.id, {
        balance: newBalance,
        updatedAt: nowIso(),
      });

      return tx;
    },
  );
}
