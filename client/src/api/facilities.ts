/**
 * Facilities API — 公設（facilities）
 *
 * ★ Go-style 設計：
 *   - 前端只呼叫這些函式，不直接 queryAll SQL
 *   - 後端實作：server/src/routes/facilities.ts（/api/facilities）
 *   - 對應資料表：facilities
 *
 * 欄位（schema facilities）：
 *   id, buildingId, name, fee, unit, location, status, notes,
 *   createdAt, updatedAt
 *
 * 路由（/api/facilities）：
 *   GET    /                    列出（依 building_id, name）
 *   GET    /building/:buildingId 依建築
 *   GET    /:id                 單筆
 *   POST   /                    新增
 *   PUT    /:id                 更新
 *   DELETE /:id                 刪除
 */

import { apiClient } from '@/lib/apiClient';

const BASE = '/api/facilities';

export interface FacilityDTO {
  id: string;
  buildingId: string;
  name: string;
  fee?: number;
  unit?: string;
  location?: string | null;
  status?: string;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateFacilityInput {
  id?: string;
  buildingId: string;
  name: string;
  fee?: number;
  unit?: string;
  location?: string | null;
  status?: string;
  notes?: string | null;
}

export type UpdateFacilityInput = Partial<CreateFacilityInput>;

export const facilitiesApi = {
  list: () => apiClient.get<FacilityDTO[]>(BASE),
  listByBuilding: (buildingId: string) =>
    apiClient.get<FacilityDTO[]>(`${BASE}/building/${encodeURIComponent(buildingId)}`),
  get: (id: string) =>
    apiClient.get<FacilityDTO>(`${BASE}/${encodeURIComponent(id)}`),
  create: (data: CreateFacilityInput) =>
    apiClient.post<FacilityDTO>(BASE, data),
  update: (id: string, data: UpdateFacilityInput) =>
    apiClient.put<FacilityDTO>(`${BASE}/${encodeURIComponent(id)}`, data),
  remove: (id: string) =>
    apiClient.delete<{ success: boolean }>(`${BASE}/${encodeURIComponent(id)}`),
};