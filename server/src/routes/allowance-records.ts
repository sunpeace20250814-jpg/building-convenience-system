/**
 * 零用金紀錄 Routes
 *
 * 路徑前綴：/api/allowance-records
 *
 * AI 友善說明：
 * - 對應資料表：allowance_records
 * - 注意：此表與 allowance_transactions 是 V1/V4 兩套並存的零用金紀錄系統
 *   - allowance_records：客戶端主要使用，較精簡
 *   - allowance_transactions：歷史相容，較詳細
 * - 對應 client/src/storage/database.ts 的 allowanceRecords Repository
 *
 * 欄位（schema.ts allowance_records）：
 *   id, allowanceId (FK), date, amount, type, balanceAfter, notes, createdAt
 *
 * 端點：
 *   GET    /                          列出所有紀錄
 *   GET    /holder/:holderId          依持有人列出
 *   GET    /:id                       單筆
 *   POST   /                          新增
 *   PUT    /:id                       更新
 *   DELETE /:id                       刪除
 */

import type { FastifyInstance } from 'fastify';
import { repositories } from '../db/repository.js';
import { createCrudRoutes } from './_crud.js';

export default async function allowanceRecordsRoutes(fastify: FastifyInstance) {
  await createCrudRoutes(fastify, {
    tag: 'allowance-records',
    resourceLabel: '零用金紀錄',
    repository: repositories.allowance_records,
    orderBy: 'date DESC',
  });

  // GET /api/allowance-records/holder/:holderId
  fastify.get<{ Params: { holderId: string } }>(
    '/holder/:holderId',
    {
      schema: {
        tags: ['allowance-records'],
        summary: '依持有人列出零用金紀錄',
        params: {
          type: 'object',
          properties: { holderId: { type: 'string', minLength: 1 } },
          required: ['holderId'],
        },
        response: {
          200: { type: 'array', items: { type: 'object', additionalProperties: true } },
        },
      },
    },
    async (request) =>
      repositories.allowance_records.findBy(
        'allowance_id = ?',
        [request.params.holderId],
        'date DESC',
      ),
  );
}
