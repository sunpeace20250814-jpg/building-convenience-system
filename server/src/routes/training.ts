/**
 * 教育訓練 Routes
 *
 * 路徑前綴：/api/training
 *
 * AI 友善說明：
 * - 對應資料表：training_records
 * - 對應 client/src/storage/database.ts 的 trainingRecords Repository
 *
 * 欄位（schema.ts training_records）：
 *   id, employeeId (FK), date, content, notes, createdAt
 *
 * 端點：
 *   GET    /                       列出所有教育訓練
 *   GET    /employee/:employeeId   依員工列出
 *   GET    /:id                    單筆
 *   POST   /                       新增
 *   PUT    /:id                    更新
 *   DELETE /:id                    刪除
 */

import type { FastifyInstance } from 'fastify';
import { repositories } from '../db/repository.js';
import { createCrudRoutes } from './_crud.js';

export default async function trainingRoutes(fastify: FastifyInstance) {
  await createCrudRoutes(fastify, {
    tag: 'training',
    resourceLabel: '教育訓練',
    repository: repositories.training_records,
    orderBy: 'date DESC',
  });

  // GET /api/training/employee/:employeeId
  fastify.get<{ Params: { employeeId: string } }>(
    '/employee/:employeeId',
    {
      schema: {
        tags: ['training'],
        summary: '依員工列出教育訓練',
        params: {
          type: 'object',
          properties: { employeeId: { type: 'string', minLength: 1 } },
          required: ['employeeId'],
        },
        response: {
          200: { type: 'array', items: { type: 'object', additionalProperties: true } },
        },
      },
    },
    async (request) =>
      repositories.training_records.findBy(
        'employee_id = ?',
        [request.params.employeeId],
        'date DESC',
      ),
  );
}
