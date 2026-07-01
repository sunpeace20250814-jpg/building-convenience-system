/**
 * 備份歷史 Routes
 *
 * 路徑前綴：/api/backup-history
 *
 * AI 友善說明：
 * - 對應資料表：backup_history
 * - 對應 client/src/storage/database.ts 的 backupHistory Repository
 *
 * 欄位（schema.ts backup_history）：
 *   id, filename, format, size, createdAt, note
 *
 * 端點：
 *   GET    /         列出所有備份紀錄
 *   GET    /:id      單筆
 *   POST   /         新增
 *   PUT    /:id      更新
 *   DELETE /:id      刪除
 */

import type { FastifyInstance } from 'fastify';
import { repositories } from '../db/repository.js';
import { createCrudRoutes } from './_crud.js';

export default async function backupHistoryRoutes(fastify: FastifyInstance) {
  await createCrudRoutes(fastify, {
    tag: 'backup-history',
    resourceLabel: '備份歷史',
    repository: repositories.backup_history,
    orderBy: 'created_at DESC',
  });
}
