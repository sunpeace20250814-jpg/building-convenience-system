/**
 * 班表備註 Routes
 *
 * 路徑前綴：/api/schedule-notes
 *
 * AI 友善說明：
 * - 對應資料表：schedule_notes
 * - schedule_notes 是「當日全域備註」，每個 date 只有一筆（schema UNIQUE 約束）
 * - 對應 client/src/storage/database.ts 的 scheduleNotes Repository
 *
 * 欄位（schema.ts schedule_notes）：
 *   id, date (UNIQUE), content, updatedAt
 *
 *   ⚠️ 客戶端 API 契約可能帶 type / color / isDone 等延伸欄位
 *      目前 server schema 尚未包含這三欄（會被 Repository.create 靜默忽略）
 *      建立 / 更新時可一併送來，未來 schema 補欄後即可生效（向後相容）
 *
 * 端點：
 *   GET    /              列出所有班表備註
 *   GET    /date/:date    依日期查單筆（date UNIQUE）
 *   GET    /:id           單筆
 *   POST   /              新增（必填 date + content）
 *   PUT    /:id           更新
 *   DELETE /:id           刪除
 */

import type { FastifyInstance } from 'fastify';
import { repositories } from '../db/repository.js';
import { createCrudRoutes, idParamSchema } from './_crud.js';

export default async function scheduleNotesRoutes(fastify: FastifyInstance) {
  // 標準 CRUD
  await createCrudRoutes(fastify, {
    tag: 'schedule-notes',
    resourceLabel: '班表備註',
    repository: repositories.schedule_notes,
    orderBy: 'date DESC',
    createBodySchema: {
      type: 'object',
      required: ['date', 'content'],
      properties: {
        date: { type: 'string', minLength: 1 },
        content: { type: 'string', minLength: 1 },
        // 以下欄位為客戶端契約延伸；目前 schema 不存在，會被 Repository.create 忽略
        type: { type: 'string' },
        color: { type: 'string' },
        isDone: { type: 'boolean' },
      },
    },
    updateBodySchema: {
      type: 'object',
      properties: {
        date: { type: 'string', minLength: 1 },
        content: { type: 'string' },
        type: { type: 'string' },
        color: { type: 'string' },
        isDone: { type: 'boolean' },
      },
    },
  });

  // GET /api/schedule-notes/date/:date — 依日期查單筆（date UNIQUE）
  fastify.get<{ Params: { date: string } }>(
    '/date/:date',
    {
      schema: {
        tags: ['schedule-notes'],
        summary: '依日期查班表備註（每個 date 只有一筆）',
        params: idParamSchema,
        response: {
          200: { type: 'object', additionalProperties: true },
          404: {
            type: 'object',
            properties: { statusCode: { type: 'integer' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request) => {
      const item = repositories.schedule_notes.findOneBy(
        'date = ?',
        [request.params.date],
      );
      if (!item) {
        throw { statusCode: 404, message: '找不到班表備註' };
      }
      return item;
    },
  );
}
