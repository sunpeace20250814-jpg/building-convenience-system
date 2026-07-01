/**
 * 班表 Store
 *
 * V4 改寫：原本用 queryAll/execute 讀 sql.js；改用 fetch API。
 * - 資料來源：
 *   - entries / shifts / employees / holidays 走 /api/schedule/* 與 /api/employees /api/shifts
 *   - holidays 從 scheduleStore.holidays 仍保留讀取別名（供其他模組消費）；
 *     統一假期管理由 useHolidayStore 負責。
 *
 * API surface（保持向後相容，呼叫端不需改）：
 *   state: entries, shifts, shiftStatuses, employees, holidays, isLoading, error
 *   actions:
 *     loadSchedule, loadShifts, loadShiftStatuses, loadEmployees, loadHolidays,
 *     createEntry, updateEntry, deleteEntry,
 *     createEmployee, deleteEmployee,
 *     createShift, deleteShift,
 *     createHoliday, deleteHoliday
 *
 * 注意：原本 store 是 sync 行為（SQL 立即生效 + state 立即更新）。
 * 改為 async 後：
 *   - load*() 改成 fire-and-forget 風格，回傳 Promise<void>（呼叫端不需 await）
 *   - create/update/delete 改為 async，state 更新等 API 回來才 set（microtask 延遲）
 *   - 呼叫端目前都不使用 createX 的回傳值，因此行為對呼叫端透明
 */

import { create } from 'zustand';
import {
  scheduleEntriesApi,
  employeesApi,
  shiftsApi,
  holidaysApi,
  type ScheduleEntryDTO,
  type EmployeeDTO,
  type ShiftDTO,
  type HolidayDTO,
  type CreateScheduleEntryInput,
  type UpdateScheduleEntryInput,
  type CreateEmployeeInput,
  type CreateShiftInput,
  type CreateHolidayInput,
} from '@/api/schedule';

// ---------------- DTO 形別（重新匯出，方便 store 使用者） ----------------
export type { ScheduleEntryDTO, EmployeeDTO, ShiftDTO, HolidayDTO };

// ---------------- State 介面 ----------------
interface ScheduleState {
  entries: ScheduleEntryDTO[];
  shifts: ShiftDTO[];
  // 別名：相容舊版模組引用
  shiftStatuses: ShiftDTO[];
  employees: EmployeeDTO[];
  holidays: HolidayDTO[];
  isLoading: boolean;
  error: string | null;

  loadSchedule: () => Promise<void>;
  loadShifts: () => Promise<void>;
  loadShiftStatuses: () => Promise<void>;
  loadEmployees: () => Promise<void>;
  loadHolidays: () => Promise<void>;

  createEntry: (data: CreateScheduleEntryInput) => Promise<ScheduleEntryDTO>;
  updateEntry: (id: string, data: UpdateScheduleEntryInput) => Promise<ScheduleEntryDTO>;
  deleteEntry: (id: string) => Promise<void>;

  createEmployee: (data: CreateEmployeeInput) => Promise<EmployeeDTO>;
  deleteEmployee: (id: string) => Promise<void>;

  createShift: (data: CreateShiftInput) => Promise<ShiftDTO>;
  deleteShift: (id: string) => Promise<void>;

  createHoliday: (data: CreateHolidayInput) => Promise<HolidayDTO>;
  deleteHoliday: (id: string) => Promise<void>;
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  entries: [],
  shifts: [],
  shiftStatuses: [],
  employees: [],
  holidays: [],
  isLoading: false,
  error: null,

  // ---------------- Loaders ----------------

  loadSchedule: async () => {
    set({ isLoading: true, error: null });
    try {
      const entries = await scheduleEntriesApi.list();
      set({ entries, isLoading: false });
    } catch (err: any) {
      set({ error: err?.message ?? '載入班表失敗', isLoading: false });
    }
  },

  loadShifts: async () => {
    try {
      const shifts = await shiftsApi.list();
      set({ shifts, shiftStatuses: shifts });
    } catch (err: any) {
      set({ error: err?.message ?? '載入班別失敗' });
    }
  },

  loadShiftStatuses: async () => {
    await get().loadShifts();
  },

  loadEmployees: async () => {
    try {
      const employees = await employeesApi.list(false);
      set({ employees });
    } catch (err: any) {
      set({ error: err?.message ?? '載入員工失敗' });
    }
  },

  loadHolidays: async () => {
    try {
      const holidays = await holidaysApi.list();
      set({ holidays });
    } catch (err: any) {
      set({ error: err?.message ?? '載入假期失敗' });
    }
  },

  // ---------------- Schedule Entries CRUD ----------------

  createEntry: async (data) => {
    const created = await scheduleEntriesApi.create(data);
    set((state) => ({ entries: [...state.entries, created] }));
    return created;
  },

  updateEntry: async (id, data) => {
    const updated = await scheduleEntriesApi.update(id, data);
    set((state) => ({
      entries: state.entries.map((e) => (e.id === id ? updated : e)),
    }));
    return updated;
  },

  deleteEntry: async (id) => {
    await scheduleEntriesApi.remove(id);
    set((state) => ({ entries: state.entries.filter((e) => e.id !== id) }));
  },

  // ---------------- Employees CRUD ----------------

  createEmployee: async (data) => {
    const created = await employeesApi.create(data);
    set((state) => ({ employees: [...state.employees, created] }));
    return created;
  },

  deleteEmployee: async (id) => {
    await employeesApi.remove(id);
    set((state) => ({
      employees: state.employees.filter((e) => e.id !== id),
    }));
  },

  // ---------------- Shifts CRUD ----------------

  createShift: async (data) => {
    const created = await shiftsApi.create(data);
    set((state) => ({
      shifts: [...state.shifts, created],
      shiftStatuses: [...state.shiftStatuses, created],
    }));
    return created;
  },

  deleteShift: async (id) => {
    await shiftsApi.remove(id);
    set((state) => ({
      shifts: state.shifts.filter((s) => s.id !== id),
      shiftStatuses: state.shiftStatuses.filter((s) => s.id !== id),
    }));
  },

  // ---------------- Holidays CRUD（scheduleStore 內仍保留 holidays 操作別名） ----------------

  createHoliday: async (data) => {
    const created = await holidaysApi.create(data);
    set((state) => ({ holidays: [...state.holidays, created] }));
    return created;
  },

  deleteHoliday: async (id) => {
    await holidaysApi.remove(id);
    set((state) => ({
      holidays: state.holidays.filter((h) => h.id !== id),
    }));
  },
}));
