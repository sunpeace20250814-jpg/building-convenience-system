/**
 * 停車位 Routes
 *
 * 路徑前綴：/api/parking-spots
 *
 * AI 友善說明：
 * - 對應資料表：parking_spots
 * - 從 settings.ts 拆出來的獨立 CRUD（V4 模組化）
 * - 對應 client 的 parkingSpots Repository
 *
 * 欄位（schema.ts parking_spots）：
 *   id, buildingId, floor, number, space, type, status, statusId,
 *   residentId, boundResidentId, notes, createdAt, updatedAt
 *
 * 端點：
 *   GET    /                    列出所有停車位
 *   GET    /building/:bid       依建築物 ID 取停車位
 *   GET    /:id                 單筆
 *   POST   /                    新增
 *   PUT    /:id                 更新
 *   DELETE /:id                 刪除
 */

import type { FastifyInstance } from 'fastify';
import { repositories } from '../db/repository.js';
import { createCrudRoutes } from './_crud.js';

export default async function parkingSpotsRoutes(fastify: FastifyInstance) {
  await createCrudRoutes(fastify, {
    tag: 'parking-spots',
    resourceLabel: '停車位',
    repository: repositories.parking_spots,
    orderBy: 'floor, number',
  });

  // GET /api/parking-spots/building/:buildingId — 依建築物 ID 取停車位
  fastify.get<{ Params: { buildingId: string } }>(
    '/building/:buildingId',
    {
      schema: {
        tags: ['parking-spots'],
        summary: '依建築物 ID 列出停車位',
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
      repositories.parking_spots.findBy(
        'building_id = ?',
        [request.params.buildingId],
        'floor, number',
      ),
  );
}