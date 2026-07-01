/**
 * Parking Statuses API — V1 細分版停車位狀態（parking_statuses）
 *
 * ★ Go-style 設計：
 *   - 前端只呼叫這些函式，不直接 queryAll SQL
 *   - 後端實作：server/src/routes/parking-statuses.ts（/api/parking-statuses）
 *   - 對應資料表：parking_statuses
 *   - 與 status_options（V4 簡化版）並存，向後相容 V1 客戶端
 *
 * 欄位（schema parking_statuses）：
 *   id, label, color, sortOrder
 *
 * 路由（/api/parking-statuses）：
 *   GET    /      列出（依 sort_order）
 *   GET    /:id   單筆
 *   POST   /      新增
 *   PUT    /:id   更新
 *   DELETE /:id   刪除
 */

import { apiClient } from '@/lib/apiClient';

const BASE = '/api/parking-statuses';

export interface ParkingStatusDTO {
  id: string;
  label: string;
  color: string;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateParkingStatusInput {
  id?: string;
  label: string;
  color: string;
  sortOrder?: number;
}

export type UpdateParkingStatusInput = Partial<CreateParkingStatusInput>;

export const parkingStatusesApi = {
  list: () => apiClient.get<ParkingStatusDTO[]>(BASE),
  get: (id: string) =>
    apiClient.get<ParkingStatusDTO>(`${BASE}/${encodeURIComponent(id)}`),
  create: (data: CreateParkingStatusInput) =>
    apiClient.post<ParkingStatusDTO>(BASE, data),
  update: (id: string, data: UpdateParkingStatusInput) =>
    apiClient.put<ParkingStatusDTO>(`${BASE}/${encodeURIComponent(id)}`, data),
  remove: (id: string) =>
    apiClient.delete<{ success: boolean }>(`${BASE}/${encodeURIComponent(id)}`),
};