/**
 * Floors API — 樓層（floors）
 *
 * ★ Go-style 設計：
 *   - 前端只呼叫這些函式，不直接 queryAll SQL
 *   - 後端實作：server/src/routes/floors.ts（/api/floors）
 *   - 對應資料表：floors
 *
 * 欄位（schema floors）：
 *   id, buildingId, floorLabel, floorIndex, floorArea, unitArea, unitCount,
 *   isBasement, isRooftop, notes, createdAt
 *
 * 路由（/api/floors）：
 *   GET    /                    列出（依 building_id, floor_index）
 *   GET    /building/:buildingId 依建築
 *   GET    /:id                 單筆
 *   POST   /                    新增
 *   PUT    /:id                 更新
 *   DELETE /:id                 刪除
 */

import { apiClient } from '@/lib/apiClient';

const BASE = '/api/floors';

export interface FloorDTO {
  id: string;
  buildingId: string;
  floorLabel: string;
  floorIndex: number;
  floorArea?: number | null;
  unitArea?: number | null;
  unitCount?: number | null;
  isBasement?: number; // 0 | 1
  isRooftop?: number; // 0 | 1
  notes?: string | null;
  createdAt?: string;
}

export interface CreateFloorInput {
  id?: string;
  buildingId: string;
  floorLabel: string;
  floorIndex: number;
  floorArea?: number | null;
  unitArea?: number | null;
  unitCount?: number | null;
  isBasement?: number;
  isRooftop?: number;
  notes?: string | null;
}

export type UpdateFloorInput = Partial<CreateFloorInput>;

export const floorsApi = {
  list: () => apiClient.get<FloorDTO[]>(BASE),
  listByBuilding: (buildingId: string) =>
    apiClient.get<FloorDTO[]>(`${BASE}/building/${encodeURIComponent(buildingId)}`),
  get: (id: string) =>
    apiClient.get<FloorDTO>(`${BASE}/${encodeURIComponent(id)}`),
  create: (data: CreateFloorInput) =>
    apiClient.post<FloorDTO>(BASE, data),
  update: (id: string, data: UpdateFloorInput) =>
    apiClient.put<FloorDTO>(`${BASE}/${encodeURIComponent(id)}`, data),
  remove: (id: string) =>
    apiClient.delete<{ success: boolean }>(`${BASE}/${encodeURIComponent(id)}`),
};