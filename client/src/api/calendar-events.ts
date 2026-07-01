/**
 * Calendar Events API — 行事曆事件（calendar_events）
 *
 * ★ Go-style 設計：
 *   - 前端只呼叫這些函式，不直接 queryAll SQL
 *   - 後端實作：server/src/routes/calendar-events.ts（/api/calendar-events）
 *   - 對應資料表：calendar_events
 *
 * 欄位（schema calendar_events）：
 *   id, date, title, color, notes, createdAt, updatedAt
 *
 * 路由（/api/calendar-events）：
 *   GET    /                     列出（依 date DESC）
 *   GET    /range?start&end       依區間
 *   GET    /date/:date           依日期
 *   GET    /:id                  單筆
 *   POST   /                     新增
 *   PUT    /:id                  更新
 *   DELETE /:id                  刪除
 */

import { apiClient } from '@/lib/apiClient';

const BASE = '/api/calendar-events';

export interface CalendarEventDTO {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  color?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCalendarEventInput {
  id?: string;
  date: string;
  title: string;
  color?: string | null;
  notes?: string | null;
}

export type UpdateCalendarEventInput = Partial<CreateCalendarEventInput>;

export const calendarEventsApi = {
  list: () => apiClient.get<CalendarEventDTO[]>(BASE),
  listByRange: (start: string, end: string) =>
    apiClient.get<CalendarEventDTO[]>(`${BASE}/range`, { params: { start, end } }),
  listByDate: (date: string) =>
    apiClient.get<CalendarEventDTO[]>(`${BASE}/date/${encodeURIComponent(date)}`),
  get: (id: string) =>
    apiClient.get<CalendarEventDTO>(`${BASE}/${encodeURIComponent(id)}`),
  create: (data: CreateCalendarEventInput) =>
    apiClient.post<CalendarEventDTO>(BASE, data),
  update: (id: string, data: UpdateCalendarEventInput) =>
    apiClient.put<CalendarEventDTO>(`${BASE}/${encodeURIComponent(id)}`, data),
  remove: (id: string) =>
    apiClient.delete<{ success: boolean }>(`${BASE}/${encodeURIComponent(id)}`),
};