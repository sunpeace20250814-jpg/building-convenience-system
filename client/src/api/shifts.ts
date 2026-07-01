/**
 * Shifts API — 班別資料
 *
 * ★ Go-style 設計：
 *   - 前端只呼叫這些函式，不直接 queryAll SQL
 *   - 後端實作：server/src/routes/shifts.ts（/api/shifts）
 *   - 對應資料表：shifts
 *
 * 欄位（schema.ts shifts）：
 *   id, name, color, orderIndex, notes
 *
 * 路由：
 *   GET    /api/shifts            列出所有
 *   GET    /api/shifts/:id        單筆
 *   POST   /api/shifts            新增
 *   PUT    /api/shifts/:id        更新
 *   DELETE /api/shifts/:id        刪除
 */

import { apiClient } from '@/lib/apiClient';

const BASE = '/api/shifts';

export interface ShiftDTO {
  id: string;
  name: string;
  color: string;
  orderIndex?: number;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateShiftInput {
  name: string;
  color: string;
  orderIndex?: number;
  notes?: string | null;
}

export type UpdateShiftInput = Partial<CreateShiftInput>;

export const shiftsApi = {
  list: () => apiClient.get<ShiftDTO[]>(BASE),
  get: (id: string) =>
    apiClient.get<ShiftDTO>(`${BASE}/${encodeURIComponent(id)}`),
  create: (data: CreateShiftInput) =>
    apiClient.post<ShiftDTO>(BASE, data),
  update: (id: string, data: UpdateShiftInput) =>
    apiClient.put<ShiftDTO>(
      `${BASE}/${encodeURIComponent(id)}`,
      data,
    ),
  remove: (id: string) =>
    apiClient.delete<{ success: boolean }>(
      `${BASE}/${encodeURIComponent(id)}`,
    ),
};
