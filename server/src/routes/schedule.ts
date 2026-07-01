/**
 * 班表 Routes（V4 完整欄位版）
 *
 * 路徑前綴：/api/schedule
 *
 * AI 友善說明：
 * - 對應資料表：employees + shifts + schedule_entries + holidays
 *   （注意：shift_statuses / schedule_holidays / schedule_notes 走獨立的路由檔）
 * - 對應 client/src/storage/database.ts 對應 Repository
 *
 * 員工端點（/api/schedule/employees）：
 *   GET    /employees                          列出（?includeInactive=true 含停用）
 *   GET    /employees/:id                      單筆
 *   POST   /employees                          新增
 *   PUT    /employees/:id                      更新
 *   DELETE /employees/:id                      刪除
 *
 * 班別端點（/api/schedule/shifts）：
 *   GET    /shifts                             列出
 *   GET    /shifts/:id                         單筆
 *   POST   /shifts                             新增
 *   PUT    /shifts/:id                         更新
 *   DELETE /shifts/:id                         刪除
 *
 * 班表端點（/api/schedule）：
 *   GET    /                                   列出（join shift_label / assignee_name）
 *   GET    /date/:date                         依日期
 *   GET    /range?start=&end=                  依日期區間
 *   GET    /:id                                單筆
 *   POST   /                                   新增
 *   PUT    /:id                                更新
 *   DELETE /:id                                刪除
 *
 * 國定假日端點（/api/schedule/holidays）：
 *   GET    /holidays                           列出
 *   GET    /holidays/year/:year                依年份
 *   GET    /holidays/date/:date                依日期
 *   POST   /holidays                           新增
 *   PUT    /holidays/:id                       更新
 *   DELETE /holidays/:id                       刪除
 */

import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { repositories, snakeRowToCamel } from '../db/repository.js';
import { idParamSchema, notFoundSchema } from './_crud.js';

