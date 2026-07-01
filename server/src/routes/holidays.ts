/**
 * 國定假日 Routes
 *
 * 路徑前綴：/api/holidays
 *
 * AI 友善說明：
 * - 對應資料表：holidays
 * - 對應 client/src/storage/database.ts 的 holidays Repository
 * - 對應 client/src/api/holidays.ts 的 holidaysApi（注意：client 端目前指向
 *   /api/schedule/holidays，這個新路由是 sibling API，不影響既有 schedule route）
 *
 * 欄位（schema.ts holidays）：
 *   id, date (UNIQUE), name,
 *   categoryId (FK→holiday_categories, ON DELETE SET NULL),
 *   color (override; null 用 category 預設色),
 *   notes, createdAt, updatedAt
 *
 * 端點：
 *   GET    /              列出所有（依 date 排序）
 *   GET    /year/:year    依年份（YYYY）篩選
 *   GET    /date/:date    依日期單筆
 *   GET    /:id           單筆
 *   POST   /              新增
 *   PUT    /:id           更新
 *   DELETE /:id           刪除
 */

import type { FastifyInstance } from 'fastify';
import { repositories } from '../db/repository.js';
import { createCrudRoutes, idParamSchema, notFoundSchema } from './_crud.js';

export default async function holidaysRoutes(fastify: FastifyInstance) {
  const repo = repositories.holidays;

  // ============================================================
  // 特殊查詢端點（先註冊，確保 /year/:year 與 /date/:date 優先於 /:id）
  // ============================================================

  // GET /year/:year — 依年份
  fastify.get<{ Params: { year: string } }>(
    '/year/:year',
    {
      schema: {
        tags: ['holidays'],
        summary: '依年份列出國定假日',
        params: {
          type: 'object',
          properties: { year: { type: 'string', pattern: '^[0-9]{4}$' } },
          required: ['year'],
        },
        response: {
          200: { type: 'array', items: { type: 'object', additionalProperties: true } },
        },
      },
    },
    async (request) =>
      repo.findBy('date LIKE ?', [`${request.params.year}-%`], 'date'),
  );

  // GET /date/:date — 依日期查單筆
  fastify.get<{ Params: { date: string } }>(
    '/date/:date',
    {
      schema: {
        tags: ['holidays'],
        summary: '依日期查國定假日',
        params: idParamSchema,
        response: {
          200: { type: 'object', additionalProperties: true },
          ...notFoundSchema,
        },
      },
    },
    async (request) => {
      const r = repo.findOneBy('date = ?', [request.params.date]);
      if (!r) throw { statusCode: 404, message: '找不到假日' };
      return r;
    },
  );

  // ============================================================
  // 標準 CRUD（GET list + GET /:id + POST + PUT /:id + DELETE /:id）
  // ============================================================

  await createCrudRoutes(fastify, {
    tag: 'holidays',
    resourceLabel: '國定假日',
    repository: repo,
    orderBy: 'date',
    createBodySchema: {
      type: 'object',
      required: ['date', 'name'],
      properties: {
        date: { type: 'string', minLength: 1 },
        name: { type: 'string', minLength: 1 },
        categoryId: { type: 'string' },
        color: { type: 'string' },
        notes: { type: 'string' },
      },
    },
  });
}
