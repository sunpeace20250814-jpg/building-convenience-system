/**
 * Holiday Categories API — 假期類型分組
 *
 * ★ Go-style 設計：
 *   - 前端只呼叫這些函式，不直接 queryAll SQL
 *   - 後端對應表：holiday_categories
 *   - 對應 client 端：client/src/storage/schema.ts (holiday_categories)
 *
 * 欄位（schema holiday_categories）：
 *   id, name, color, sortOrder, notes, createdAt, updatedAt
 *
 * 注意：server 端的 holidays POST/PUT 也會接收 categoryId / color / notes
 * （見 server/src/routes/schedule.ts holidays 子路徑的 body schema）。
 * categories 本身目前在 server 端並無獨立 route — 透過通用 CRUD repository
 * 暴露（與 storage/database.ts 的 holidayCategories Repository 對應）。
 * 若 server 端未來補上獨立 categories route，可直接調整 BASE 路徑。
 *
 * 路由（預期對應 server route，可由本次 task 之外的 sibling 補上）：
 *   GET    /api/holiday-categories           列出所有（依 sortOrder, name）
 *   GET    /api/holiday-categories/:id       單筆
 *   POST   /api/holiday-categories           新增
 *   PUT    /api/holiday-categories/:id       更新
 *   DELETE /api/holiday-categories/:id       刪除（連帶 holidays.categoryId 設為 NULL）
 */

import { apiClient } from '@/lib/apiClient';

const BASE = '/api/holiday-categories';

export interface HolidayCategoryDTO {
  id: string;
  name: string;
  color: string;
  sortOrder?: number;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateHolidayCategoryInput {
  name: string;
  color: string;
  sortOrder?: number;
  notes?: string | null;
}

export type UpdateHolidayCategoryInput = Partial<CreateHolidayCategoryInput>;

export const holidayCategoriesApi = {
  list: () => apiClient.get<HolidayCategoryDTO[]>(BASE),
  get: (id: string) =>
    apiClient.get<HolidayCategoryDTO>(`${BASE}/${encodeURIComponent(id)}`),
  create: (data: CreateHolidayCategoryInput) =>
    apiClient.post<HolidayCategoryDTO>(BASE, data),
  update: (id: string, data: UpdateHolidayCategoryInput) =>
    apiClient.put<HolidayCategoryDTO>(
      `${BASE}/${encodeURIComponent(id)}`,
      data,
    ),
  remove: (id: string) =>
    apiClient.delete<{ success: boolean }>(
      `${BASE}/${encodeURIComponent(id)}`,
    ),
};
