/**
 * 預算 Routes
 *
 * 路徑前綴：/api/expense-budgets
 *
 * AI 友善說明：
 * - 對應資料表：expense_budget
 * - 對應 client/src/storage/database.ts 的 expenseBudgets Repository
 *
 * 欄位（schema.ts expense_budget）：
 *   id, categoryId, month (YYYY-MM), amount, createdAt
 *   UNIQUE(categoryId, month)
 *
 * 端點：
 *   GET    /                  列出所有預算
 *   GET    /month/:month      依月份（YYYY-MM）列出
 *   GET    /:id               單筆
 *   POST   /                  新增
 *   PUT    /:id               更新
 *   DELETE /:id               刪除
 */

import type { FastifyInstance } from 'fastify';
import { repositories } from '../db/repository.js';
import { createCrudRoutes } from './_crud.js';

export default async function expenseBudgetsRoutes(fastify: FastifyInstance) {
  await createCrudRoutes(fastify, {
    tag: 'expense-budgets',
    resourceLabel: '預算',
    repository: repositories.expense_budget,
    orderBy: 'month DESC',
  });

  // GET /api/expense-budgets/month/:month
  fastify.get<{ Params: { month: string } }>(
    '/month/:month',
    {
      schema: {
        tags: ['expense-budgets'],
        summary: '依月份列出預算（YYYY-MM）',
        params: {
          type: 'object',
          properties: { month: { type: 'string', pattern: '^[0-9]{4}-[0-9]{2}$' } },
          required: ['month'],
        },
        response: {
          200: { type: 'array', items: { type: 'object', additionalProperties: true } },
        },
      },
    },
    async (request) =>
      repositories.expense_budget.findBy(
        'month = ?',
        [request.params.month],
        'category_id',
      ),
  );
}
