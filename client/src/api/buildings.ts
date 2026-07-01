/**
 * Buildings API — 前後端分離的契約層
 *
 * ★ Go-style 設計：
 *   - 前端只呼叫這些函式，不直接 queryAll SQL
 *   - 後端實作在 server/src/routes/settings.ts (/api/settings/buildings)
 *   - 加新欄位 → 後端 repository → 後端 schema → 前端 BuildingDTO type 同步更新
 */

import { apiClient } from '@/lib/apiClient';

export interface BuildingDTO {
  id: string;
  name: string;
  normalFloorCount: number;
  rooftopFloorCount: number;
  basementFloorCount: number;
  unitsPerFloor: number;
  unitArea: number;
  unitNamePattern: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateBuildingInput {
  id?: string;
  name: string;
  normalFloorCount: number;
  rooftopFloorCount?: number;
  basementFloorCount?: number;
  unitsPerFloor?: number;
  unitArea?: number;
  unitNamePattern?: string;
  notes?: string;
}

export type UpdateBuildingInput = Partial<CreateBuildingInput>;

export const buildingsApi = {
  list: () => apiClient.get<BuildingDTO[]>('/api/settings/buildings'),
  get: (id: string) => apiClient.get<BuildingDTO>(`/api/settings/buildings/${encodeURIComponent(id)}`),
  create: (data: CreateBuildingInput) => apiClient.post<BuildingDTO>('/api/settings/buildings', data),
  update: (id: string, data: UpdateBuildingInput) =>
    apiClient.put<BuildingDTO>(`/api/settings/buildings/${encodeURIComponent(id)}`, data),
  remove: (id: string) => apiClient.delete<{ success: boolean }>(`/api/settings/buildings/${encodeURIComponent(id)}`),
};