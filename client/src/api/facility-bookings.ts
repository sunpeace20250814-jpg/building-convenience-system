/**
 * Facility Bookings API — 公設借用（facility_bookings）
 *
 * ★ Go-style 設計：
 *   - 前端只呼叫這些函式，不直接 queryAll SQL
 *   - 對應資料表：facility_bookings
 *   - 後端實作：server/src/routes/facility-bookings.ts（待 sibling task 提供）
 *     本檔先建立 client-side 契約，server 404 不影響 typecheck/build。
 *
 * 欄位（schema facility_bookings）：
 *   id, date, residentId, residentName, facilityId, facilityName,
 *   startTime, endTime, paid, fee, notes, createdAt, updatedAt
 *
 * 路由（/api/facility-bookings）：
 *   GET    /                  列出（依 date DESC, start_time DESC）
 *   GET    /date/:date        依日期
 *   GET    /range?start&end   依區間
 *   GET    /:id               單筆
 *   POST   /                  新增
 *   PUT    /:id               更新
 *   DELETE /:id               刪除
 */

import { apiClient } from '@/lib/apiClient';

const BASE = '/api/facility-bookings';

export interface FacilityBookingDTO {
  id: string;
  date: string;
  residentId?: string | null;
  residentName?: string;
  facilityId: string;
  facilityName?: string;
  startTime: string;
  endTime: string;
  paid?: number; // 0 | 1
  fee?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateFacilityBookingInput {
  id?: string;
  date: string;
  residentId?: string | null;
  residentName?: string;
  facilityId: string;
  facilityName?: string;
  startTime: string;
  endTime: string;
  paid?: number;
  fee?: number;
  notes?: string;
}

export type UpdateFacilityBookingInput = Partial<CreateFacilityBookingInput>;

export const facilityBookingsApi = {
  list: () => apiClient.get<FacilityBookingDTO[]>(BASE),
  listByDate: (date: string) =>
    apiClient.get<FacilityBookingDTO[]>(`${BASE}/date/${encodeURIComponent(date)}`),
  listByRange: (start: string, end: string) =>
    apiClient.get<FacilityBookingDTO[]>(`${BASE}/range`, { params: { start, end } }),
  get: (id: string) =>
    apiClient.get<FacilityBookingDTO>(`${BASE}/${encodeURIComponent(id)}`),
  create: (data: CreateFacilityBookingInput) =>
    apiClient.post<FacilityBookingDTO>(BASE, data),
  update: (id: string, data: UpdateFacilityBookingInput) =>
    apiClient.put<FacilityBookingDTO>(`${BASE}/${encodeURIComponent(id)}`, data),
  remove: (id: string) =>
    apiClient.delete<{ success: boolean }>(`${BASE}/${encodeURIComponent(id)}`),
};