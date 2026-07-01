/**
 * 公設 Routes
 *
 * 路徑前綴：/api/facilities
 *
 * AI 友善說明：
 * - 對應資料表：facilities
 * - 對應 client：client/src/storage/database.ts 的 facilities Repository
 * - 標準 CRUD + 依 building 過濾
 *
 * 欄位（schema.ts facilities）：
 *   id, buildingId, name, fee, unit, location, status, notes,
 *   createdAt, updatedAt
 *
 * 端點：
 *   GET    /                    列出所有公設
 *   GET    /building/:bid       依建築取公設
 *   GET    /:id                 單筆
 *   POST   /                    新增
 *   PUT    /:id                 更新
 *   DELETE /:id                 刪除
 */

import type { FastifyInstance } from 'fastify';
import { repositories } from '../db/repository.js';
import { createCrudRoutes } from './_crud.js';

export default async function facilitiesRoutes(fastify: FastifyInstance) {
  await createCrudRoutes(fastify, {
    tag: 'facilities',
    resourceLabel: '公設',
    repository: repositories.facilities,
    orderBy: 'building_id, name',
  });

  fastify.get<{ Params: { buildingId: string } }>(
    '/building/:buildingId',
    {
      schema: {
        tags: ['facilities'],
        summary: '依建築物 ID 列出公設',
        params: {
          type: 'object',
          properties: { buildingId: { type: 'string', minLength: 1 } },
          required: ['buildingId'],
        },
        response: {
          200: { type: 'array', items: { type: 'object', additionalProperties: true } },
        },
      },
    },
    async (request) =>
      repositories.facilities.findBy(
        'building_id = ?',
        [request.params.buildingId],
        'name',
      ),
  );
}
