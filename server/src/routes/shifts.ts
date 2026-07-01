/**
 * 班別 Routes
 *
 * 路徑前綴：/api/shifts
 *
 * AI 友善說明：
 * - 對應資料表：shifts
 * - 對應 client/src/storage/database.ts 的 shifts Repository
 *
 * 欄位（schema.ts shifts）：
 *   id, name, color, orderIndex, notes
 *
 * 端點：
 *   GET    /         列出所有班別
 *   GET    /:id      單筆
 *   POST   /         新增
 *   PUT    /:id      更新
 *   DELETE /:id      刪除
 */

import type { FastifyInstance } from 'fastify';
import { repositories } from '../db/repository.js';
import { createCrudRoutes } from './_crud.js';

export default async function shiftsRoutes(fastify: FastifyInstance) {
  await createCrudRoutes(fastify, {
    tag: 'shifts',
    resourceLabel: '班別',
    repository: repositories.shifts,
    orderBy: 'order_index',
  });
}
