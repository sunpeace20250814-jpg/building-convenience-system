/**
 * 停車位綁定 Routes（resident ↔ parking_spot 雙向綁定）
 *
 * 路徑前綴：/api/parking-binding
 *
 * AI 友善說明：
 * - 綁定資料儲存在 parking_spots.bound_resident_id + residents.parking_id
 * - 沒有獨立的 parking_binding 表，綁定就是 spot 的 bound_resident_id 欄位
 * - 這個 route 提供「以綁定為視角」的 CRUD：
 *     :id  = parking_spot_id（綁定在車位端，spot 是主鍵）
 *   list 篩選 bound_resident_id IS NOT NULL 的車位
 * - 雙向同步：寫入時同時更新兩邊（spot.bound_resident_id + resident.parking_id）
 * - 對應 client/src/api/parking-binding.ts 的 binding 邏輯
 *
 * 端點：
 *   GET    /                       列出所有綁定（bound_resident_id 不為 NULL 的車位）
 *   GET    /resident/:residentId   取某住戶的綁定車位
 *   GET    /:id                    取單筆綁定（id = spot_id）
 *   POST   /                       建立綁定 {spotId, residentId}
 *   PUT    /:id                    更新綁定（id = spot_id；body.residentId 可為 null = 解除）
 *   DELETE /:id                    解除綁定（id = spot_id）
 */

import type { FastifyInstance } from 'fastify';
import { repositories } from '../db/repository.js';
import { idParamSchema, notFoundSchema } from './_crud.js';

interface BindBody {
  spotId?: string;
  residentId: string | null;
}

/** 把 parking_spot 攤平成「綁定視角」的記錄 */
function toBindingRecord(spot: Record<string, unknown> | null) {
  if (!spot) return null;
  return {
    id: spot.id,
    spotId: spot.id,
    residentId: (spot.boundResidentId as string | null) ?? null,
    buildingId: (spot.buildingId as string | null) ?? null,
    floor: spot.floor,
    number: spot.number,
    type: spot.type,
    updatedAt: spot.updatedAt ?? null,
  };
}

