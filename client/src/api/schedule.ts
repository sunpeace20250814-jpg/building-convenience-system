/**
 * Schedule API — 班表主體（ScheduleEntryDTO + scheduleApi 聚合）
 *
 * ★ Go-style 設計：
 *   - 前端只呼叫這些函式，不直接 queryAll SQL
 *   - 後端實作：server/src/routes/schedule.ts（/api/schedule）
 *   - 對應資料表：schedule_entries（外加 join shifts / employees）
 *
 * 班表記錄欄位（schema schedule_entries）：
 *   id, date, shiftId (FK), assigneeId (FK), notes, createdAt, updatedAt
 *   加上 join：shiftLabel, shiftColor, assigneeName
 *
 * 路由（/api/schedule）：
 *   GET    /                          列出所有（含 shift_label / assignee_name join）
 *   GET    /date/:date                依日期
 *   GET    /range?start=&end=         依日期區間
 *   GET    /:id                       單筆
 *   POST   /                          新增
 *   PUT    /:id                       更新
 *   DELETE /:id                       刪除
 *
 * sub-path 路由（/api/schedule 下）— scheduleApi 同時聚合這些資源：
 *   - /employees    → scheduleEmployeesApi
 *   - /shifts       → scheduleShiftsApi
 *   - /holidays     → scheduleHolidaysApi（國定假日）
 *
 * 對應的「頂層」獨立 API（亦由本 task 建立）：
 *   - /api/employees           → employeesApi
 *   - /api/shifts              → shiftsApi
 *   - /api/schedule-holidays   → scheduleHolidaysApi（自訂班表假日）
 *   - /api/schedule/holidays   → holidaysApi（國定假日）
 *
 * 兩套路徑功能重疊。scheduleApi 採用 /api/schedule 子路徑以保持「同一個資源群」
 * 的概念分組；元件若只想要頂層乾淨路徑，可直接 import 對應檔。
 */

import { apiClient } from '@/lib/apiClient';
import { employeesApi, type EmployeeDTO, type CreateEmployeeInput, type UpdateEmployeeInput } from './employees';
import { shiftsApi, type ShiftDTO, type CreateShiftInput, type UpdateShiftInput } from './shifts';
import { scheduleHolidaysApi, type ScheduleHolidayDTO, type CreateScheduleHolidayInput, type UpdateScheduleHolidayInput } from './schedule-holidays';
import { holidaysApi, type HolidayDTO, type CreateHolidayInput, type UpdateHolidayInput } from './holidays';

// Re-export api instances so consumers can also do:
//   import { employeesApi } from '@/api/schedule';
export { employeesApi, shiftsApi, scheduleHolidaysApi, holidaysApi };

// ============================================================================
// Schedule Entry DTO
// ============================================================================

export interface ScheduleEntryDTO {
  id: string;
  date: string;
  shiftId: string;
  assigneeId?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  // join 欄位（從 server 回傳）
  shiftLabel?: string;
  shiftColor?: string;
  assigneeName?: string;
}

export interface CreateScheduleEntryInput {
  date: string;
  shiftId: string;
  assigneeId?: string | null;
  notes?: string | null;
}

export type UpdateScheduleEntryInput = Partial<CreateScheduleEntryInput>;

// ============================================================================
// Schedule Entries API（主體）
// ============================================================================

const BASE = '/api/schedule';

export const scheduleEntriesApi = {
  list: () => apiClient.get<ScheduleEntryDTO[]>(BASE),
  listByDate: (date: string) =>
    apiClient.get<ScheduleEntryDTO[]>(
      `${BASE}/date/${encodeURIComponent(date)}`,
    ),
  listByRange: (start: string, end: string) =>
    apiClient.get<ScheduleEntryDTO[]>(`${BASE}/range`, {
      params: { start, end },
    }),
  get: (id: string) =>
    apiClient.get<ScheduleEntryDTO>(`${BASE}/${encodeURIComponent(id)}`),
  create: (data: CreateScheduleEntryInput) =>
    apiClient.post<ScheduleEntryDTO>(BASE, data),
  update: (id: string, data: UpdateScheduleEntryInput) =>
    apiClient.put<ScheduleEntryDTO>(
      `${BASE}/${encodeURIComponent(id)}`,
      data,
    ),
  remove: (id: string) =>
    apiClient.delete<{ success: boolean }>(
      `${BASE}/${encodeURIComponent(id)}`,
    ),
};

// ============================================================================
// Schedule API — 聚合（entries + employees + shifts + holidays + scheduleHolidays）
//
// 用法：
//   import { scheduleApi } from '@/api/schedule';
//   await scheduleApi.entries.list();
//   await scheduleApi.employees.list();
// ============================================================================

export const scheduleApi = {
  entries: scheduleEntriesApi,
  employees: employeesApi,
  shifts: shiftsApi,
  holidays: holidaysApi,
  scheduleHolidays: scheduleHolidaysApi,
};

// Re-export DTO / Input types 以便消費者 import 集中
export type {
  EmployeeDTO,
  CreateEmployeeInput,
  UpdateEmployeeInput,
  ShiftDTO,
  CreateShiftInput,
  UpdateShiftInput,
  ScheduleHolidayDTO,
  CreateScheduleHolidayInput,
  UpdateScheduleHolidayInput,
  HolidayDTO,
  CreateHolidayInput,
  UpdateHolidayInput,
};
