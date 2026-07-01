/**
 * 首頁公告 Routes
 *
 * 路徑前綴：/api/home-records
 *
 * AI 友善說明：
 * - 對應資料表：home_records
 * - 對應 client/src/storage/database.ts 的 homeRecords Repository
 * - 注意：home_tabs 標籤走 /api/home-tabs（既有 route）
 *
 * 欄位（schema.ts home_records）：
 *   id, title, content, imagePath, imageFilename, imageBase64,
 *   tabId, pinned, createdAt, updatedAt
 *
 * 端點：
 *   GET    /                  列出所有公告（含 tab_name join）
 *   GET    /tab/:tabId        依 tab 列出
 *   GET    /:id               單筆（含 tab_name join）
 *   POST   /                  新增
 *   PUT    /:id               更新
 *   DELETE /:id               刪除
 */

import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { repositories, snakeRowToCamel } from '../db/repository.js';
import { idParamSchema, notFoundSchema } from './_crud.js';

export default async function homeRecordsRoutes(fastify: FastifyInstance) {
  const repo = repositories.home_records;

  // GET / — 列表（含 tab_name join）
  fastify.get('/', {
    schema: {
      tags: ['home-records'],
      summary: '列出所有公告（含 tab_name join）',
      response: {
        200: { type: 'array', items: { type: 'object', additionalProperties: true } },
      },
    },
  }, async () =>
    db
      .prepare(
        `SELECT hr.*, ht.name as tab_name
         FROM home_records hr
         LEFT JOIN home_tabs ht ON hr.tab_id = ht.id
         ORDER BY hr.pinned DESC, hr.created_at DESC`,
      )
      .all()
      .map(snakeRowToCamel),
  );

  // GET /tab/:tabId
  fastify.get<{ Params: { tabId: string } }>(
    '/tab/:tabId',
    {
      schema: {
        tags: ['home-records'],
        summary: '依 tab 列出公告',
        params: {
          type: 'object',
          properties: { tabId: { type: 'string', minLength: 1 } },
          required: ['tabId'],
        },
      },
    },
    async (request) =>
      db
        .prepare(
          `SELECT hr.*, ht.name as tab_name
           FROM home_records hr
           LEFT JOIN home_tabs ht ON hr.tab_id = ht.id
           WHERE hr.tab_id = ?
           ORDER BY hr.pinned DESC, hr.created_at DESC`,
        )
        .all(request.params.tabId)
        .map(snakeRowToCamel),
  );

  // GET /:id
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        tags: ['home-records'],
        summary: '取得單筆公告（含 tab_name）',
        params: idParamSchema,
        response: { 200: { type: 'object', additionalProperties: true }, ...notFoundSchema },
      },
    },
    async (request) => {
      const row = db
        .prepare(
          `SELECT hr.*, ht.name as tab_name
           FROM home_records hr
           LEFT JOIN home_tabs ht ON hr.tab_id = ht.id
           WHERE hr.id = ?`,
        )
        .get(request.params.id);
      if (!row) throw { statusCode: 404, message: '找不到公告' };
      return snakeRowToCamel(row);
    },
  );

  // POST /
  fastify.post<{ Body: Record<string, unknown> }>(
    '/',
    {
      schema: {
        tags: ['home-records'],
        summary: '新增公告',
        body: {
          type: 'object',
          required: ['title'],
          properties: {
            title: { type: 'string', minLength: 1 },
            content: { type: 'string' },
            imagePath: { type: 'string' },
            imageFilename: { type: 'string' },
            imageBase64: { type: 'string' },
            tabId: { type: 'string' },
            pinned: { type: 'integer', enum: [0, 1] },
          },
        },
      },
    },
    async (request) => {
      const created = repo.create(request.body);
      // M-09 修復：POST response 含 tabName（一致於 GET）
      if (created && created.tabId) {
        const tab = repositories.home_tabs.getById(created.tabId);
        (created as any).tabName = tab?.name ?? null;
      } else if (created) {
        (created as any).tabName = null;
      }
      return created;
    },
  );

  // PUT /:id
  fastify.put<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/:id',
    {
      schema: {
        tags: ['home-records'],
        summary: '更新公告',
        params: idParamSchema,
        body: { type: 'object', additionalProperties: true },
        response: { 200: { type: 'object', additionalProperties: true }, ...notFoundSchema },
      },
    },
    async (request) => {
      const updated = repo.update(request.params.id, request.body);
      if (!updated) throw { statusCode: 404, message: '找不到公告' };
      return updated;
    },
  );

  // DELETE /:id
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        tags: ['home-records'],
        summary: '刪除公告',
        params: idParamSchema,
        response: {
          200: { type: 'object', properties: { success: { type: 'boolean' } } },
          ...notFoundSchema,
        },
      },
    },
    async (request) => {
      const ok = repo.delete(request.params.id);
      if (!ok) throw { statusCode: 404, message: '找不到公告' };
      return { success: true };
    },
  );
}
