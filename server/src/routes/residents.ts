/**
 * 住戶 Routes（Phase 6：透過 residentService 路由）
 *
 * 路徑前綴：/api/residents
 *
 * AI 友善說明：
 * - 對應資料表：residents + resident_members + resident_keycards
 * - 業務邏輯已抽到 `services/residentService.ts`
 * - route 只負責：HTTP 介面（接收 req → 呼叫 service → 回傳 response）
 *
 * 住戶端點：
 *   GET    /                            列出所有住戶（domain.compareResidents 排序）
 *   GET    /search?q=                   關鍵字搜尋（domain.matchesQuery）
 *   GET    /building/:buildingId        依建築物取住戶
 *   GET    /building/:buildingId/summary 該建築住戶摘要（vacant/rental/sold/normal 計數）
 *   GET    /:id                         單筆
 *   POST   /                            新增
 *   PUT    /:id                         更新
 *   DELETE /:id                         刪除
 *   POST   /refresh-vacant              重新整理空屋標記
 *
 * 成員子端點：
 *   GET    /:id/members                 該住戶所有成員
 *   POST   /:id/members                 新增成員
 *   PUT    /:id/members/:memberId       更新成員
 *   DELETE /:id/members/:memberId       刪除成員
 *
 * 鑰匙卡子端點：
 *   GET    /:id/keycards                該住戶所有鑰匙卡
 *   POST   /:id/keycards                新增鑰匙卡
 *   PUT    /:id/keycards/:keycardId     更新鑰匙卡
 *   DELETE /:id/keycards/:keycardId     刪除鑰匙卡
 */

import type { FastifyInstance } from 'fastify';
import { idParamSchema, notFoundSchema } from './_crud.js';
import * as residentService from '../services/residentService.js';

// 住戶 body schema
const residentBodySchema = {
  type: 'object',
  required: ['buildingId', 'floor', 'name'],
  properties: {
    property: { type: 'string' },
    buildingId: { type: 'string', minLength: 1 },
    floorId: { type: 'string' },
    floor: { type: 'string', minLength: 1 },
    floorIndex: { type: 'integer' },
    unitNumber: { type: 'string' },
    unitType: { type: 'string', enum: ['normal', 'rental', 'whole_floor'] },
    name: { type: 'string', minLength: 1 },
    ownerName: { type: 'string' },
    ownerAddress: { type: 'string' },
    deliveryDate: { type: 'string' },
    renterName: { type: 'string' },
    phone: { type: 'string' },
    email: { type: 'string', format: 'email' },
    parkingId: { type: 'string' },
    memberCount: { type: 'integer', minimum: 0 },
    deposit: { type: 'number', minimum: 0 },
    monthlyRent: { type: 'number', minimum: 0 },
    moveInDate: { type: 'string' },
    moveOutDate: { type: 'string' },
    statusId: { type: 'string' },
    status: { type: 'string' },
    emergencyContact: { type: 'string' },
    emergencyPhone: { type: 'string' },
    note: { type: 'string' },
    notes: { type: 'string' },
  },
  additionalProperties: true,
};