export default async function parkingBindingRoutes(fastify: FastifyInstance) {
  const spots = repositories.parking_spots;
  const residents = repositories.residents;

  // GET / — 列出所有綁定
  fastify.get(
    '/',
    {
      schema: {
        tags: ['parking-binding'],
        summary: '列出所有停車位綁定',
        description: '回傳所有 bound_resident_id 不為 NULL 的車位',
        response: {
          200: { type: 'array', items: { type: 'object', additionalProperties: true } },
          400: {
            type: 'object',
            properties: {
              statusCode: { type: 'integer' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async () => {
      const rows = spots.findBy(
        'bound_resident_id IS NOT NULL',
        [],
        'updated_at DESC',
      );
      return rows.map((r) => toBindingRecord(r));
    },
  );

  // GET /resident/:residentId — 取某住戶的綁定
  fastify.get<{ Params: { residentId: string } }>(
    '/resident/:residentId',
    {
      schema: {
        tags: ['parking-binding'],
        summary: '取某住戶的綁定車位',
        params: {
          type: 'object',
          properties: { residentId: { type: 'string', minLength: 1 } },
          required: ['residentId'],
        },
        response: {
          200: { type: 'array', items: { type: 'object', additionalProperties: true } },
          400: {
            type: 'object',
            properties: {
              statusCode: { type: 'integer' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request) => {
      const rows = spots.findBy(
        'bound_resident_id = ?',
        [request.params.residentId],
        'floor, number',
      );
      return rows.map((r) => toBindingRecord(r));
    },
  );

  // GET /:id — 單筆綁定（id = spot_id）
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        tags: ['parking-binding'],
        summary: '取得單筆綁定（id = spot_id）',
        params: idParamSchema,
        response: {
          200: { type: 'object', additionalProperties: true },
          ...notFoundSchema,
        },
      },
    },
    async (request) => {
      const spot = spots.getById(request.params.id);
      if (!spot || !spot.boundResidentId) {
        throw { statusCode: 404, message: '找不到綁定' };
      }
      return toBindingRecord(spot);
    },
  );

  // POST / — 建立綁定 {spotId, residentId}
  fastify.post<{ Body: BindBody }>(
    '/',
    {
      schema: {
        tags: ['parking-binding'],
        summary: '建立綁定',
        body: {
          type: 'object',
          required: ['spotId', 'residentId'],
          properties: {
            spotId: { type: 'string', minLength: 1 },
            residentId: { type: 'string', minLength: 1 },
          },
        },
        response: {
          201: { type: 'object', additionalProperties: true },
          400: {
            type: 'object',
            properties: {
              statusCode: { type: 'integer' },
              message: { type: 'string' },
            },
          },
          404: {
            type: 'object',
            properties: {
              statusCode: { type: 'integer' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request) => {
      try {
        const { spotId, residentId } = request.body;
        if (!spotId || !residentId) {
          throw { statusCode: 400, message: '缺少 spotId 或 residentId' };
        }
        const spot = spots.getById(spotId);
        if (!spot) throw { statusCode: 404, message: '找不到停車位' };
        const resident = residents.getById(residentId);
        if (!resident) throw { statusCode: 404, message: '找不到住戶' };

        // 解除舊綁定：這個 resident 之前可能綁了別的車位
        const oldSpots = spots.findBy(
          'bound_resident_id = ? AND id != ?',
          [residentId, spotId],
        );
        for (const old of oldSpots) {
          spots.update(old.id, { boundResidentId: null });
        }
        // 解除被取代的住戶：這個 spot 之前可能綁了別人
        if (spot.boundResidentId && spot.boundResidentId !== residentId) {
          residents.update(spot.boundResidentId as string, { parkingId: null });
        }
        // 寫新綁定（雙向）
        spots.update(spotId, { boundResidentId: residentId });
        residents.update(residentId, { parkingId: spotId });

        const updated = spots.getById(spotId);
        return toBindingRecord(updated);
      } catch (e: any) {
        if (e && typeof e.code === 'string' && e.code.startsWith('SQLITE_CONSTRAINT')) {
          throw Object.assign(new Error(`欄位驗證失敗: ${e.message}`), { statusCode: 400 });
        }
        throw e;
      }
    },
  );

  // PUT /:id — 更新綁定（id = spot_id，residentId 為 null = 解除）
  fastify.put<{ Params: { id: string }; Body: BindBody }>(
    '/:id',
    {
      schema: {
        tags: ['parking-binding'],
        summary: '更新綁定（id = spot_id）',
        params: idParamSchema,
        body: {
          type: 'object',
          required: ['residentId'],
          properties: {
            residentId: { type: ['string', 'null'], minLength: 1 },
          },
        },
        response: {
          200: { type: 'object', additionalProperties: true },
          ...notFoundSchema,
        },
      },
    },
    async (request) => {
      try {
        const spot = spots.getById(request.params.id);
        if (!spot) throw { statusCode: 404, message: '找不到停車位' };
        const { residentId } = request.body;
        // 解除舊綁定（這個 spot 上原本綁的住戶要清空 parking_id）
        if (spot.boundResidentId && spot.boundResidentId !== residentId) {
          residents.update(spot.boundResidentId as string, { parkingId: null });
        }
        // 解除該住戶的其他車位綁定
        if (residentId) {
          const oldSpots = spots.findBy(
            'bound_resident_id = ? AND id != ?',
            [residentId, request.params.id],
          );
          for (const old of oldSpots) {
            spots.update(old.id, { boundResidentId: null });
          }
          const resident = residents.getById(residentId);
          if (!resident) throw { statusCode: 404, message: '找不到住戶' };
          residents.update(residentId, { parkingId: request.params.id });
        }
        // 寫新綁定（可能為 null = 解除）
        spots.update(request.params.id, { boundResidentId: residentId });
        const updated = spots.getById(request.params.id);
        return toBindingRecord(updated);
      } catch (e: any) {
        if (e && typeof e.code === 'string' && e.code.startsWith('SQLITE_CONSTRAINT')) {
          throw Object.assign(new Error(`欄位驗證失敗: ${e.message}`), { statusCode: 400 });
        }
        throw e;
      }
    },
  );

  // DELETE /:id — 解除綁定（id = spot_id）
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        tags: ['parking-binding'],
        summary: '解除綁定（id = spot_id）',
        params: idParamSchema,
        response: {
          200: {
            type: 'object',
            properties: { success: { type: 'boolean' } },
          },
          ...notFoundSchema,
        },
      },
    },
    async (request) => {
      try {
        const spot = spots.getById(request.params.id);
        if (!spot || !spot.boundResidentId) {
          throw { statusCode: 404, message: '找不到綁定' };
        }
        // 解開雙向綁定
        spots.update(request.params.id, { boundResidentId: null });
        residents.update(spot.boundResidentId as string, { parkingId: null });
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