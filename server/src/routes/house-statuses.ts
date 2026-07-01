/**
 * 住屋狀態 Routes（V1 細分版）
 *
 * 路徑前綴：/api/house-statuses
 *
 * AI 友善說明：
 * - 對應資料表：house_statuses
 * - 與 status_options（V4 簡化版）並存，向後相容 V1 客戶端
 * - 對應 client/src/storage/database.ts 的 houseStatuses Repository
 *
 * 欄位（schema.ts house_statuses）：
 *   id, label, color, sortOrder, days, isWorking
 *
 * 端點：
 *   GET    /         列出所有住屋狀態
 *   GET    /:id      單筆
 *   POST   /         新增
 *   PUT    /:id      更新
 *   DELETE /:id      刪除
 */

import type { FastifyInstance } from 'fastify';
import { repositories } from '../db/repository.js';
import { createCrudRoutes } from './_crud.js';

export default async function houseStatusesRoutes(fastify: FastifyInstance) {
  await createCrudRoutes(fastify, {
    tag: 'house-statuses',
    resourceLabel: '住屋狀態',
    repository: repositories.house_statuses,
    orderBy: 'sort_order',
  });
}
