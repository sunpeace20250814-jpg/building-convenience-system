/**
 * Residents API — 前後端分離的契約層
 *
 * ★ Go-style 設計：
 *   - 前端只呼叫這些函式，不直接 queryAll SQL
 *   - 後端實作在 server/src/routes/residents.ts (/api/residents)
 *   - 加新欄位 → 後端 repository → 後端 schema → 前端 ResidentDTO type 同步更新
 *
 * 路徑前綴：/api/residents
 *
 * 子資源（server route 已支援）：
 *   - /:id/members  → residentMembersApi
 *   - /:id/keycards → residentKeycardsApi
 *
 * 子資源（server 尚未提供 route；先用 client-side wrapper）：
 *   - resident_emergency_contacts → residentEmergencyContactsApi
 *   - resident_parking            → residentParkingApi
 *   - decoration_records          → decorationRecordsApi
 */

import { apiClient } from '@/lib/apiClient';

// ============================================================
// ResidentDTO — 從 server/src/routes/residents.ts 的 body/response 推欄位
// ============================================================

export type UnitType = 'normal' | 'rental' | 'whole_floor';

export interface ResidentDTO {
  id: string;
  property?: string | null;
  buildingId: string;
  floorId?: string | null;
  floor: string;
  floorIndex?: number | null;
  unitNumber?: string | null;
  unitType?: UnitType;
  name: string;
  ownerName?: string | null;
  renterName?: string | null;
  phone?: string | null;
  email?: string | null;
  parkingId?: string | null;
  memberCount?: number;
  deposit?: number | null;
  monthlyRent?: number | null;
  moveInDate?: string | null;
  moveOutDate?: string | null;
  statusId?: string | null;
  status?: string | null;
  emergencyContact?: string | null;
  emergencyPhone?: string | null;
  note?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateResidentInput {
  id?: string;
  property?: string | null;
  buildingId: string;
  floor: string;
  floorId?: string | null;
  floorIndex?: number | null;
  unitNumber?: string | null;
  unitType?: UnitType;
  name: string;
  ownerName?: string | null;
  renterName?: string | null;
  phone?: string | null;
  email?: string | null;
  parkingId?: string | null;
  memberCount?: number;
  deposit?: number | null;
  monthlyRent?: number | null;
  moveInDate?: string | null;
  moveOutDate?: string | null;
  statusId?: string | null;
  status?: string | null;
  emergencyContact?: string | null;
  emergencyPhone?: string | null;
  note?: string | null;
  notes?: string | null;
}

export type UpdateResidentInput = Partial<CreateResidentInput>;

// ============================================================
// Residents 主體 API
// ============================================================

const BASE = '/api/residents';

export const residentsApi = {
  /** 列出所有住戶（server: GET /api/residents） */
  list: () => apiClient.get<ResidentDTO[]>(BASE),

  /** 關鍵字搜尋（server: GET /api/residents/search?q=...） */
  search: (q: string) =>
    apiClient.get<ResidentDTO[]>(`${BASE}/search`, { params: { q } }),

  /** 依建築物取住戶（server: GET /api/residents/building/:buildingId） */
  listByBuilding: (buildingId: string) =>
    apiClient.get<ResidentDTO[]>(`${BASE}/building/${encodeURIComponent(buildingId)}`),

  /** 取得單筆（server: GET /api/residents/:id） */
  get: (id: string) =>
    apiClient.get<ResidentDTO>(`${BASE}/${encodeURIComponent(id)}`),

  /** 新增（server: POST /api/residents） */
  create: (data: CreateResidentInput) => apiClient.post<ResidentDTO>(BASE, data),

  /** 更新（server: PUT /api/residents/:id） */
  update: (id: string, data: UpdateResidentInput) =>
    apiClient.put<ResidentDTO>(`${BASE}/${encodeURIComponent(id)}`, data),

  /** 刪除（server: DELETE /api/residents/:id — FK CASCADE 連帶刪 members / keycards） */
  remove: (id: string) =>
    apiClient.delete<{ success: boolean }>(`${BASE}/${encodeURIComponent(id)}`),
};

// ============================================================
// Resident Members — 子資源
// ============================================================

export interface ResidentMemberDTO {
  id: string;
  residentId: string;
  name: string;
  phone?: string | null;
  relationship?: string | null;
  idNumber?: string | null;
  birthdate?: string | null;
  note?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateResidentMemberInput {
  name: string;
  phone?: string | null;
  relation?: string | null;
  relationship?: string | null;
  idNumber?: string | null;
  birthdate?: string | null;
  note?: string | null;
  notes?: string | null;
}

export type UpdateResidentMemberInput = Partial<CreateResidentMemberInput>;

export const residentMembersApi = {
  list: (residentId: string) =>
    apiClient.get<ResidentMemberDTO[]>(
      `${BASE}/${encodeURIComponent(residentId)}/members`
    ),
  create: (residentId: string, data: CreateResidentMemberInput) =>
    apiClient.post<ResidentMemberDTO>(
      `${BASE}/${encodeURIComponent(residentId)}/members`,
      data
    ),
  update: (residentId: string, memberId: string, data: UpdateResidentMemberInput) =>
    apiClient.put<ResidentMemberDTO>(
      `${BASE}/${encodeURIComponent(residentId)}/members/${encodeURIComponent(memberId)}`,
      data
    ),
  remove: (residentId: string, memberId: string) =>
    apiClient.delete<{ success: boolean }>(
      `${BASE}/${encodeURIComponent(residentId)}/members/${encodeURIComponent(memberId)}`
    ),
};

// ============================================================
// Resident Keycards — 子資源
// ============================================================

export interface ResidentKeycardDTO {
  id: string;
  residentId: string;
  cardNumber: string;
  note?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateResidentKeycardInput {
  cardNumber: string;
  note?: string | null;
}

export type UpdateResidentKeycardInput = Partial<CreateResidentKeycardInput>;

export const residentKeycardsApi = {
  list: (residentId: string) =>
    apiClient.get<ResidentKeycardDTO[]>(
      `${BASE}/${encodeURIComponent(residentId)}/keycards`
    ),
  create: (residentId: string, data: CreateResidentKeycardInput) =>
    apiClient.post<ResidentKeycardDTO>(
      `${BASE}/${encodeURIComponent(residentId)}/keycards`,
      data
    ),
  update: (residentId: string, keycardId: string, data: UpdateResidentKeycardInput) =>
    apiClient.put<ResidentKeycardDTO>(
      `${BASE}/${encodeURIComponent(residentId)}/keycards/${encodeURIComponent(keycardId)}`,
      data
    ),
  remove: (residentId: string, keycardId: string) =>
    apiClient.delete<{ success: boolean }>(
      `${BASE}/${encodeURIComponent(residentId)}/keycards/${encodeURIComponent(keycardId)}`
    ),
};