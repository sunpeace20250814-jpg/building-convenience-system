/**
 * 排班假日 Routes
 *
 * 路徑前綴：/api/schedule-holidays
 *
 * AI 友善說明：
 * - 對應資料表：schedule_holidays
 * - 與 holidays（國定假日）並存，schedule_holidays 是「自訂班表假日」
 *   多了 isWorkDay（補班）欄位
 * - 對應 client/src/storage/database.ts 的 scheduleHolidays Repository
 *
 * 欄位（schema.ts schedule_holidays）：
 *   id, date (UNIQUE), name, isWorkDay, notes
 *
 * 端點：
 *   GET    /                  列出所有排班假日
 *   GET    /year/:year        依年份列出
 *   GET    /date/:date        依日期查詢單筆
 *   GET    /:id               單筆
 *   POST   /                  新增
 *   PUT    /:id               更新
 *   DELETE /:id               刪除
 */

import type { FastifyInstance } from 'fastify';
import { repositories } from '../db/repository.js';
import { createCrudRoutes, idParamSchema } from './_crud.js';

export default async function scheduleHolidaysRoutes(fastify: FastifyInstance) {
  await createCrudRoutes(fastify, {
    tag: 'schedule-holidays',
    resourceLabel: '排班假日',
    repository: repositories.schedule_holidays,
    orderBy: 'date',
  });

  // GET /api/schedule-holidays/year/:year
  fastify.get<{ Params: { year: string } }>(
    '/year/:year',
    {
      schema: {
        tags: ['schedule-holidays'],
        summary: '依年份列出排班假日',
        params: {
          type: 'object',
          properties: { year: { type: 'string', pattern: '^[0-9]{4}$' } },
          required: ['year'],
        },
      },
    },
    async (request) =>
      repositories.schedule_holidays.findBy(
        'date LIKE ?',
        [`${request.params.year}-%`],
        'date',
      ),
  );

  // GET /api/schedule-holidays/date/:date
  fastify.get<{ Params: { date: string } }>(
    '/date/:date',
    {
      schema: {
        tags: ['schedule-holidays'],
        summary: '依日期查排班假日',
        params: idParamSchema,
      },
    },
    async (request) => {
      const item = repositories.schedule_holidays.findOneBy(
        'date = ?',
        [request.params.date],
      );
      if (!item) {
        throw { statusCode: 404, message: '找不到排班假日' };
      }
      return item;
    },
  );
}
