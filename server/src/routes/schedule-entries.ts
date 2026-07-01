/**
 * 班表排程 Routes（V4 完整欄位版）
 *
 * 路徑前綴：/api/schedule-entries
 *
 * AI 友善說明：
 * - 對應資料表：schedule_entries
 * - 與既有 /api/schedule（聚合 employees + shifts + schedule_entries + holidays）並存
 *   本檔只負責 schedule_entries 這張表自己的 CRUD + 子查詢
 * - 對應 client/src/storage/database.ts 的 scheduleEntries Repository
 *
 * 欄位（schema.ts schedule_entries）：
 *   id, date, shiftId (NOT NULL), assigneeId, notes, createdAt, updatedAt
 *
 *   ⚠️ assigneeId 是邏輯上的 FK，指向 employees.id
 *      目前 schema 沒有用 SQLite FOREIGN KEY 約束（沒寫 REFERENCES）
 *      但應用層必須自行驗證員工存在；建立 / 更新前若傳入 assigneeId 請確認員工存在
 *      （可呼叫 repositories.employees.getById(assigneeId) 預檢）
 *
 * 端點：
 *   GET    /                        列出所有排程
 *   GET    /:id                     單筆
 *   GET    /date/:date              依日期列出
 *   GET    /range?start=&end=       依日期區間列出
 *   GET    /assignee/:assigneeId    依員工列出
 *   POST   /                        新增（必填 date + shiftId；可選 assigneeId / notes）
 *   PUT    /:id                     更新
 *   DELETE /:id                     刪除
 */

import type { FastifyInstance } from 'fastify';
import { repositories } from '../db/repository.js';
import { createCrudRoutes, idParamSchema, notFoundSchema } from './_crud.js';

export default async function scheduleEntriesRoutes(fastify: FastifyInstance) {
  // 標準 CRUD
  await createCrudRoutes(fastify, {
    tag: 'schedule-entries',
    resourceLabel: '班表排程',
    repository: repositories.schedule_entries,
    orderBy: 'date DESC, created_at DESC',
    createBodySchema: {
      type: 'object',
      required: ['date', 'shiftId'],
      properties: {
        date: { type: 'string', minLength: 1 },
        shiftId: { type: 'string', minLength: 1 },
        assigneeId: { type: 'string' },
        notes: { type: 'string' },
      },
    },
    updateBodySchema: {
      type: 'object',
      properties: {
        date: { type: 'string', minLength: 1 },
        shiftId: { type: 'string', minLength: 1 },
        assigneeId: { type: 'string' },
        notes: { type: 'string' },
      },
    },
  });

  // GET /api/schedule-entries/date/:date — 依日期列出
  fastify.get<{ Params: { date: string } }>(
    '/date/:date',
    {
      schema: {
        tags: ['schedule-entries'],
        summary: '依日期列出班表排程',
        params: idParamSchema,
        response: {
          200: { type: 'array', items: { type: 'object', additionalProperties: true } },
          ...notFoundSchema,
        },
      },
    },
    async (request) =>
      repositories.schedule_entries.findBy(
        'date = ?',
        [request.params.date],
        'created_at',
      ),
  );

  // GET /api/schedule-entries/range?start=&end= — 依日期區間列出
  fastify.get<{ Querystring: { start?: string; end?: string } }>(
    '/range',
    {
      schema: {
        tags: ['schedule-entries'],
        summary: '依日期區間列出班表排程',
        querystring: {
          type: 'object',
          properties: {
            start: { type: 'string' },
            end: { type: 'string' },
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
      return repositories.schedule_entries.findBy(
        'date BETWEEN ? AND ?',
        [start, end],
        'date, created_at',
      );
    },
  );

  // GET /api/schedule-entries/assignee/:assigneeId — 依員工列出
  fastify.get<{ Params: { assigneeId: string } }>(
    '/assignee/:assigneeId',
    {
      schema: {
        tags: ['schedule-entries'],
        summary: '依員工列出班表排程（assigneeId = 員工 id）',
        params: {
          type: 'object',
          properties: { assigneeId: { type: 'string', minLength: 1 } },
          required: ['assigneeId'],
        },
        response: {
          200: { type: 'array', items: { type: 'object', additionalProperties: true } },
        },
      },
    },
    async (request) =>
      repositories.schedule_entries.findBy(
        'assignee_id = ?',
        [request.params.assigneeId],
        'date DESC, created_at DESC',
      ),
  );
}
