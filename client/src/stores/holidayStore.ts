/**
 * Holiday Store — 統一假期管理
 * 涵蓋兩種資料：
 *   - categories：類型分組（國定假日 / 補班日 / 颱風假 / 公司紀念日 ...）
 *   - holidays：假期清單（依 date 排序，可指定 categoryId 與 color override）
 *
 * V4 改寫：原本用 queryAll/execute 讀 sql.js；改用 fetch API。
 * - categories 走 /api/holiday-categories
 * - holidays 走 /api/schedule/holidays（含 categoryId / color / notes 擴充欄位）
 *
 * V4 統一原則：
 * - schedule_holidays 由 migrations.ts 合併進 holidays（已搬）
 * - 之後新增 / 編輯 / 刪除假期統一走這個 store
 * - scheduleStore 仍保留 holidays 讀取別名（供其他模組消費）
 *
 * API surface（保持向後相容，呼叫端不需改）：
 *   state: categories, holidays, isLoading, error
 *   actions:
 *     loadCategories, loadHolidays, loadAll,
 *     createCategory, updateCategory, deleteCategory,
 *     createHoliday, updateHoliday, deleteHoliday
 */

import { create } from 'zustand';
import {
  holidayCategoriesApi,
  type HolidayCategoryDTO,
  type CreateHolidayCategoryInput,
  type UpdateHolidayCategoryInput,
} from '@/api/holiday-categories';
import {
  holidaysApi,
  type HolidayDTO,
  type CreateHolidayInput,
  type UpdateHolidayInput,
} from '@/api/holidays';

// ---------------- DTO 形別 ----------------
export interface HolidayCategory extends HolidayCategoryDTO {
  // DTO 本身已含完整欄位；為了相容舊版介面（createdAt/updatedAt 為必要字串），保留
  createdAt: string;
  updatedAt: string;
}

export interface Holiday extends HolidayDTO {}

// ---------------- State 介面 ----------------
interface HolidayState {
  categories: HolidayCategory[];
  holidays: Holiday[];
  isLoading: boolean;
  error: string | null;

  loadCategories: () => Promise<void>;
  loadHolidays: () => Promise<void>;
  loadAll: () => Promise<void>;

  createCategory: (data: CreateHolidayCategoryInput) => Promise<HolidayCategory>;
  updateCategory: (id: string, data: UpdateHolidayCategoryInput) => Promise<HolidayCategory>;
  deleteCategory: (id: string) => Promise<void>;

  createHoliday: (data: CreateHolidayInput) => Promise<Holiday>;
  updateHoliday: (id: string, data: UpdateHolidayInput) => Promise<Holiday>;
  deleteHoliday: (id: string) => Promise<void>;
}

export const useHolidayStore = create<HolidayState>((set, get) => ({
  categories: [],
  holidays: [],
  isLoading: false,
  error: null,

  // ---------------- Loaders ----------------

  loadCategories: async () => {
    try {
      const categories = await holidayCategoriesApi.list();
      set({ categories: categories as HolidayCategory[] });
    } catch (err: any) {
      // 表還沒建好或 route 尚未提供 — 留空陣列（舊行為）
      console.warn('[holidayStore] loadCategories skip:', err?.message);
      set({ error: err?.message ?? null });
    }
  },

  loadHolidays: async () => {
    try {
      const holidays = await holidaysApi.list();
      set({ holidays: holidays as Holiday[] });
    } catch (err: any) {
      console.warn('[holidayStore] loadHolidays skip:', err?.message);
      set({ error: err?.message ?? null });
    }
  },

  loadAll: async () => {
    set({ isLoading: true, error: null });
    try {
      // 平行載入
      await Promise.all([get().loadCategories(), get().loadHolidays()]);
    } finally {
      set({ isLoading: false });
    }
  },

  // ---------------- Categories CRUD ----------------

  createCategory: async (data) => {
    const created = await holidayCategoriesApi.create(data);
    set((state) => ({
      categories: [...state.categories, created as HolidayCategory],
    }));
    return created as HolidayCategory;
  },

  updateCategory: async (id, data) => {
    const updated = await holidayCategoriesApi.update(id, data);
    set((state) => ({
      categories: state.categories.map((c) => (c.id === id ? (updated as HolidayCategory) : c)),
    }));
    return updated as HolidayCategory;
  },

  deleteCategory: async (id) => {
    await holidayCategoriesApi.remove(id);
    // 把使用此 category 的 holidays 設為 NULL（server-side 已處理；本地也同步）
    set((state) => ({
      categories: state.categories.filter((c) => c.id !== id),
      holidays: state.holidays.map((h) =>
        h.categoryId === id ? { ...h, categoryId: null as string | null } : h
      ),
    }));
  },

  // ---------------- Holidays CRUD ----------------

  createHoliday: async (data) => {
    const created = await holidaysApi.create(data);
    set((state) => ({ holidays: [...state.holidays, created as Holiday] }));
    return created as Holiday;
  },

  updateHoliday: async (id, data) => {
    const updated = await holidaysApi.update(id, data);
    set((state) => ({
      holidays: state.holidays.map((h) => (h.id === id ? (updated as Holiday) : h)),
    }));
    return updated as Holiday;
  },

  deleteHoliday: async (id) => {
    await holidaysApi.remove(id);
    set((state) => ({ holidays: state.holidays.filter((h) => h.id !== id) }));
  },
}));
