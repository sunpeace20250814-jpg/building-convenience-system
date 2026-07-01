/**
 * 行事曆事件 Routes
 *
 * 路徑前綴：/api/calendar-events
 *
 * AI 友善說明：
 * - 對應資料表：calendar_events
 * - 對應 client/src/storage/database.ts 的 calendarEvents Repository
 *
 * 欄位（schema.ts calendar_events）：
 *   id, date, title, color, notes, createdAt, updatedAt
 *
 * 端點：
 *   GET    /                     列出所有事件
 *   GET    /range?start=&end=    依日期區間列出
 *   GET    /date/:date           依日期列出
 *   GET    /:id                  單筆
 *   POST   /                     新增
 *   PUT    /:id                  更新
 *   DELETE /:id                  刪除
 */

import type { FastifyInstance } from 'fastify';
import { repositories } from '../db/repository.js';
import { createCrudRoutes, idParamSchema } from './_crud.js';

export default async function calendarEventsRoutes(fastify: FastifyInstance) {
  await createCrudRoutes(fastify, {
    tag: 'calendar-events',
    resourceLabel: '行事曆事件',
    repository: repositories.calendar_events,
    orderBy: 'date DESC',
  });

  // GET /range
  fastify.get<{ Querystring: { start: string; end: string } }>(
    '/range',
    {
      schema: {
        tags: ['calendar-events'],
        summary: '依日期區間列出事件',
        querystring: {
          type: 'object',
          required: ['start', 'end'],
          properties: {
            start: { type: 'string', description: '起始日期 YYYY-MM-DD' },
            end: { type: 'string', description: '結束日期 YYYY-MM-DD' },
          },
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
      if (!start || !end) {
        throw { statusCode: 400, message: '需要 start 和 end 參數' };
      }
      return repositories.calendar_events.findBy(
        'date BETWEEN ? AND ?',
        [start, end],
        'date',
      );
    },
  );

  // GET /date/:date
  fastify.get<{ Params: { date: string } }>(
    '/date/:date',
    {
      schema: {
        tags: ['calendar-events'],
        summary: '依日期列出所有事件',
        params: idParamSchema,
        response: {
          200: { type: 'array', items: { type: 'object', additionalProperties: true } },
        },
      },
    },
    async (request) =>
      repositories.calendar_events.findBy(
        'date = ?',
        [request.params.date],
        'created_at',
      ),
  );
}
