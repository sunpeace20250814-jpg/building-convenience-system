/**
 * Holidays API — 國定假日
 *
 * ★ Go-style 設計：
 *   - 前端只呼叫這些函式，不直接 queryAll SQL
 *   - 後端實作：server/src/routes/schedule.ts（/api/schedule/holidays 子路徑）
 *   - 對應資料表：holidays
 *
 * V4 統一假期（holidayStore 已合併 schedule_holidays）：
 *   - holidays 為主表，含 categoryId / color / notes 等擴充欄位
 *   - schedule_holidays（自訂班表假日）走獨立 API（scheduleHolidaysApi）
 *
 * 欄位（schema holidays）：
 *   id, date (UNIQUE), name,
 *   categoryId (FK→holiday_categories, ON DELETE SET NULL),
 *   color (override; null 用 category 預設色),
 *   notes, createdAt, updatedAt
 *
 * 路由（/api/schedule/holidays）：
 *   GET    /holidays                 列出所有
 *   GET    /holidays/year/:year      依年份
 *   GET    /holidays/date/:date      依日期單筆
 *   POST   /holidays                 新增
 *   PUT    /holidays/:id             更新
 *   DELETE /holidays/:id             刪除
 */

import { apiClient } from '@/lib/apiClient';

const BASE = '/api/holidays';

export interface HolidayDTO {
  id: string;
  date: string;
  name: string;
  categoryId?: string | null;
  color?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateHolidayInput {
  date: string;
  name: string;
  categoryId?: string | null;
  color?: string | null;
  notes?: string | null;
}

export type UpdateHolidayInput = Partial<CreateHolidayInput>;

export const holidaysApi = {
  list: () => apiClient.get<HolidayDTO[]>(BASE),
  listByYear: (year: string | number) =>
    apiClient.get<HolidayDTO[]>(`${BASE}/year/${year}`),
  getByDate: (date: string) =>
    apiClient.get<HolidayDTO>(`${BASE}/date/${encodeURIComponent(date)}`),
  get: (id: string) =>
    apiClient.get<HolidayDTO>(`${BASE}/${encodeURIComponent(id)}`),
  create: (data: CreateHolidayInput) =>
    apiClient.post<HolidayDTO>(BASE, data),
  update: (id: string, data: UpdateHolidayInput) =>
    apiClient.put<HolidayDTO>(
      `${BASE}/${encodeURIComponent(id)}`,
      data,
    ),
  remove: (id: string) =>
    apiClient.delete<{ success: boolean }>(
      `${BASE}/${encodeURIComponent(id)}`,
    ),
};
