/**
 * V1 擴充 Store
 * 包含 V1 才有、但 V4 schema 已擴充支援的表：
 * - floors (樓層細部：面積、計算房數) → /api/floors         (Phase 2)
 * - facilities (公設)                   → /api/facilities      (Phase 2)
 * - house_statuses / parking_statuses (V1 分離版)
 *                                     → /api/house-statuses  (Phase 2)
 *                                     → /api/parking-statuses (Phase 2)
 * - home_tabs / home_records (首頁公告)  → /api/home-tabs        (Phase 1 完成)
 *                                       → /api/home-records    (Phase 1 完成)
 * - employees + shifts + schedule_*   → /api/employees etc.   (schedule-rewrite scope)
 *
 * 注意：Phase 2 抽換範圍只到 floors / facilities / house_statuses / parking_statuses /
 *       home_tabs / home_records。employees / shifts / schedule_holidays / schedule_entries
 *       屬於 schedule-rewrite scope，本檔僅保留介面（不再 queryAll）。
 */

import { create } from 'zustand';
import { apiClient } from '@/lib/apiClient';
import type {
  FloorDTO,
  CreateFloorInput,
  UpdateFloorInput,
} from '@/api/floors';
import type {
  FacilityDTO,
  CreateFacilityInput,
  UpdateFacilityInput,
} from '@/api/facilities';
import type {
  HouseStatusDTO,
  CreateHouseStatusInput,
} from '@/api/house-statuses';
import type {
  ParkingStatusDTO,
  CreateParkingStatusInput,
} from '@/api/parking-statuses';

// ---------- re-export DTO 型別給 module 用 ----------
export type { FloorDTO, FacilityDTO, HouseStatusDTO, ParkingStatusDTO };

interface V1State {
  // Floors
  floors: FloorDTO[];
  loadFloors: (buildingId?: string) => Promise<void>;
  createFloor: (data: CreateFloorInput) => Promise<FloorDTO>;
  updateFloor: (id: string, data: UpdateFloorInput) => Promise<FloorDTO>;
  deleteFloor: (id: string) => Promise<void>;

  // Facilities
  facilities: FacilityDTO[];
  loadFacilities: (buildingId?: string) => Promise<void>;
  createFacility: (data: CreateFacilityInput) => Promise<FacilityDTO>;
  updateFacility: (id: string, data: UpdateFacilityInput) => Promise<FacilityDTO>;
  deleteFacility: (id: string) => Promise<void>;

  // House statuses (V1 split)
  houseStatuses: HouseStatusDTO[];
  loadHouseStatuses: () => Promise<void>;
  createHouseStatus: (data: CreateHouseStatusInput) => Promise<HouseStatusDTO>;
  deleteHouseStatus: (id: string) => Promise<void>;

  // Parking statuses (V1 split)
  parkingStatuses: ParkingStatusDTO[];
  loadParkingStatuses: () => Promise<void>;
  createParkingStatus: (data: CreateParkingStatusInput) => Promise<ParkingStatusDTO>;
  deleteParkingStatus: (id: string) => Promise<void>;

  // Employees / Shifts / Schedule — 屬 schedule-rewrite scope
  // 本檔保留介面但不實作 fetch；schedule-rewrite 會另寫一份完整 store。
  // 為了不破壞既有模組引用，這裡保留空陣列 + 警告 noop。
  employees: any[];
  shifts: any[];
  scheduleEntries: any[];
  scheduleHolidays: any[];
  scheduleNotes: any[];
  loadEmployees: () => Promise<void>;
  createEmployee: (data: any) => Promise<any>;
  updateEmployee: (id: string, data: any) => Promise<any>;
  deleteEmployee: (id: string) => Promise<void>;
  loadShifts: () => Promise<void>;
  createShift: (data: any) => Promise<any>;
  updateShift: (id: string, data: any) => Promise<any>;
  deleteShift: (id: string) => Promise<void>;
  loadScheduleEntries: (start: string, end: string) => Promise<void>;
  loadScheduleHolidays: () => Promise<void>;
  loadScheduleNotes: (start: string, end: string) => Promise<void>;
  upsertScheduleEntry: (data: any) => Promise<void>;
  deleteScheduleEntry: (id: string) => Promise<void>;
}

