/**
 * House Statuses API — V1 細分版住屋狀態（house_statuses）
 *
 * ★ Go-style 設計：
 *   - 前端只呼叫這些函式，不直接 queryAll SQL
 *   - 後端實作：server/src/routes/house-statuses.ts（/api/house-statuses）
 *   - 對應資料表：house_statuses
 *   - 與 status_options（V4 簡化版）並存，向後相容 V1 客戶端
 *
 * 欄位（schema house_statuses）：
 *   id, label, color, sortOrder, days, isWorking
 *
 * 路由（/api/house-statuses）：
 *   GET    /      列出（依 sort_order）
 *   GET    /:id   單筆
 *   POST   /      新增
 *   PUT    /:id   更新
 *   DELETE /:id   刪除
 */

import { apiClient } from '@/lib/apiClient';

const BASE = '/api/house-statuses';

export interface HouseStatusDTO {
  id: string;
  label: string;
  color: string;
  sortOrder?: number;
  days?: number | null;
  isWorking?: number; // 0 | 1
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateHouseStatusInput {
  id?: string;
  label: string;
  color: string;
  sortOrder?: number;
  days?: number | null;
  isWorking?: number;
}

export type UpdateHouseStatusInput = Partial<CreateHouseStatusInput>;

export const houseStatusesApi = {
  list: () => apiClient.get<HouseStatusDTO[]>(BASE),
  get: (id: string) =>
    apiClient.get<HouseStatusDTO>(`${BASE}/${encodeURIComponent(id)}`),
  create: (data: CreateHouseStatusInput) =>
    apiClient.post<HouseStatusDTO>(BASE, data),
  update: (id: string, data: UpdateHouseStatusInput) =>
    apiClient.put<HouseStatusDTO>(`${BASE}/${encodeURIComponent(id)}`, data),
  remove: (id: string) =>
    apiClient.delete<{ success: boolean }>(`${BASE}/${encodeURIComponent(id)}`),
};