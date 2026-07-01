/**
 * 住戶車位綁定 Routes
 *
 * 路徑前綴：/api/resident-parking
 *
 * AI 友善說明：
 * - 對應資料表：resident_parking
 * - 對應 client/src/storage/schema.ts 的 resident_parking Repository
 * - 住戶 ↔ 車位多對多綁定（一戶多車位 + ETC 號碼）
 * - 取代 residents.parking_id 單一綁定；保留 parking_spots.resident_id 唯讀標記
 *
 * 欄位（schema.ts resident_parking）：
 *   id, residentId, parkingSpotId, etcNumber, notes, createdAt
 *
 * 端點：
 *   GET    /                       列出所有綁定
 *   GET    /resident/:residentId   依住戶取綁定
 *   GET    /spot/:parkingSpotId    依車位取綁定
 *   GET    /:id                    單筆
 *   POST   /                       新增綁定
 *   PUT    /:id                    更新綁定
 *   DELETE /:id                    刪除綁定
 *
 * FK 約束：
 *   - resident_id → residents(id) ON DELETE CASCADE
 *   - parking_spot_id → parking_spots(id) ON DELETE CASCADE
 */

import type { FastifyInstance } from 'fastify';
import { repositories } from '../db/repository.js';
import { idParamSchema, notFoundSchema, tryDbOp } from './_crud.js';

export default async function residentParkingRoutes(fastify: FastifyInstance) {
  const repo = repositories.resident_parking;

  // GET / — 列表（依建立時間排序）
  fastify.get('/', {
    schema: {
      tags: ['resident-parking'],
      summary: '列出所有住戶車位綁定',
      response: {
        200: { type: 'array', items: { type: 'object', additionalProperties: true } },
      },
    },
  }, async () => repo.findBy('1=1', [], 'created_at DESC'));

  // GET /resident/:residentId — 依住戶取綁定
  fastify.get<{ Params: { residentId: string } }>(
    '/resident/:residentId',
    {
      schema: {
        tags: ['resident-parking'],
        summary: '依住戶 ID 列出車位綁定',
        params: {
          type: 'object',
          properties: { residentId: { type: 'string', minLength: 1 } },
          required: ['residentId'],
        },
      },
    },
    async (request) =>
      repo.findBy('resident_id = ?', [request.params.residentId], 'created_at DESC'),
  );

  // GET /spot/:parkingSpotId — 依車位取綁定
  fastify.get<{ Params: { parkingSpotId: string } }>(
    '/spot/:parkingSpotId',
    {
      schema: {
        tags: ['resident-parking'],
        summary: '依車位 ID 列出綁定',
        params: {
          type: 'object',
          properties: { parkingSpotId: { type: 'string', minLength: 1 } },
          required: ['parkingSpotId'],
        },
      },
    },
    async (request) =>
      repo.findBy('parking_spot_id = ?', [request.params.parkingSpotId], 'created_at DESC'),
  );

  // GET /:id — 單筆
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        tags: ['resident-parking'],
        summary: '取得單筆綁定',
        params: idParamSchema,
        response: {
          200: { type: 'object', additionalProperties: true },
          ...notFoundSchema,
        },
      },
    },
    async (request) => {
      const item = repo.getById(request.params.id);
      if (!item) throw { statusCode: 404, message: '找不到住戶車位綁定' };
      return item;
    },
  );

  // POST / — 新增
  fastify.post(
    '/',
    {
      schema: {
        tags: ['resident-parking'],
        summary: '新增住戶車位綁定',
        body: {
          type: 'object',
          required: ['residentId', 'parkingSpotId'],
          properties: {
            residentId: { type: 'string', minLength: 1 },
            parkingSpotId: { type: 'string', minLength: 1 },
            etcNumber: { type: 'string' },
            notes: { type: 'string' },
          },
          additionalProperties: true,
        },
        response: { 201: { type: 'object', additionalProperties: true } },
      },
    },
    async (request) => tryDbOp(() => repo.create(request.body as Record<string, unknown>)),
  );

  // PUT /:id — 更新
  fastify.put<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/:id',
    {
      schema: {
        tags: ['resident-parking'],
        summary: '更新住戶車位綁定',
        params: idParamSchema,
        body: { type: 'object', additionalProperties: true },
        response: {
          200: { type: 'object', additionalProperties: true },
          ...notFoundSchema,
        },
      },
    },
    async (request) => {
      try {
        const updated = repo.update(request.params.id, request.body);
        if (!updated) throw { statusCode: 404, message: '找不到住戶車位綁定' };
        return updated;
      } catch (e: any) {
        if (e && typeof e.code === 'string' && e.code.startsWith('SQLITE_CONSTRAINT')) {
          throw Object.assign(new Error(`欄位驗證失敗: ${e.message}`), { statusCode: 400 });
        }
        throw e;
      }
    },
  );

  // DELETE /:id — 刪除
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        tags: ['resident-parking'],
        summary: '刪除住戶車位綁定',
        params: idParamSchema,
        response: {
          200: { type: 'object', properties: { success: { type: 'boolean' } } },
          ...notFoundSchema,
        },
      },
    },
    async (request) => {
      try {
        const ok = repo.delete(request.params.id);
        if (!ok) throw { statusCode: 404, message: '找不到住戶車位綁定' };
        return { success: true };
      } catch (e: any) {
        if (e && typeof e.code === 'string' && e.code.startsWith('SQLITE_CONSTRAINT')) {
          throw Object.assign(new Error(`欄位驗證失敗: ${e.message}`), { statusCode: 400 });
        }
        throw e;
      }
    },
  );
}