export default async function residentsRoutes(fastify: FastifyInstance) {
  // ===== 住戶主體 =====

  // GET /
  fastify.get('/', {
    schema: {
      tags: ['residents'],
      summary: '列出所有住戶',
      response: {
        200: { type: 'array', items: { type: 'object', additionalProperties: true } },
      },
    },
  }, async () => residentService.listResidents());

  // GET /search?q=
  fastify.get<{ Querystring: { q?: string } }>(
    '/search',
    {
      schema: {
        tags: ['residents'],
        summary: '關鍵字搜尋住戶（姓名/電話/樓層）',
        querystring: {
          type: 'object',
          properties: { q: { type: 'string' } },
        },
      },
    },
    async (request) => residentService.searchResidents(request.query.q || ''),
  );

  // GET /building/:buildingId
  fastify.get<{ Params: { buildingId: string } }>(
    '/building/:buildingId',
    {
      schema: {
        tags: ['residents'],
        summary: '依建築物列出住戶',
        params: {
          type: 'object',
          properties: { buildingId: { type: 'string', minLength: 1 } },
          required: ['buildingId'],
        },
      },
    },
    async (request) => residentService.listResidentsByBuilding(request.params.buildingId),
  );

  // GET /building/:buildingId/summary  Phase 6 新增
  fastify.get<{ Params: { buildingId: string } }>(
    '/building/:buildingId/summary',
    {
      schema: {
        tags: ['residents'],
        summary: '該建築物住戶摘要（vacant/rental/sold/normal/計數）',
        params: {
          type: 'object',
          properties: { buildingId: { type: 'string', minLength: 1 } },
          required: ['buildingId'],
        },
        response: {
          200: { type: 'object', additionalProperties: true },
        },
      },
    },
    async (request) => residentService.summarizeResidentsByBuilding(request.params.buildingId),
  );

  // GET /:id
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        tags: ['residents'],
        summary: '取得單筆住戶',
        params: idParamSchema,
        response: {
          200: { type: 'object', additionalProperties: true },
          ...notFoundSchema,
        },
      },
    },
    async (request) => residentService.getResident(request.params.id),
  );

  // POST /
  fastify.post(
    '/',
    {
      schema: {
        tags: ['residents'],
        summary: '新增住戶',
        body: residentBodySchema,
        response: { 201: { type: 'object', additionalProperties: true } },
      },
    },
    async (request) => residentService.createResident(request.body as residentService.ResidentInput),
  );

  // PUT /:id
  fastify.put<{ Params: { id: string }; Body: Partial<residentService.ResidentInput> }>(
    '/:id',
    {
      schema: {
        tags: ['residents'],
        summary: '更新住戶',
        params: idParamSchema,
        body: residentBodySchema,
        response: {
          200: { type: 'object', additionalProperties: true },
          ...notFoundSchema,
        },
      },
    },
    async (request) => residentService.updateResident(request.params.id, request.body),
  );

  // DELETE /:id
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        tags: ['residents'],
        summary: '刪除住戶（FK CASCADE 連帶刪 members / keycards）',
        params: idParamSchema,
        response: {
          200: { type: 'object', properties: { success: { type: 'boolean' } } },
          ...notFoundSchema,
        },
      },
    },
    async (request) => residentService.deleteResident(request.params.id),
  );

  // POST /refresh-vacant  Phase 6 新增
  fastify.post(
    '/refresh-vacant',
    {
      schema: {
        tags: ['residents'],
        summary: '重新整理空屋標記（domain.isVacant）',
        response: {
          200: { type: 'object', properties: { updated: { type: 'integer' } } },
        },
      },
    },
    async () => residentService.refreshVacantFlags(),
  );

  // ===== 成員 =====

  fastify.get<{ Params: { id: string } }>(
    '/:id/members',
    {
      schema: {
        tags: ['residents'],
        summary: '列出該住戶所有成員',
        params: idParamSchema,
      },
    },
    async (request) => residentService.listMembers(request.params.id),
  );

  fastify.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/:id/members',
    {
      schema: {
        tags: ['residents'],
        summary: '新增成員',
        params: idParamSchema,
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1 },
            relation: { type: 'string' },
            relationship: { type: 'string' },
            phone: { type: 'string' },
            idNumber: { type: 'string' },
            birthdate: { type: 'string' },
            note: { type: 'string' },
            notes: { type: 'string' },
          },
          additionalProperties: true,
        },
      },
    },
    async (request) => residentService.createMember(request.params.id, request.body),
  );

  fastify.put<{ Params: { id: string; memberId: string }; Body: Record<string, unknown> }>(
    '/:id/members/:memberId',
    {
      schema: {
        tags: ['residents'],
        summary: '更新成員',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            memberId: { type: 'string' },
          },
          required: ['id', 'memberId'],
        },
        body: { type: 'object', additionalProperties: true },
      },
    },
    async (request) => residentService.updateMember(request.params.memberId, request.body),
  );

  fastify.delete<{ Params: { id: string; memberId: string } }>(
    '/:id/members/:memberId',
    {
      schema: {
        tags: ['residents'],
        summary: '刪除成員',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            memberId: { type: 'string' },
          },
          required: ['id', 'memberId'],
        },
        response: {
          200: { type: 'object', properties: { success: { type: 'boolean' } } },
          ...notFoundSchema,
        },
      },
    },
    async (request) => residentService.deleteMember(request.params.memberId),
  );

  // ===== 鑰匙卡 =====

  fastify.get<{ Params: { id: string } }>(
    '/:id/keycards',
    {
      schema: {
        tags: ['residents'],
        summary: '列出該住戶所有鑰匙卡',
        params: idParamSchema,
      },
    },
    async (request) => residentService.listKeycards(request.params.id),
  );

  fastify.post<{ Params: { id: string }; Body: { cardNumber: string; note?: string } }>(
    '/:id/keycards',
    {
      schema: {
        tags: ['residents'],
        summary: '新增鑰匙卡',
        params: idParamSchema,
        body: {
          type: 'object',
          required: ['cardNumber'],
          properties: {
            cardNumber: { type: 'string', minLength: 1 },
            note: { type: 'string' },
          },
        },
      },
    },
    async (request) => residentService.createKeycard(request.params.id, request.body.cardNumber, request.body.note),
  );

  fastify.put<{ Params: { id: string; keycardId: string }; Body: Record<string, unknown> }>(
    '/:id/keycards/:keycardId',
    {
      schema: {
        tags: ['residents'],
        summary: '更新鑰匙卡',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            keycardId: { type: 'string' },
          },
          required: ['id', 'keycardId'],
        },
        body: { type: 'object', additionalProperties: true },
      },
    },
    async (request) => residentService.updateKeycard(request.params.keycardId, request.body),
  );

  fastify.delete<{ Params: { id: string; keycardId: string } }>(
    '/:id/keycards/:keycardId',
    {
      schema: {
        tags: ['residents'],
        summary: '刪除鑰匙卡',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            keycardId: { type: 'string' },
          },
          required: ['id', 'keycardId'],
        },
        response: {
          200: { type: 'object', properties: { success: { type: 'boolean' } } },
          ...notFoundSchema,
        },
      },
    },
    async (request) => residentService.deleteKeycard(request.params.keycardId),
  );
}