export const useV1Store = create<V1State>((set) => ({
  // ===== Floors =====
  floors: [],
  loadFloors: async (buildingId) => {
    try {
      const floors = buildingId
        ? await apiClient.get<FloorDTO[]>(
            `/api/floors/building/${encodeURIComponent(buildingId)}`,
          )
        : await apiClient.get<FloorDTO[]>('/api/floors');
      set({ floors });
    } catch (err: any) {
      set({ floors: [] });
    }
  },
  createFloor: async (data) => {
    const created = await apiClient.post<FloorDTO>('/api/floors', data);
    set((state) => ({ floors: [...state.floors, created] }));
    return created;
  },
  updateFloor: async (id, data) => {
    const updated = await apiClient.put<FloorDTO>(
      `/api/floors/${encodeURIComponent(id)}`,
      data,
    );
    set((state) => ({
      floors: state.floors.map((f) => (f.id === id ? updated : f)),
    }));
    return updated;
  },
  deleteFloor: async (id) => {
    await apiClient.delete<{ success: boolean }>(`/api/floors/${encodeURIComponent(id)}`);
    set((state) => ({ floors: state.floors.filter((f) => f.id !== id) }));
  },

  // ===== Facilities =====
  facilities: [],
  loadFacilities: async (buildingId) => {
    try {
      const facilities = buildingId
        ? await apiClient.get<FacilityDTO[]>(
            `/api/facilities/building/${encodeURIComponent(buildingId)}`,
          )
        : await apiClient.get<FacilityDTO[]>('/api/facilities');
      set({ facilities });
    } catch (err: any) {
      set({ facilities: [] });
    }
  },
  createFacility: async (data) => {
    const created = await apiClient.post<FacilityDTO>('/api/facilities', data);
    set((state) => ({ facilities: [...state.facilities, created] }));
    return created;
  },
  updateFacility: async (id, data) => {
    const updated = await apiClient.put<FacilityDTO>(
      `/api/facilities/${encodeURIComponent(id)}`,
      data,
    );
    set((state) => ({
      facilities: state.facilities.map((f) => (f.id === id ? updated : f)),
    }));
    return updated;
  },
  deleteFacility: async (id) => {
    await apiClient.delete<{ success: boolean }>(`/api/facilities/${encodeURIComponent(id)}`);
    set((state) => ({ facilities: state.facilities.filter((f) => f.id !== id) }));
  },

  // ===== House statuses =====
  houseStatuses: [],
  loadHouseStatuses: async () => {
    try {
      const list = await apiClient.get<HouseStatusDTO[]>('/api/house-statuses');
      set({ houseStatuses: list });
    } catch (err: any) {
      set({ houseStatuses: [] });
    }
  },
  createHouseStatus: async (data) => {
    const created = await apiClient.post<HouseStatusDTO>('/api/house-statuses', data);
    set((state) => ({ houseStatuses: [...state.houseStatuses, created] }));
    return created;
  },
  deleteHouseStatus: async (id) => {
    await apiClient.delete<{ success: boolean }>(
      `/api/house-statuses/${encodeURIComponent(id)}`,
    );
    set((state) => ({ houseStatuses: state.houseStatuses.filter((s) => s.id !== id) }));
  },

  // ===== Parking statuses =====
  parkingStatuses: [],
  loadParkingStatuses: async () => {
    try {
      const list = await apiClient.get<ParkingStatusDTO[]>('/api/parking-statuses');
      set({ parkingStatuses: list });
    } catch (err: any) {
      set({ parkingStatuses: [] });
    }
  },
  createParkingStatus: async (data) => {
    const created = await apiClient.post<ParkingStatusDTO>('/api/parking-statuses', data);
    set((state) => ({ parkingStatuses: [...state.parkingStatuses, created] }));
    return created;
  },
  deleteParkingStatus: async (id) => {
    await apiClient.delete<{ success: boolean }>(
      `/api/parking-statuses/${encodeURIComponent(id)}`,
    );
    set((state) => ({ parkingStatuses: state.parkingStatuses.filter((s) => s.id !== id) }));
  },

  // ===== Employees / Shifts / Schedule — 屬 schedule-rewrite scope =====
  // 此處保留 stub 以避免破壞既有模組的 `useV1Store()` 解構呼叫。
  // 若需實際 CRUD，請改用 schedule-rewrite 的 store（待 sibling 提供）。
  employees: [],
  shifts: [],
  scheduleEntries: [],
  scheduleHolidays: [],
  scheduleNotes: [],
  loadEmployees: async () => {
    // schedule-rewrite scope — stub
    set({ employees: [] });
  },
  createEmployee: async (data: any) => {
    console.warn('[useV1Store.createEmployee] 屬 schedule-rewrite scope');
    return data;
  },
  updateEmployee: async (_id: string, data: any) => {
    console.warn('[useV1Store.updateEmployee] 屬 schedule-rewrite scope');
    return data;
  },
  deleteEmployee: async (_id: string) => {
    console.warn('[useV1Store.deleteEmployee] 屬 schedule-rewrite scope');
  },
  loadShifts: async () => {
    set({ shifts: [] });
  },
  createShift: async (data: any) => {
    console.warn('[useV1Store.createShift] 屬 schedule-rewrite scope');
    return data;
  },
  updateShift: async (_id: string, data: any) => {
    console.warn('[useV1Store.updateShift] 屬 schedule-rewrite scope');
    return data;
  },
  deleteShift: async (_id: string) => {
    console.warn('[useV1Store.deleteShift] 屬 schedule-rewrite scope');
  },
  loadScheduleEntries: async (_start: string, _end: string) => {
    set({ scheduleEntries: [] });
  },
  loadScheduleHolidays: async () => {
    set({ scheduleHolidays: [] });
  },
  loadScheduleNotes: async (_start: string, _end: string) => {
    set({ scheduleNotes: [] });
  },
  upsertScheduleEntry: async (_data: any) => {
    console.warn('[useV1Store.upsertScheduleEntry] 屬 schedule-rewrite scope');
  },
  deleteScheduleEntry: async (_id: string) => {
    console.warn('[useV1Store.deleteScheduleEntry] 屬 schedule-rewrite scope');
  },
}));