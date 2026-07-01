/**
 * 區權人緊急聯絡人 Routes
 *
 * 路徑前綴：/api/resident-emergency-contacts
 *
 * AI 友善說明：
 * - 對應資料表：resident_emergency_contacts
 * - 對應 client/src/storage/schema.ts 的 resident_emergency_contacts Repository
 * - 一戶多筆緊急聯絡人（取代 residents.emergency_contact 單筆）
 *
 * 欄位（schema.ts resident_emergency_contacts）：
 *   id, residentId, name, phone, address, relation, notes, createdAt
 *
 * 端點：
 *   GET    /                          列出所有緊急聯絡人
 *   GET    /resident/:residentId      依住戶取緊急聯絡人
 *   GET    /:id                       單筆
 *   POST   /                          新增
 *   PUT    /:id                       更新
 *   DELETE /:id                       刪除
 *
 * FK 約束：
 *   - resident_id → residents(id) ON DELETE CASCADE
 */

import type { FastifyInstance } from 'fastify';
import { repositories } from '../db/repository.js';
import { idParamSchema, notFoundSchema, tryDbOp } from './_crud.js';

export default async function residentEmergencyContactsRoutes(fastify: FastifyInstance) {
  const repo = repositories.resident_emergency_contacts;

  // GET / — 列表
  fastify.get('/', {
    schema: {
      tags: ['resident-emergency-contacts'],
      summary: '列出所有緊急聯絡人',
      response: {
        200: { type: 'array', items: { type: 'object', additionalProperties: true } },
      },
    },
  }, async () => repo.findBy('1=1', [], 'name'));

  // GET /resident/:residentId — 依住戶取
  fastify.get<{ Params: { residentId: string } }>(
    '/resident/:residentId',
    {
      schema: {
        tags: ['resident-emergency-contacts'],
        summary: '依住戶 ID 列出緊急聯絡人',
        params: {
          type: 'object',
          properties: { residentId: { type: 'string', minLength: 1 } },
          required: ['residentId'],
        },
      },
    },
    async (request) =>
      repo.findBy('resident_id = ?', [request.params.residentId], 'name'),
  );

  // GET /:id — 單筆
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        tags: ['resident-emergency-contacts'],
        summary: '取得單筆緊急聯絡人',
        params: idParamSchema,
        response: {
          200: { type: 'object', additionalProperties: true },
          ...notFoundSchema,
        },
      },
    },
    async (request) => {
      const item = repo.getById(request.params.id);
      if (!item) throw { statusCode: 404, message: '找不到緊急聯絡人' };
      return item;
    },
  );

  // POST / — 新增
  fastify.post(
    '/',
    {
      schema: {
        tags: ['resident-emergency-contacts'],
        summary: '新增緊急聯絡人',
        body: {
          type: 'object',
          required: ['residentId', 'name'],
          properties: {
            residentId: { type: 'string', minLength: 1 },
            name: { type: 'string', minLength: 1 },
            phone: { type: 'string' },
            address: { type: 'string' },
            relation: { type: 'string' },
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
        tags: ['resident-emergency-contacts'],
        summary: '更新緊急聯絡人',
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
        if (!updated) throw { statusCode: 404, message: '找不到緊急聯絡人' };
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
        tags: ['resident-emergency-contacts'],
        summary: '刪除緊急聯絡人',
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
        if (!ok) throw { statusCode: 404, message: '找不到緊急聯絡人' };
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