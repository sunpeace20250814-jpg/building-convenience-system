/**
 * 系統設定 Routes（Phase 6：透過 buildingService 路由）
 *
 * 路徑前綴：/api/settings
 *
 * AI 友善說明：
 * - 對應資料表：status_options + buildings + parking_spots
 * - 業務邏輯已抽到 `services/buildingService.ts`
 * - route 只負責：HTTP 介面（接收 req → 呼叫 service → 回傳 response）
 *
 * 狀態選項（/api/settings/status）：
 *   GET    /status                       列出
 *   GET    /status/type/:type            依類型（resident/parking）
 *   GET    /status/:id                   單筆
 *   POST   /status                       新增
 *   PUT    /status/:id                   更新
 *   DELETE /status/:id                   刪除
 *
 * 建築物（/api/settings/buildings）：
 *   GET    /buildings                              列出
 *   GET    /buildings/:id                          單筆
 *   POST   /buildings                              新增
 *   PUT    /buildings/:id                          更新
 *   DELETE /buildings/:id                          刪除
 *   POST   /buildings/:id/generate-floors          自動生成樓層
 *   POST   /buildings/:id/generate-residents       自動生成住戶空屋
 *   GET    /buildings/:id/summary                  統計摘要
 *
 * 停車位（/api/settings/parking）：
 *   GET    /parking                      列出
 *   GET    /parking/building/:bid        依建築
 *   GET    /parking/:id                  單筆
 *   POST   /parking                      新增
 *   PUT    /parking/:id                  更新
 *   DELETE /parking/:id                  刪除
 */

import type { FastifyInstance } from 'fastify';
import { repositories } from '../db/repository.js';
import { idParamSchema, notFoundSchema } from './_crud.js';
import * as buildingService from '../services/buildingService.js';

