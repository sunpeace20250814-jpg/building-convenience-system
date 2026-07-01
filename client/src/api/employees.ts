/**
 * Employees API — 員工資料
 *
 * ★ Go-style 設計：
 *   - 前端只呼叫這些函式，不直接 queryAll SQL
 *   - 後端實作：server/src/routes/employees.ts（/api/employees）
 *   - 對應資料表：employees
 *
 * 欄位（schema.ts employees）：
 *   id, name, phone, lineId, isActive, notes, createdAt, updatedAt
 *
 * 路由：
 *   GET    /api/employees                      列出在職員工（?includeInactive=true 包含停用）
 *   GET    /api/employees/:id                  單筆
 *   POST   /api/employees                      新增
 *   PUT    /api/employees/:id                  更新
 *   DELETE /api/employees/:id                  刪除
 */

import { apiClient } from '@/lib/apiClient';

const BASE = '/api/employees';

export interface EmployeeDTO {
  id: string;
  name: string;
  phone?: string | null;
  lineId?: string | null;
  isActive: boolean;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateEmployeeInput {
  name: string;
  phone?: string | null;
  lineId?: string | null;
  isActive?: boolean;
  notes?: string | null;
}

export type UpdateEmployeeInput = Partial<CreateEmployeeInput>;

export const employeesApi = {
  list: (includeInactive = false) =>
    apiClient.get<EmployeeDTO[]>(BASE, {
      params: { includeInactive: includeInactive ? 'true' : 'false' },
    }),
  get: (id: string) =>
    apiClient.get<EmployeeDTO>(`${BASE}/${encodeURIComponent(id)}`),
  create: (data: CreateEmployeeInput) =>
    apiClient.post<EmployeeDTO>(BASE, data),
  update: (id: string, data: UpdateEmployeeInput) =>
    apiClient.put<EmployeeDTO>(
      `${BASE}/${encodeURIComponent(id)}`,
      data,
    ),
  remove: (id: string) =>
    apiClient.delete<{ success: boolean }>(
      `${BASE}/${encodeURIComponent(id)}`,
    ),
};
