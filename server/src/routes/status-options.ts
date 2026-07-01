/**
 * 狀態選項 Routes
 *
 * 路徑前綴：/api/status-options
 *
 * AI 友善說明：
 * - 對應資料表：status_options
 * - 從 settings.ts 拆出來的獨立 CRUD（V4 模組化）
 * - 對應 client 的 statusOptions Repository
 *
 * 欄位（schema.ts status_options）：
 *   id, type, label, color, sortOrder
 *   type: 'resident' | 'parking'
 *
 * 端點：
 *   GET    /                    列出所有狀態選項
 *   GET    /type/:type          依類型（resident/parking）取狀態
 *   GET    /:id                 單筆
 *   POST   /                    新增
 *   PUT    /:id                 更新
 *   DELETE /:id                 刪除
 */

import type { FastifyInstance } from 'fastify';
import { repositories } from '../db/repository.js';
import { createCrudRoutes } from './_crud.js';

export default async function statusOptionsRoutes(fastify: FastifyInstance) {
  await createCrudRoutes(fastify, {
    tag: 'status-options',
    resourceLabel: '狀態選項',
    repository: repositories.status_options,
    orderBy: 'type, sort_order',
    // M-22 修復：限制 type enum（防止任意字串污染）
    createBodySchema: {
      type: 'object',
      required: ['type', 'label', 'color'],
      properties: {
        type: { type: 'string', enum: ['resident', 'parking'] },
        label: { type: 'string', minLength: 1, maxLength: 100 },
        color: { type: 'string', maxLength: 50 },
        sortOrder: { type: 'integer', minimum: 0 },
      },
    },
    updateBodySchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['resident', 'parking'] },
        label: { type: 'string', minLength: 1, maxLength: 100 },
        color: { type: 'string', maxLength: 50 },
        sortOrder: { type: 'integer', minimum: 0 },
      },
    },
  });

  // GET /api/status-options/type/:type — 依類型取狀態
  fastify.get<{ Params: { type: string } }>(
    '/type/:type',
    {
      schema: {
        tags: ['status-options'],
        summary: '依類型列出狀態選項',
        params: {
          type: 'object',
          properties: { type: { type: 'string', enum: ['resident', 'parking'] } },
          required: ['type'],
        },
        response: {
          200: { type: 'array', items: { type: 'object', additionalProperties: true } },
        },
      },
    },
    async (request) =>
      repositories.status_options.findBy(
        'type = ?',
        [request.params.type],
        'sort_order',
      ),
  );
}