export default async function settingsRoutes(fastify: FastifyInstance) {
  // ============================================================
  // Status Options
  // ============================================================
  const statusRepo = repositories.status_options;

  fastify.get('/status', {
    schema: {
      tags: ['settings'],
      summary: '列出所有狀態選項',
      response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
    },
  }, async () => statusRepo.findBy('1=1', [], 'type, sort_order'));

  fastify.get<{ Params: { type: string } }>(
    '/status/type/:type',
    {
      schema: {
        tags: ['settings'],
        summary: '依類型列出狀態',
        params: {
          type: 'object',
          properties: { type: { type: 'string', enum: ['resident', 'parking'] } },
          required: ['type'],
        },
      },
    },
    async (request) =>
      statusRepo.findBy('type = ?', [request.params.type], 'sort_order'),
  );

  fastify.get<{ Params: { id: string } }>(
    '/status/:id',
    {
      schema: {
        tags: ['settings'],
        summary: '取得單筆狀態',
        params: idParamSchema,
        response: { 200: { type: 'object', additionalProperties: true }, ...notFoundSchema },
      },
    },
    async (request) => {
      const r = statusRepo.getById(request.params.id);
      if (!r) throw { statusCode: 404, message: '找不到狀態' };
      return r;
    },
  );

  fastify.post<{ Body: Record<string, unknown> }>(
    '/status',
    {
      schema: {
        tags: ['settings'],
        summary: '新增狀態',
        body: {
          type: 'object',
          required: ['type', 'label', 'color'],
          properties: {
            type: { type: 'string', enum: ['resident', 'parking'] },
            label: { type: 'string', minLength: 1 },
            color: { type: 'string', minLength: 1 },
            sortOrder: { type: 'integer', minimum: 0 },
          },
        },
      },
    },
    async (request) => statusRepo.create(request.body),
  );

  fastify.put<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/status/:id',
    {
      schema: {
        tags: ['settings'],
        summary: '更新狀態',
        params: idParamSchema,
        body: { type: 'object', additionalProperties: true },
        response: { 200: { type: 'object', additionalProperties: true }, ...notFoundSchema },
      },
    },
    async (request) => {
      const updated = statusRepo.update(request.params.id, request.body);
      if (!updated) throw { statusCode: 404, message: '找不到狀態' };
      return updated;
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    '/status/:id',
    {
      schema: {
        tags: ['settings'],
        summary: '刪除狀態',
        params: idParamSchema,
        response: {
          200: { type: 'object', properties: { success: { type: 'boolean' } } },
          ...notFoundSchema,
        },
      },
    },
    async (request) => {
      const ok = statusRepo.delete(request.params.id);
      if (!ok) throw { statusCode: 404, message: '找不到狀態' };
      return { success: true };
    },
  );

  // ============================================================
  // Buildings（透過 buildingService）
  // ============================================================

  fastify.get('/buildings', {
    schema: {
      tags: ['settings'],
      summary: '列出所有建築物',
      response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
    },
  }, async () => buildingService.listBuildings());

  fastify.get<{ Params: { id: string } }>(
    '/buildings/:id',
    {
      schema: {
        tags: ['settings'],
        summary: '取得單筆建築物',
        params: idParamSchema,
        response: { 200: { type: 'object', additionalProperties: true }, ...notFoundSchema },
      },
    },
    async (request) => buildingService.getBuilding(request.params.id),
  );

  fastify.post<{ Body: buildingService.BuildingInput }>(
    '/buildings',
    {
      schema: {
        tags: ['settings'],
        summary: '新增建築物',
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1 },
            normalFloorCount: { type: 'integer', minimum: 0 },
            rooftopFloorCount: { type: 'integer', minimum: 0 },
            basementFloorCount: { type: 'integer', minimum: 0 },
            notes: { type: 'string' },
          },
        },
      },
    },
    async (request) => buildingService.createBuilding(request.body),
  );

  fastify.put<{ Params: { id: string }; Body: Partial<buildingService.BuildingInput> }>(
    '/buildings/:id',
    {
      schema: {
        tags: ['settings'],
        summary: '更新建築物',
        params: idParamSchema,
        body: { type: 'object', additionalProperties: true },
        response: { 200: { type: 'object', additionalProperties: true }, ...notFoundSchema },
      },
    },
    async (request) => buildingService.updateBuilding(request.params.id, request.body),
  );

  fastify.delete<{ Params: { id: string } }>(
    '/buildings/:id',
    {
      schema: {
        tags: ['settings'],
        summary: '刪除建築物（FK CASCADE 連帶刪 floors / facilities / parking_spots）',
        params: idParamSchema,
        response: {
          200: { type: 'object', properties: { success: { type: 'boolean' } } },
          ...notFoundSchema,
        },
      },
    },
    async (request) => buildingService.deleteBuilding(request.params.id),
  );

  // ----- Building 業務邏輯（Phase 6 新增） -----

  // POST /buildings/:id/generate-floors
  fastify.post<{ Params: { id: string } }>(
    '/buildings/:id/generate-floors',
    {
      schema: {
        tags: ['settings'],
        summary: '依建築物設定自動生成所有樓層（domain.generateFloorLabels）',
        params: idParamSchema,
        response: {
          200: { type: 'object', additionalProperties: true },
          ...notFoundSchema,
        },
      },
    },
    async (request) => buildingService.generateFloorsForBuilding(request.params.id),
  );

  // POST /buildings/:id/generate-residents
  fastify.post<{
    Params: { id: string };
    Body: { unitsPerFloor: number; vacantLabel?: string; overwriteExisting?: boolean };
  }>(
    '/buildings/:id/generate-residents',
    {
      schema: {
        tags: ['settings'],
        summary: '依建築物自動生成住戶空屋（domain.generateEmptyResidentsForBuilding）',
        params: idParamSchema,
        body: {
          type: 'object',
          required: ['unitsPerFloor'],
          properties: {
            unitsPerFloor: { type: 'integer', minimum: 1 },
            vacantLabel: { type: 'string' },
            overwriteExisting: { type: 'boolean' },
          },
        },
        response: {
          200: { type: 'object', additionalProperties: true },
          400: {
            type: 'object',
            properties: { statusCode: { type: 'integer' }, message: { type: 'string' } },
          },
          ...notFoundSchema,
        },
      },
    },
    async (request) =>
      buildingService.generateResidentsForBuilding(request.params.id, {
        unitsPerFloor: request.body.unitsPerFloor,
        vacantLabel: request.body.vacantLabel,
        overwriteExisting: request.body.overwriteExisting,
      }),
  );

  // GET /buildings/:id/summary
  fastify.get<{ Params: { id: string } }>(
    '/buildings/:id/summary',
    {
      schema: {
        tags: ['settings'],
        summary: '建築物統計摘要（總樓層 / 樓層分布 / 住戶數 / 空屋數）',
        params: idParamSchema,
        response: {
          200: { type: 'object', additionalProperties: true },
          ...notFoundSchema,
        },
      },
    },
    async (request) => buildingService.summarizeBuilding(request.params.id),
  );

  // ============================================================
  // Parking Spots
  // ============================================================
  const parkRepo = repositories.parking_spots;

  fastify.get('/parking', {
    schema: {
      tags: ['settings'],
      summary: '列出所有停車位',
      response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
    },
  }, async () => parkRepo.findBy('1=1', [], 'floor, number'));

  fastify.get<{ Params: { buildingId: string } }>(
    '/parking/building/:buildingId',
    {
      schema: {
        tags: ['settings'],
        summary: '依建築物列出停車位',
        params: {
          type: 'object',
          properties: { buildingId: { type: 'string', minLength: 1 } },
          required: ['buildingId'],
        },
      },
    },
    async (request) =>
      parkRepo.findBy(
        'building_id = ?',
        [request.params.buildingId],
        'floor, number',
      ),
  );

  fastify.get<{ Params: { id: string } }>(
    '/parking/:id',
    {
      schema: {
        tags: ['settings'],
        summary: '取得單筆停車位',
        params: idParamSchema,
        response: { 200: { type: 'object', additionalProperties: true }, ...notFoundSchema },
      },
    },
    async (request) => {
      const r = parkRepo.getById(request.params.id);
      if (!r) throw { statusCode: 404, message: '找不到停車位' };
      return r;
    },
  );

  fastify.post<{ Body: Record<string, unknown> }>(
    '/parking',
    {
      schema: {
        tags: ['settings'],
        summary: '新增停車位',
        body: {
          type: 'object',
          required: ['floor', 'number'],
          properties: {
            buildingId: { type: 'string' },
            floor: { type: 'string', minLength: 1 },
            number: { type: 'string', minLength: 1 },
            space: { type: 'string' },
            type: { type: 'string', enum: ['car', 'motorcycle', 'large'] },
            status: { type: 'string', enum: ['empty', 'rented', 'sold', 'used'] },
            statusId: { type: 'string' },
            residentId: { type: 'string' },
            boundResidentId: { type: 'string' },
            notes: { type: 'string' },
          },
        },
      },
    },
    async (request) => parkRepo.create(request.body),
  );

  fastify.put<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/parking/:id',
    {
      schema: {
        tags: ['settings'],
        summary: '更新停車位',
        params: idParamSchema,
        body: { type: 'object', additionalProperties: true },
        response: { 200: { type: 'object', additionalProperties: true }, ...notFoundSchema },
      },
    },
    async (request) => {
      const updated = parkRepo.update(request.params.id, request.body);
      if (!updated) throw { statusCode: 404, message: '找不到停車位' };
      return updated;
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    '/parking/:id',
    {
      schema: {
        tags: ['settings'],
        summary: '刪除停車位',
        params: idParamSchema,
        response: {
          200: { type: 'object', properties: { success: { type: 'boolean' } } },
          ...notFoundSchema,
        },
      },
    },
    async (request) => {
      const ok = parkRepo.delete(request.params.id);
      if (!ok) throw { statusCode: 404, message: '找不到停車位' };
      return { success: true };
    },
  );
}
