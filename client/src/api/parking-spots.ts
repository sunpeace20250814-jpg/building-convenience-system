/**
 * Parking Spots API — 停車位（parking_spots）
 *
 * ★ Go-style 設計：
 *   - 前端只呼叫這些函式，不直接 queryAll SQL
 *   - 後端實作：server/src/routes/settings.ts（/api/settings/parking）
 *   - 對應資料表：parking_spots
 *
 * 欄位（schema parking_spots）：
 *   id, buildingId, floor, number, space, type, status, statusId,
 *   residentId, boundResidentId, notes, createdAt, updatedAt
 *
 * 路由（/api/settings/parking）：
 *   GET    /                      列出所有（依 floor, number）
 *   GET    /building/:buildingId  依建築
 *   GET    /:id                   單筆
 *   POST   /                      新增
 *   PUT    /:id                   更新
 *   DELETE /:id                   刪除
 */

import { apiClient } from '@/lib/apiClient';

const BASE = '/api/settings/parking';

export interface ParkingSpotDTO {
  id: string;
  buildingId?: string | null;
  floor: string;
  number: string;
  space?: string | null;
  type?: string; // 'car' | 'motorcycle' | 'large'
  status?: string; // 'empty' | 'rented' | 'sold' | 'used'
  statusId?: string | null;
  residentId?: string | null;
  boundResidentId?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateParkingSpotInput {
  id?: string;
  buildingId?: string | null;
  floor: string;
  number: string;
  space?: string | null;
  type?: string;
  status?: string;
  statusId?: string | null;
  residentId?: string | null;
  boundResidentId?: string | null;
  notes?: string | null;
}

export type UpdateParkingSpotInput = Partial<CreateParkingSpotInput>;

export const parkingSpotsApi = {
  list: () => apiClient.get<ParkingSpotDTO[]>(BASE),
  listByBuilding: (buildingId: string) =>
    apiClient.get<ParkingSpotDTO[]>(`${BASE}/building/${encodeURIComponent(buildingId)}`),
  get: (id: string) =>
    apiClient.get<ParkingSpotDTO>(`${BASE}/${encodeURIComponent(id)}`),
  create: (data: CreateParkingSpotInput) =>
    apiClient.post<ParkingSpotDTO>(BASE, data),
  update: (id: string, data: UpdateParkingSpotInput) =>
    apiClient.put<ParkingSpotDTO>(`${BASE}/${encodeURIComponent(id)}`, data),
  remove: (id: string) =>
    apiClient.delete<{ success: boolean }>(`${BASE}/${encodeURIComponent(id)}`),
};