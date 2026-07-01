/**
 * 假期類型 Routes
 *
 * 路徑前綴：/api/holiday-categories
 *
 * AI 友善說明：
 * - 對應資料表：holiday_categories
 * - 對應 client/src/storage/database.ts 的 holidayCategories Repository
 * - 對應 client/src/api/holiday-categories.ts 的 holidayCategoriesApi
 *
 * 欄位（schema.ts holiday_categories）：
 *   id, name, color, sortOrder, notes, createdAt, updatedAt
 *
 * 端點：
 *   GET    /         列出所有假期類型（依 sort_order, name 排序）
 *   GET    /:id      單筆
 *   POST   /         新增
 *   PUT    /:id      更新
 *   DELETE /:id      刪除（連帶 holidays.categoryId 設為 NULL，FK ON DELETE SET NULL）
 */

import type { FastifyInstance } from 'fastify';
import { repositories } from '../db/repository.js';
import { createCrudRoutes } from './_crud.js';

export default async function holidayCategoriesRoutes(fastify: FastifyInstance) {
  await createCrudRoutes(fastify, {
    tag: 'holiday-categories',
    resourceLabel: '假期類型',
    repository: repositories.holiday_categories,
    orderBy: 'sort_order, name',
  });
}
