/**
 * Home Tabs API — 首頁公告標籤（home-tabs）
 *
 * ★ Go-style 設計：
 *   - 前端只呼叫這些函式，不直接 queryAll SQL
 *   - 後端實作：server/src/routes/home-tabs.ts（/api/home-tabs）
 *   - 對應資料表：home_tabs
 *
 * 欄位（schema home_tabs）：
 *   id, name, sortOrder, createdAt, updatedAt
 *
 * 路由（/api/home-tabs）：
 *   GET    /                列出所有（依 sort_order）
 *   GET    /:id             單筆
 *   POST   /                新增
 *   PUT    /:id             更新
 *   DELETE /:id             刪除（FK CASCADE 連帶刪 records）
 */

import { apiClient } from '@/lib/apiClient';

const BASE = '/api/home-tabs';

export interface HomeTabDTO {
  id: string;
  name: string;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateHomeTabInput {
  name: string;
  sortOrder: number;
}

export type UpdateHomeTabInput = Partial<CreateHomeTabInput>;

export const homeTabsApi = {
  list: () => apiClient.get<HomeTabDTO[]>(BASE),
  get: (id: string) =>
    apiClient.get<HomeTabDTO>(`${BASE}/${encodeURIComponent(id)}`),
  create: (data: CreateHomeTabInput) =>
    apiClient.post<HomeTabDTO>(BASE, data),
  update: (id: string, data: UpdateHomeTabInput) =>
    apiClient.put<HomeTabDTO>(
      `${BASE}/${encodeURIComponent(id)}`,
      data,
    ),
  remove: (id: string) =>
    apiClient.delete<{ success: boolean }>(
      `${BASE}/${encodeURIComponent(id)}`,
    ),
};
