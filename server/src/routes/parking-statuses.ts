/**
 * 停車位狀態 Routes（V1 細分版）
 *
 * 路徑前綴：/api/parking-statuses
 *
 * AI 友善說明：
 * - 對應資料表：parking_statuses
 * - 與 status_options（V4 簡化版）並存，向後相容 V1 客戶端
 * - 對應 client/src/storage/database.ts 的 parkingStatuses Repository
 *
 * 欄位（schema.ts parking_statuses）：
 *   id, label, color, sortOrder
 *
 * 端點：
 *   GET    /         列出所有停車位狀態
 *   GET    /:id      單筆
 *   POST   /         新增
 *   PUT    /:id      更新
 *   DELETE /:id      刪除
 */

import type { FastifyInstance } from 'fastify';
import { repositories } from '../db/repository.js';
import { createCrudRoutes } from './_crud.js';

export default async function parkingStatusesRoutes(fastify: FastifyInstance) {
  await createCrudRoutes(fastify, {
    tag: 'parking-statuses',
    resourceLabel: '停車位狀態',
    repository: repositories.parking_statuses,
    orderBy: 'sort_order',
  });
}
