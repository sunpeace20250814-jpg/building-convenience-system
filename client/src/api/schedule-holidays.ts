/**
 * Schedule Holidays API — 排班自訂假日
 *
 * ★ Go-style 設計：
 *   - 前端只呼叫這些函式，不直接 queryAll SQL
 *   - 後端實作：server/src/routes/schedule-holidays.ts（/api/schedule-holidays）
 *   - 對應資料表：schedule_holidays
 *
 * 欄位（schema.ts schedule_holidays）：
 *   id, date (UNIQUE), name, isWorkDay, notes
 *
 * 注意：與 holidays（國定假日，/api/holidays 或 /api/schedule/holidays）並存。
 * schedule_holidays 是「自訂班表假日」可標記補班 (isWorkDay)。
 *
 * 路由：
 *   GET    /api/schedule-holidays                列出所有（依 date 排序）
 *   GET    /api/schedule-holidays/year/:year     依年份
 *   GET    /api/schedule-holidays/date/:date     依日期單筆
 *   GET    /api/schedule-holidays/:id            單筆
 *   POST   /api/schedule-holidays                新增
 *   PUT    /api/schedule-holidays/:id            更新
 *   DELETE /api/schedule-holidays/:id            刪除
 */

import { apiClient } from '@/lib/apiClient';

const BASE = '/api/schedule-holidays';

export interface ScheduleHolidayDTO {
  id: string;
  date: string;
  name: string;
  isWorkDay?: boolean;
  notes?: string | null;
}

export interface CreateScheduleHolidayInput {
  date: string;
  name: string;
  isWorkDay?: boolean;
  notes?: string | null;
}

export type UpdateScheduleHolidayInput = Partial<CreateScheduleHolidayInput>;

export const scheduleHolidaysApi = {
  list: () => apiClient.get<ScheduleHolidayDTO[]>(BASE),
  listByYear: (year: string | number) =>
    apiClient.get<ScheduleHolidayDTO[]>(`${BASE}/year/${year}`),
  getByDate: (date: string) =>
    apiClient.get<ScheduleHolidayDTO>(`${BASE}/date/${encodeURIComponent(date)}`),
  get: (id: string) =>
    apiClient.get<ScheduleHolidayDTO>(`${BASE}/${encodeURIComponent(id)}`),
  create: (data: CreateScheduleHolidayInput) =>
    apiClient.post<ScheduleHolidayDTO>(BASE, data),
  update: (id: string, data: UpdateScheduleHolidayInput) =>
    apiClient.put<ScheduleHolidayDTO>(
      `${BASE}/${encodeURIComponent(id)}`,
      data,
    ),
  remove: (id: string) =>
    apiClient.delete<{ success: boolean }>(
      `${BASE}/${encodeURIComponent(id)}`,
    ),
};
