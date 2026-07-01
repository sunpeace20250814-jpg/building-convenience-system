/**
 * 首頁標籤 Routes
 *
 * 路徑前綴：/api/home-tabs
 *
 * AI 友善說明：
 * - 對應資料表：home_tabs
 * - 注意：home_records（公告）已拆出獨立路由（/api/home-records）
 * - 對應 client/src/storage/database.ts 的 homeTabs Repository
 *
 * 端點：
 *   GET    /         列出所有標籤
 *   GET    /:id      單筆
 *   POST   /         新增
 *   PUT    /:id      更新
 *   DELETE /:id      刪除（FK CASCADE 連帶刪 records）
 */

import type { FastifyInstance } from 'fastify';
import { repositories } from '../db/repository.js';
import { idParamSchema, notFoundSchema } from './_crud.js';

export default async function homeTabsRoutes(fastify: FastifyInstance) {
  const repo = repositories.home_tabs;

  fastify.get('/', {
    schema: {
      tags: ['home-tabs'],
      summary: '列出所有首頁標籤',
      response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
    },
  }, async () => repo.findBy('1=1', [], 'sort_order'));

  fastify.get<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        tags: ['home-tabs'],
        summary: '取得單筆標籤',
        params: idParamSchema,
        response: { 200: { type: 'object', additionalProperties: true }, ...notFoundSchema },
      },
    },
    async (request) => {
      const r = repo.getById(request.params.id);
      if (!r) throw { statusCode: 404, message: '找不到標籤' };
      return r;
    },
  );

  fastify.post<{ Body: Record<string, unknown> }>(
    '/',
    {
      schema: {
        tags: ['home-tabs'],
        summary: '新增標籤',
        body: {
          type: 'object',
          required: ['name', 'sortOrder'],
          properties: {
            name: { type: 'string', minLength: 1 },
            sortOrder: { type: 'integer', minimum: 0 },
          },
        },
      },
    },
    async (request) => repo.create(request.body),
  );

  fastify.put<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/:id',
    {
      schema: {
        tags: ['home-tabs'],
        summary: '更新標籤',
        params: idParamSchema,
        body: { type: 'object', additionalProperties: true },
        response: { 200: { type: 'object', additionalProperties: true }, ...notFoundSchema },
      },
    },
    async (request) => {
      const updated = repo.update(request.params.id, request.body);
      if (!updated) throw { statusCode: 404, message: '找不到標籤' };
      return updated;
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        tags: ['home-tabs'],
        summary: '刪除標籤（FK CASCADE 連帶刪 records）',
        params: idParamSchema,
        response: {
          200: { type: 'object', properties: { success: { type: 'boolean' } } },
          ...notFoundSchema,
        },
      },
    },
    async (request) => {
      const ok = repo.delete(request.params.id);
      if (!ok) throw { statusCode: 404, message: '找不到標籤' };
      return { success: true };
    },
  );
}
