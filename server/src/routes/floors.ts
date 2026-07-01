/**
 * 樓層 Routes
 *
 * 路徑前綴：/api/floors
 *
 * AI 友善說明：
 * - 對應資料表：floors
 * - 對應 client：client/src/storage/database.ts 的 floors Repository
 * - 標準 CRUD + 依 building 過濾
 *
 * 欄位（對應 schema.ts floors 表）：
 *   id, buildingId, floorLabel, floorIndex, floorArea, unitArea, unitCount,
 *   isBasement, isRooftop, notes, createdAt
 *
 * 端點：
 *   GET    /                  列出所有樓層
 *   GET    /building/:bid     依建築取樓層
 *   GET    /:id               單筆
 *   POST   /                  新增
 *   PUT    /:id               更新
 *   DELETE /:id               刪除
 */

import type { FastifyInstance } from 'fastify';
import { repositories } from '../db/repository.js';
import { createCrudRoutes } from './_crud.js';

export default async function floorsRoutes(fastify: FastifyInstance) {
  await createCrudRoutes(fastify, {
    tag: 'floors',
    resourceLabel: '樓層',
    repository: repositories.floors,
    orderBy: 'building_id, floor_index',
  });

  // GET /api/floors/building/:buildingId — 依建築物 ID 取樓層
  fastify.get<{ Params: { buildingId: string } }>(
    '/building/:buildingId',
    {
      schema: {
        tags: ['floors'],
        summary: '依建築物 ID 列出樓層',
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
      repositories.floors.findBy(
        'building_id = ?',
        [request.params.buildingId],
        'floor_index',
      ),
  );
}
