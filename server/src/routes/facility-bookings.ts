/**
 * 公設借用 Routes
 *
 * 路徑前綴：/api/facility-bookings
 *
 * AI 友善說明：
 * - 對應資料表：facility_bookings
 * - 對應 client/src/storage/schema.ts 的 facility_bookings Repository
 * - 公設借用紀錄（日期 / 住戶 / 公設 / 時間 / 費用 / 是否付款）
 *
 * 欄位（schema.ts facility_bookings）：
 *   id, date, residentId, residentName, facilityId, facilityName,
 *   startTime, endTime, paid, fee, notes, createdAt, updatedAt
 *
 * 端點：
 *   GET    /                          列出所有借用紀錄
 *   GET    /date/:date                依日期取（YYYY-MM-DD）
 *   GET    /range?start=&end=         依日期區間取
 *   GET    /resident/:residentId      依住戶取
 *   GET    /facility/:facilityId      依公設取
 *   GET    /:id                       單筆
 *   POST   /                          新增
 *   PUT    /:id                       更新
 *   DELETE /:id                       刪除
 *
 * FK 約束：
 *   - resident_id → residents(id) ON DELETE SET NULL
 *   - facility_id → facilities(id) ON DELETE CASCADE
 */

import type { FastifyInstance } from 'fastify';
import { repositories } from '../db/repository.js';
import { idParamSchema, notFoundSchema } from './_crud.js';

export default async function facilityBookingsRoutes(fastify: FastifyInstance) {
  const repo = repositories.facility_bookings;

  // GET / — 列表（依日期倒序）
  fastify.get('/', {
    schema: {
      tags: ['facility-bookings'],
      summary: '列出所有公設借用紀錄',
      response: {
        200: { type: 'array', items: { type: 'object', additionalProperties: true } },
      },
    },
  }, async () => repo.findBy('1=1', [], 'date DESC, start_time'));

  // GET /date/:date — 依日期取
  fastify.get<{ Params: { date: string } }>(
    '/date/:date',
    {
      schema: {
        tags: ['facility-bookings'],
        summary: '依日期列出公設借用紀錄（YYYY-MM-DD）',
        params: {
          type: 'object',
          properties: { date: { type: 'string', minLength: 1 } },
          required: ['date'],
        },
      },
    },
    async (request) =>
      repo.findBy('date = ?', [request.params.date], 'start_time'),
  );

  // GET /range?start=&end= — 依日期區間取
  fastify.get<{ Querystring: { start: string; end: string } }>(
    '/range',
    {
      schema: {
        tags: ['facility-bookings'],
        summary: '依日期區間列出公設借用紀錄',
        querystring: {
          type: 'object',
          properties: {
            start: { type: 'string', minLength: 1 },
            end: { type: 'string', minLength: 1 },
          },
          required: ['start', 'end'],
        },
      },
    },
    async (request) =>
      repo.findBy(
        'date BETWEEN ? AND ?',
        [request.query.start, request.query.end],
        'date, start_time',
      ),
  );

  // GET /resident/:residentId — 依住戶取
  fastify.get<{ Params: { residentId: string } }>(
    '/resident/:residentId',
    {
      schema: {
        tags: ['facility-bookings'],
        summary: '依住戶 ID 列出公設借用紀錄',
        params: {
          type: 'object',
          properties: { residentId: { type: 'string', minLength: 1 } },
          required: ['residentId'],
        },
      },
    },
    async (request) =>
      repo.findBy('resident_id = ?', [request.params.residentId], 'date DESC, start_time'),
  );

  // GET /facility/:facilityId — 依公設取
  fastify.get<{ Params: { facilityId: string } }>(
    '/facility/:facilityId',
    {
      schema: {
        tags: ['facility-bookings'],
        summary: '依公設 ID 列出借用紀錄',
        params: {
          type: 'object',
          properties: { facilityId: { type: 'string', minLength: 1 } },
          required: ['facilityId'],
        },
      },
    },
    async (request) =>
      repo.findBy('facility_id = ?', [request.params.facilityId], 'date DESC, start_time'),
  );

  // GET /:id — 單筆
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        tags: ['facility-bookings'],
        summary: '取得單筆公設借用紀錄',
        params: idParamSchema,
        response: {
          200: { type: 'object', additionalProperties: true },
          ...notFoundSchema,
        },
      },
    },
    async (request) => {
      const item = repo.getById(request.params.id);
      if (!item) throw { statusCode: 404, message: '找不到公設借用紀錄' };
      return item;
    },
  );

  // POST / — 新增
  fastify.post(
    '/',
    {
      schema: {
        tags: ['facility-bookings'],
        summary: '新增公設借用紀錄',
        body: {
          type: 'object',
          required: ['date', 'facilityId', 'startTime', 'endTime'],
          properties: {
            date: { type: 'string', minLength: 1 },
            residentId: { type: 'string' },
            residentName: { type: 'string' },
            facilityId: { type: 'string', minLength: 1 },
            facilityName: { type: 'string' },
            startTime: { type: 'string', minLength: 1 },
            endTime: { type: 'string', minLength: 1 },
            paid: { type: 'integer', enum: [0, 1] },
            fee: { type: 'number', minimum: 0 },
            notes: { type: 'string' },
          },
          additionalProperties: true,
        },
        response: { 201: { type: 'object', additionalProperties: true } },
      },
    },
    async (request) => repo.create(request.body as Record<string, unknown>),
  );

  // PUT /:id — 更新
  fastify.put<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/:id',
    {
      schema: {
        tags: ['facility-bookings'],
        summary: '更新公設借用紀錄',
        params: idParamSchema,
        body: { type: 'object', additionalProperties: true },
        response: {
          200: { type: 'object', additionalProperties: true },
          ...notFoundSchema,
        },
      },
    },
    async (request) => {
      const updated = repo.update(request.params.id, request.body);
      if (!updated) throw { statusCode: 404, message: '找不到公設借用紀錄' };
      return updated;
    },
  );

  // DELETE /:id — 刪除
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        tags: ['facility-bookings'],
        summary: '刪除公設借用紀錄',
        params: idParamSchema,
        response: {
          200: { type: 'object', properties: { success: { type: 'boolean' } } },
          ...notFoundSchema,
        },
      },
    },
    async (request) => {
      const ok = repo.delete(request.params.id);
      if (!ok) throw { statusCode: 404, message: '找不到公設借用紀錄' };
      return { success: true };
    },
  );
}