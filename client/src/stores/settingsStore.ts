/**
 * 設定 Store
 *
 * ★ Phase 2 抽換完成：所有資源都改用 Fastify API（不再是 sql.js WASM）
 *   - buildings          → /api/settings/buildings   (Phase 1 完成)
 *   - parking_spots      → /api/settings/parking     (Phase 2)
 *   - status_options     → /api/settings/status      (Phase 2)
 */

import { create } from 'zustand';
import { apiClient } from '@/lib/apiClient';
import type { BuildingDTO } from '@/api/buildings';
import type {
  ParkingSpotDTO,
  CreateParkingSpotInput,
  UpdateParkingSpotInput,
} from '@/api/parking-spots';
import type {
  StatusOptionDTO,
  CreateStatusOptionInput,
} from '@/api/status-options';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

interface SettingsState {
  buildings: BuildingDTO[];
  parkingSpots: ParkingSpotDTO[];
  statusOptions: StatusOptionDTO[];
  // 別名：相容舊版模組引用
  statuses: StatusOptionDTO[];
  isLoading: boolean;
  error: string | null;
  loadBuildings: () => Promise<void>;
  loadParkingSpots: (buildingId?: string) => Promise<void>;
  loadStatuses: (type?: 'resident' | 'parking') => Promise<void>;
  createBuilding: (data: any) => Promise<BuildingDTO>;
  updateBuilding: (id: string, data: any) => Promise<void>;
  deleteBuilding: (id: string) => Promise<void>;
  createParkingSpot: (data: CreateParkingSpotInput | any) => Promise<ParkingSpotDTO>;
  updateParkingSpot?: (id: string, data: UpdateParkingSpotInput) => Promise<void>;
  deleteParkingSpot: (id: string) => Promise<void>;
  createStatus: (data: CreateStatusOptionInput | any) => Promise<StatusOptionDTO>;
  deleteStatus: (id: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  buildings: [],
  parkingSpots: [],
  statuses: [],
  statusOptions: [],
  isLoading: false,
  error: null,

  loadBuildings: async () => {
    try {
      const buildings = await apiClient.get<BuildingDTO[]>('/api/settings/buildings');
      set({ buildings });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  loadParkingSpots: async (buildingId?: string) => {
    try {
      const parkingSpots = buildingId
        ? await apiClient.get<ParkingSpotDTO[]>(
            `/api/settings/parking/building/${encodeURIComponent(buildingId)}`,
          )
        : await apiClient.get<ParkingSpotDTO[]>('/api/settings/parking');
      set({ parkingSpots });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  loadStatuses: async (type?: 'resident' | 'parking') => {
    try {
      const statuses = type
        ? await apiClient.get<StatusOptionDTO[]>(
            `/api/settings/status/type/${encodeURIComponent(type)}`,
          )
        : await apiClient.get<StatusOptionDTO[]>('/api/settings/status');
      set({ statuses, statusOptions: statuses });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  createBuilding: async (data) => {
    const created = await apiClient.post<BuildingDTO>('/api/settings/buildings', {
      id: data.id || generateId(),
      name: data.name,
      normalFloorCount: data.normalFloorCount ?? 1,
      rooftopFloorCount: data.rooftopFloorCount ?? 0,
      basementFloorCount: data.basementFloorCount ?? 0,
      unitsPerFloor: data.unitsPerFloor ?? 4,
      unitArea: data.unitArea ?? 30,
      unitNamePattern: data.unitNamePattern,
      notes: data.notes,
    });
    set((state) => ({ buildings: [...state.buildings, created] }));
    return created;
  },

  updateBuilding: async (id, data) => {
    await apiClient.put<BuildingDTO>(`/api/settings/buildings/${encodeURIComponent(id)}`, data);
    await get().loadBuildings();
  },

  deleteBuilding: async (id) => {
    await apiClient.delete<{ ok: boolean }>(`/api/settings/buildings/${encodeURIComponent(id)}`);
    set((state) => ({ buildings: state.buildings.filter((b) => b.id !== id) }));
  },

  createParkingSpot: async (data) => {
    const created = await apiClient.post<ParkingSpotDTO>('/api/settings/parking', {
      id: data.id || generateId(),
      ...data,
    });
    set((state) => ({ parkingSpots: [...state.parkingSpots, created] }));
    return created;
  },

  deleteParkingSpot: async (id) => {
    await apiClient.delete<{ ok: boolean }>(`/api/settings/parking/${encodeURIComponent(id)}`);
    set((state) => ({ parkingSpots: state.parkingSpots.filter((p) => p.id !== id) }));
  },

  createStatus: async (data) => {
    const created = await apiClient.post<StatusOptionDTO>('/api/settings/status', {
      id: data.id || generateId(),
      ...data,
    });
    set((state) => ({
      statuses: [...state.statuses, created],
      statusOptions: [...state.statusOptions, created],
    }));
    return created;
  },

  deleteStatus: async (id) => {
    await apiClient.delete<{ ok: boolean }>(`/api/settings/status/${encodeURIComponent(id)}`);
    set((state) => ({
      statuses: state.statuses.filter((s) => s.id !== id),
      statusOptions: state.statusOptions.filter((s) => s.id !== id),
    }));
  },
}));