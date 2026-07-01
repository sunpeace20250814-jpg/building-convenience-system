/**
 * Status Options API — 狀態選項（status_options）
 *
 * ★ Go-style 設計：
 *   - 前端只呼叫這些函式，不直接 queryAll SQL
 *   - 後端實作：server/src/routes/settings.ts（/api/settings/status）
 *   - 對應資料表：status_options
 *
 * 欄位（schema status_options）：
 *   id, type ('resident' | 'parking'), label, color, sortOrder
 *
 * 路由（/api/settings/status）：
 *   GET    /                列出所有（依 type, sort_order）
 *   GET    /type/:type      依類型
 *   GET    /:id             單筆
 *   POST   /                新增
 *   PUT    /:id             更新
 *   DELETE /:id             刪除
 */

import { apiClient } from '@/lib/apiClient';

const BASE = '/api/settings/status';

export interface StatusOptionDTO {
  id: string;
  type: 'resident' | 'parking';
  label: string;
  color: string;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateStatusOptionInput {
  id?: string;
  type: 'resident' | 'parking';
  label: string;
  color: string;
  sortOrder?: number;
}

export type UpdateStatusOptionInput = Partial<CreateStatusOptionInput>;

export const statusOptionsApi = {
  list: () => apiClient.get<StatusOptionDTO[]>(BASE),
  listByType: (type: 'resident' | 'parking') =>
    apiClient.get<StatusOptionDTO[]>(`${BASE}/type/${encodeURIComponent(type)}`),
  get: (id: string) =>
    apiClient.get<StatusOptionDTO>(`${BASE}/${encodeURIComponent(id)}`),
  create: (data: CreateStatusOptionInput) =>
    apiClient.post<StatusOptionDTO>(BASE, data),
  update: (id: string, data: UpdateStatusOptionInput) =>
    apiClient.put<StatusOptionDTO>(`${BASE}/${encodeURIComponent(id)}`, data),
  remove: (id: string) =>
    apiClient.delete<{ success: boolean }>(`${BASE}/${encodeURIComponent(id)}`),
};