export default async function scheduleRoutes(fastify: FastifyInstance) {
  // ============================================================
  // Employees
  // ============================================================
  const empRepo = repositories.employees;

  fastify.get<{ Querystring: { includeInactive?: string } }>(
    '/employees',
    {
      schema: {
        tags: ['schedule'],
        summary: '列出員工（?includeInactive=true 含停用）',
        querystring: {
          type: 'object',
          properties: { includeInactive: { type: 'string', enum: ['true', 'false'] } },
        },
        response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
      },
    },
    async (request) => {
      const include = request.query.includeInactive === 'true';
      return include
        ? empRepo.findBy('1=1', [], 'name')
        : empRepo.findBy('is_active = 1', [], 'name');
    },
  );

  fastify.get<{ Params: { id: string } }>(
    '/employees/:id',
    {
      schema: {
        tags: ['schedule'],
        summary: '取得單筆員工',
        params: idParamSchema,
        response: { 200: { type: 'object', additionalProperties: true }, ...notFoundSchema },
      },
    },
    async (request) => {
      const r = empRepo.getById(request.params.id);
      if (!r) throw { statusCode: 404, message: '找不到員工' };
      return r;
    },
  );

  fastify.post<{ Body: Record<string, unknown> }>(
    '/employees',
    {
      schema: {
        tags: ['schedule'],
        summary: '新增員工',
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1 },
            phone: { type: 'string' },
            lineId: { type: 'string' },
            isActive: { type: 'boolean' },
            notes: { type: 'string' },
          },
        },
      },
    },
    async (request) => empRepo.create(request.body),
  );

  fastify.put<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/employees/:id',
    {
      schema: {
        tags: ['schedule'],
        summary: '更新員工',
        params: idParamSchema,
        body: { type: 'object', additionalProperties: true },
        response: { 200: { type: 'object', additionalProperties: true }, ...notFoundSchema },
      },
    },
    async (request) => {
      const updated = empRepo.update(request.params.id, request.body);
      if (!updated) throw { statusCode: 404, message: '找不到員工' };
      return updated;
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    '/employees/:id',
    {
      schema: {
        tags: ['schedule'],
        summary: '刪除員工',
        params: idParamSchema,
        response: {
          200: { type: 'object', properties: { success: { type: 'boolean' } } },
          ...notFoundSchema,
        },
      },
    },
    async (request) => {
      const ok = empRepo.delete(request.params.id);
      if (!ok) throw { statusCode: 404, message: '找不到員工' };
      return { success: true };
    },
  );

  // ============================================================
  // Shifts
  // ============================================================
  const shiftRepo = repositories.shifts;

  fastify.get('/shifts', {
    schema: {
      tags: ['schedule'],
      summary: '列出所有班別',
      response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
    },
  }, async () => shiftRepo.findBy('1=1', [], 'order_index'));

  fastify.get<{ Params: { id: string } }>(
    '/shifts/:id',
    {
      schema: {
        tags: ['schedule'],
        summary: '取得單筆班別',
        params: idParamSchema,
        response: { 200: { type: 'object', additionalProperties: true }, ...notFoundSchema },
      },
    },
    async (request) => {
      const r = shiftRepo.getById(request.params.id);
      if (!r) throw { statusCode: 404, message: '找不到班別' };
      return r;
    },
  );

  fastify.post<{ Body: Record<string, unknown> }>(
    '/shifts',
    {
      schema: {
        tags: ['schedule'],
        summary: '新增班別',
        body: {
          type: 'object',
          required: ['name', 'color'],
          properties: {
            name: { type: 'string', minLength: 1 },
            color: { type: 'string', minLength: 1 },
            orderIndex: { type: 'integer', minimum: 0 },
            notes: { type: 'string' },
          },
        },
      },
    },
    async (request) => shiftRepo.create(request.body),
  );

  fastify.put<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/shifts/:id',
    {
      schema: {
        tags: ['schedule'],
        summary: '更新班別',
        params: idParamSchema,
        body: { type: 'object', additionalProperties: true },
        response: { 200: { type: 'object', additionalProperties: true }, ...notFoundSchema },
      },
    },
    async (request) => {
      const updated = shiftRepo.update(request.params.id, request.body);
      if (!updated) throw { statusCode: 404, message: '找不到班別' };
      return updated;
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    '/shifts/:id',
    {
      schema: {
        tags: ['schedule'],
        summary: '刪除班別',
        params: idParamSchema,
        response: {
          200: { type: 'object', properties: { success: { type: 'boolean' } } },
          ...notFoundSchema,
        },
      },
    },
    async (request) => {
      const ok = shiftRepo.delete(request.params.id);
      if (!ok) throw { statusCode: 404, message: '找不到班別' };
      return { success: true };
    },
  );

  // ============================================================
  // Schedule Entries（join shifts / employees）
  // ============================================================
  const schedRepo = repositories.schedule_entries;

  fastify.get('/', {
    schema: {
      tags: ['schedule'],
      summary: '列出所有班表（含 shift_label / assignee_name）',
      response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
    },
  }, async () =>
    db
      .prepare(
        `SELECT se.*, ss.name as shift_label, ss.color as shift_color, e.name as assignee_name
         FROM schedule_entries se
         LEFT JOIN shifts ss ON se.shift_id = ss.id
         LEFT JOIN employees e ON se.assignee_id = e.id
         ORDER BY se.date DESC, se.created_at DESC`,
      )
      .all()
      .map(snakeRowToCamel),
  );

  fastify.get<{ Params: { date: string } }>(
    '/date/:date',
    {
      schema: {
        tags: ['schedule'],
        summary: '依日期列出班表',
        params: idParamSchema,
      },
    },
    async (request) =>
      db
        .prepare(
          `SELECT se.*, ss.name as shift_label, ss.color as shift_color, e.name as assignee_name
           FROM schedule_entries se
           LEFT JOIN shifts ss ON se.shift_id = ss.id
           LEFT JOIN employees e ON se.assignee_id = e.id
           WHERE se.date = ?
           ORDER BY se.created_at`,
        )
        .all(request.params.date)
        .map(snakeRowToCamel),
  );

  fastify.get<{ Querystring: { start?: string; end?: string } }>(
    '/range',
    {
      schema: {
        tags: ['schedule'],
        summary: '依日期區間列出班表',
        querystring: {
          type: 'object',
          properties: { start: { type: 'string' }, end: { type: 'string' } },
        },
        response: {
          200: { type: 'array', items: { type: 'object', additionalProperties: true } },
          400: {
            type: 'object',
            properties: { statusCode: { type: 'integer' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request) => {
      const { start, end } = request.query;
      if (!start || !end) throw { statusCode: 400, message: '需要 start 和 end 參數' };
      return db
        .prepare(
          `SELECT se.*, ss.name as shift_label, ss.color as shift_color, e.name as assignee_name
           FROM schedule_entries se
           LEFT JOIN shifts ss ON se.shift_id = ss.id
           LEFT JOIN employees e ON se.assignee_id = e.id
           WHERE se.date BETWEEN ? AND ?
           ORDER BY se.date, se.created_at`,
        )
        .all(start, end)
        .map(snakeRowToCamel);
    },
  );

  fastify.get<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        tags: ['schedule'],
        summary: '取得單筆班表',
        params: idParamSchema,
        response: { 200: { type: 'object', additionalProperties: true }, ...notFoundSchema },
      },
    },
    async (request) => {
      const r = schedRepo.getById(request.params.id);
      if (!r) throw { statusCode: 404, message: '找不到班表記錄' };
      return r;
    },
  );

  fastify.post<{ Body: Record<string, unknown> }>(
    '/',
    {
      schema: {
        tags: ['schedule'],
        summary: '新增班表記錄',
        body: {
          type: 'object',
          required: ['date', 'shiftId'],
          properties: {
            date: { type: 'string' },
            shiftId: { type: 'string', minLength: 1 },
            assigneeId: { type: 'string' },
            notes: { type: 'string' },
          },
        },
      },
    },
    async (request) => schedRepo.create(request.body),
  );

  fastify.put<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/:id',
    {
      schema: {
        tags: ['schedule'],
        summary: '更新班表記錄',
        params: idParamSchema,
        body: { type: 'object', additionalProperties: true },
        response: { 200: { type: 'object', additionalProperties: true }, ...notFoundSchema },
      },
    },
    async (request) => {
      const updated = schedRepo.update(request.params.id, request.body);
      if (!updated) throw { statusCode: 404, message: '找不到班表記錄' };
      return updated;
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        tags: ['schedule'],
        summary: '刪除班表記錄',
        params: idParamSchema,
        response: {
          200: { type: 'object', properties: { success: { type: 'boolean' } } },
          ...notFoundSchema,
        },
      },
    },
    async (request) => {
      const ok = schedRepo.delete(request.params.id);
      if (!ok) throw { statusCode: 404, message: '找不到班表記錄' };
      return { success: true };
    },
  );

  // ============================================================
  // Holidays（國定假日）
  // ============================================================
  const holRepo = repositories.holidays;

  fastify.get('/holidays', {
    schema: {
      tags: ['schedule'],
      summary: '列出所有國定假日',
      response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
    },
  }, async () => holRepo.findBy('1=1', [], 'date'));

  fastify.get<{ Params: { year: string } }>(
    '/holidays/year/:year',
    {
      schema: {
        tags: ['schedule'],
        summary: '依年份列出國定假日',
        params: {
          type: 'object',
          properties: { year: { type: 'string', pattern: '^[0-9]{4}$' } },
          required: ['year'],
        },
      },
    },
    async (request) =>
      holRepo.findBy('date LIKE ?', [`${request.params.year}-%`], 'date'),
  );

  fastify.get<{ Params: { date: string } }>(
    '/holidays/date/:date',
    {
      schema: {
        tags: ['schedule'],
        summary: '依日期查國定假日',
        params: idParamSchema,
        response: { 200: { type: 'object', additionalProperties: true }, ...notFoundSchema },
      },
    },
    async (request) => {
      const r = holRepo.findOneBy('date = ?', [request.params.date]);
      if (!r) throw { statusCode: 404, message: '找不到假日' };
      return r;
    },
  );

  fastify.post<{ Body: { date: string; name: string } }>(
    '/holidays',
    {
      schema: {
        tags: ['schedule'],
        summary: '新增國定假日',
        body: {
          type: 'object',
          required: ['date', 'name'],
          properties: {
            date: { type: 'string' },
            name: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request) => holRepo.create(request.body as Record<string, unknown>),
  );

  fastify.put<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/holidays/:id',
    {
      schema: {
        tags: ['schedule'],
        summary: '更新國定假日',
        params: idParamSchema,
        body: { type: 'object', additionalProperties: true },
        response: { 200: { type: 'object', additionalProperties: true }, ...notFoundSchema },
      },
    },
    async (request) => {
      const updated = holRepo.update(request.params.id, request.body);
      if (!updated) throw { statusCode: 404, message: '找不到假日' };
      return updated;
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    '/holidays/:id',
    {
      schema: {
        tags: ['schedule'],
        summary: '刪除國定假日',
        params: idParamSchema,
        response: {
          200: { type: 'object', properties: { success: { type: 'boolean' } } },
          ...notFoundSchema,
        },
      },
    },
    async (request) => {
      const ok = holRepo.delete(request.params.id);
      if (!ok) throw { statusCode: 404, message: '找不到假日' };
      return { success: true };
    },
  );
}
