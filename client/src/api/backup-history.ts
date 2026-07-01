/**
 * Backup History API — 備份歷史（backup_history）
 *
 * ★ Go-style 設計：
 *   - 前端只呼叫這些函式，不直接 queryAll SQL
 *   - 後端實作：server/src/routes/backup-history.ts（/api/backup-history）
 *   - 對應資料表：backup_history
 *
 * 欄位（schema backup_history）：
 *   id, filename, format, size, createdAt, note
 *
 * 路由（/api/backup-history）：
 *   GET    /      列出（依 created_at DESC）
 *   GET    /:id   單筆
 *   POST   /      新增
 *   PUT    /:id   更新
 *   DELETE /:id   刪除
 *
 * 注意：
 * - 真正備份（createBackup/restoreFromFile）仍走 client-side @/storage/backupManager
 *   因為需要瀏覽器 FileSystem Access API 操作本機 OPFS
 * - 本 API 僅負責「備份歷史紀錄」的伺服器端鏡像（多裝置同步用）
 */

import { apiClient } from '@/lib/apiClient';

const BASE = '/api/backup-history';

export interface BackupHistoryDTO {
  id: string;
  filename: string;
  format: string;
  size: number;
  createdAt: string;
  note?: string | null;
}

export interface CreateBackupHistoryInput {
  id?: string;
  filename: string;
  format: string;
  size: number;
  createdAt?: string;
  note?: string | null;
}

export type UpdateBackupHistoryInput = Partial<CreateBackupHistoryInput>;

export const backupHistoryApi = {
  list: () => apiClient.get<BackupHistoryDTO[]>(BASE),
  get: (id: string) =>
    apiClient.get<BackupHistoryDTO>(`${BASE}/${encodeURIComponent(id)}`),
  create: (data: CreateBackupHistoryInput) =>
    apiClient.post<BackupHistoryDTO>(BASE, data),
  update: (id: string, data: UpdateBackupHistoryInput) =>
    apiClient.put<BackupHistoryDTO>(`${BASE}/${encodeURIComponent(id)}`, data),
  remove: (id: string) =>
    apiClient.delete<{ success: boolean }>(`${BASE}/${encodeURIComponent(id)}`),
};