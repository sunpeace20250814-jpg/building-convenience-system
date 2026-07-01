/**
 * 裝潢記錄 Routes
 *
 * 路徑前綴：/api/decoration-records
 *
 * AI 友善說明：
 * - 對應資料表：decoration_records
 * - 對應 client/src/storage/schema.ts 的 decoration_records Repository
 * - 一戶多筆裝潢紀錄（含開始 / 結束 / 退裝潢 + 圖片）
 *
 * 欄位（schema.ts decoration_records）：
 *   id, residentId, name, startDate, endDate, removalDate,
 *   startImage, removalImage, notes, createdAt, updatedAt
 *
 * 端點：
 *   GET    /                       列出所有裝潢紀錄
 *   GET    /resident/:residentId   依住戶取裝潢紀錄
 *   GET    /:id                    單筆
 *   POST   /                       新增
 *   PUT    /:id                    更新
 *   DELETE /:id                    刪除
 *
 * FK 約束：
 *   - resident_id → residents(id) ON DELETE CASCADE
 */

import type { FastifyInstance } from 'fastify';
import { repositories } from '../db/repository.js';
import { idParamSchema, notFoundSchema, tryDbOp } from './_crud.js';

export default async function decorationRecordsRoutes(fastify: FastifyInstance) {
  const repo = repositories.decoration_records;

  // GET / — 列表（依建立時間倒序）
  fastify.get('/', {
    schema: {
      tags: ['decoration-records'],
      summary: '列出所有裝潢紀錄',
      response: {
        200: { type: 'array', items: { type: 'object', additionalProperties: true } },
      },
    },
  }, async () => repo.findBy('1=1', [], 'created_at DESC'));

  // GET /resident/:residentId — 依住戶取
  fastify.get<{ Params: { residentId: string } }>(
    '/resident/:residentId',
    {
      schema: {
        tags: ['decoration-records'],
        summary: '依住戶 ID 列出裝潢紀錄',
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

  // GET /:id — 單筆
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        tags: ['decoration-records'],
        summary: '取得單筆裝潢紀錄',
        params: idParamSchema,
        response: {
          200: { type: 'object', additionalProperties: true },
          ...notFoundSchema,
        },
      },
    },
    async (request) => {
      const item = repo.getById(request.params.id);
      if (!item) throw { statusCode: 404, message: '找不到裝潢紀錄' };
      return item;
    },
  );

  // POST / — 新增
  fastify.post(
    '/',
    {
      schema: {
        tags: ['decoration-records'],
        summary: '新增裝潢紀錄',
        body: {
          type: 'object',
          required: ['residentId', 'name'],
          properties: {
            residentId: { type: 'string', minLength: 1 },
            name: { type: 'string', minLength: 1 },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            removalDate: { type: 'string' },
            startImage: { type: 'string' },
            removalImage: { type: 'string' },
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
        tags: ['decoration-records'],
        summary: '更新裝潢紀錄',
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
        if (!updated) throw { statusCode: 404, message: '找不到裝潢紀錄' };
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
        tags: ['decoration-records'],
        summary: '刪除裝潢紀錄',
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
        if (!ok) throw { statusCode: 404, message: '找不到裝潢紀錄' };
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