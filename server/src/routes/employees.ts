/**
 * 員工 Routes
 *
 * 路徑前綴：/api/employees
 *
 * AI 友善說明：
 * - 對應資料表：employees
 * - 對應 client/src/storage/database.ts 的 employees Repository
 *
 * 欄位（schema.ts employees）：
 *   id, name, phone, lineId, isActive, notes, createdAt, updatedAt
 *
 * 端點：
 *   GET    /                          列出在職員工（?includeInactive=true 列全部）
 *   GET    /:id                       單筆
 *   POST   /                          新增
 *   PUT    /:id                       更新
 *   DELETE /:id                       刪除
 */

import type { FastifyInstance } from 'fastify';
import { repositories } from '../db/repository.js';
import * as scheduleService from '../services/scheduleService.js';

export default async function employeesRoutes(fastify: FastifyInstance) {
  // 員工列表需要支援 includeInactive 過濾，自己註冊
  fastify.get<{ Querystring: { includeInactive?: string } }>(
    '/',
    {
      schema: {
        tags: ['employees'],
        summary: '列出員工',
        querystring: {
          type: 'object',
          properties: { includeInactive: { type: 'string', enum: ['true', 'false'] } },
        },
        response: {
          200: { type: 'array', items: { type: 'object', additionalProperties: true } },
        },
      },
    },
    async (request) => {
      const include = request.query.includeInactive === 'true';
      return include
        ? repositories.employees.findBy('1=1', [], 'name')
        : repositories.employees.findBy('is_active = 1', [], 'name');
    },
  );

  // GET /:id
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    async (request, reply) => {
      const item = repositories.employees.getById(request.params.id);
      if (!item) return reply.code(404).send({ statusCode: 404, message: '找不到員工' });
      return item;
    },
  );

  // POST / - schema
  fastify.post('/',
    {
      schema: {
        body: { type: 'object', additionalProperties: true, minProperties: 1 },
      },
    },
    async (request, reply) => {
      try {
        return repositories.employees.create((request.body || {}) as Record<string, unknown>);
      } catch (e: any) {
        if (e && typeof e.code === 'string' && e.code.startsWith('SQLITE_CONSTRAINT')) {
          return reply.code(400).send({
            statusCode: 400,
            error: 'ValidationError',
            message: `欄位驗證失敗: ${e.message}`,
          });
        }
        throw e;
      }
    },
  );

  // PUT /:id
  fastify.put<{ Params: { id: string } }>(
    '/:id',
    async (request, reply) => {
      try {
        const updated = repositories.employees.update(request.params.id, (request.body || {}) as Record<string, unknown>);
        if (!updated) return reply.code(404).send({ statusCode: 404, message: '找不到員工' });
        return updated;
      } catch (e: any) {
        if (e && typeof e.code === 'string' && e.code.startsWith('SQLITE_CONSTRAINT')) {
          return reply.code(400).send({
            statusCode: 400,
            error: 'ValidationError',
            message: `欄位驗證失敗: ${e.message}`,
          });
        }
        throw e;
      }
    },
  );

  // DELETE /:id — 走 service（schedule_entries cascade 刪除）
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    async (request, reply) => {
      try {
        const result = scheduleService.deleteEmployee(request.params.id);
        return result;
      } catch (e: any) {
        if (e?.statusCode === 404) return reply.code(404).send(e);
        throw e;
      }
    },
  );
}
