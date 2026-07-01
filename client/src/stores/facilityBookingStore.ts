/**
 * Facility Booking Store - 公設借用 Store
 * 管理公設借用的 CRUD（V4 改寫：走 fetch API，不再用 sql.js WASM）
 *
 * API surface（保持向後相容，呼叫端不需改）：
 *   state: bookings, isLoading, error
 *   actions:
 *     loadBookings, loadByDate, loadByMonth,
 *     createBooking, updateBooking, deleteBooking, togglePaid
 *
 * 注意：
 * - 原本 sync 行為 → async；load* 仍 fire-and-forget（呼叫端不需 await）
 * - server route 目前尚未提供（屬 sibling task scope），client API 已定義；
 *   在 server route 完成前，呼叫會 404，state 不會更新。
 */

import { create } from 'zustand';
import {
  facilityBookingsApi,
  type FacilityBookingDTO,
  type CreateFacilityBookingInput,
} from '@/api/facility-bookings';

// ---------------- DTO 形別 ----------------
export type FacilityBooking = FacilityBookingDTO;

// ---------------- State 介面 ----------------
interface FacilityBookingState {
  bookings: FacilityBooking[];
  isLoading: boolean;
  error: string | null;
  loadBookings: () => Promise<void>;
  loadByDate: (date: string) => Promise<FacilityBooking[]>;
  loadByMonth: (year: number, month: number) => Promise<FacilityBooking[]>;
  createBooking: (data: Omit<FacilityBooking, 'id' | 'createdAt' | 'updatedAt'>) => Promise<FacilityBooking>;
  updateBooking: (id: string, data: Partial<FacilityBooking>) => Promise<void>;
  deleteBooking: (id: string) => Promise<void>;
  togglePaid: (id: string) => Promise<void>;
}

export const useFacilityBookingStore = create<FacilityBookingState>((set, get) => ({
  bookings: [],
  isLoading: false,
  error: null,

  loadBookings: async () => {
    set({ isLoading: true, error: null });
    try {
      const bookings = await facilityBookingsApi.list();
      set({ bookings, isLoading: false });
    } catch (err: any) {
      set({ error: err?.message ?? '載入借用紀錄失敗', isLoading: false });
    }
  },

  loadByDate: async (date: string) => {
    try {
      return await facilityBookingsApi.listByDate(date);
    } catch (err: any) {
      console.error('[loadByDate]', err);
      return [];
    }
  },

  loadByMonth: async (year: number, month: number) => {
    try {
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return await facilityBookingsApi.listByRange(start, end);
    } catch (err: any) {
      console.error('[loadByMonth]', err);
      return [];
    }
  },

  createBooking: async (data) => {
    const created = await facilityBookingsApi.create({
      ...data,
      paid: data.paid ? 1 : 0,
    } as CreateFacilityBookingInput);
    set((state) => ({ bookings: [created, ...state.bookings] }));
    return created;
  },

  updateBooking: async (id, data) => {
    const updated = await facilityBookingsApi.update(id, {
      ...data,
      paid: data.paid !== undefined ? (data.paid ? 1 : 0) : undefined,
    });
    set((state) => ({
      bookings: state.bookings.map((b) => (b.id === id ? updated : b)),
    }));
  },

  deleteBooking: async (id) => {
    await facilityBookingsApi.remove(id);
    set((state) => ({ bookings: state.bookings.filter((b) => b.id !== id) }));
  },

  togglePaid: async (id) => {
    const existing = get().bookings.find((b) => b.id === id);
    if (!existing) return;
    const newPaid = existing.paid ? 0 : 1;
    await facilityBookingsApi.update(id, { paid: newPaid });
    set((state) => ({
      bookings: state.bookings.map((b) => (b.id === id ? { ...b, paid: newPaid } : b)),
    }));
  },
}));