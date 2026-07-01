/**
 * useParkingSpots — React Hook 封裝 parking_spots 資料讀取 + CRUD
 *
 * 對應 api/parking-spots.ts
 */

import { useEffect, useState, useCallback } from 'react';
import {
  parkingSpotsApi,
  type ParkingSpotDTO,
  type CreateParkingSpotInput,
  type UpdateParkingSpotInput,
} from '@/api/parking-spots';

interface UseParkingSpotsState {
  parkingSpots: ParkingSpotDTO[];
  isLoading: boolean;
  error: string | null;
}

interface UseParkingSpotsActions {
  load: (buildingId?: string) => Promise<void>;
  create: (data: CreateParkingSpotInput) => Promise<ParkingSpotDTO>;
  update: (id: string, data: UpdateParkingSpotInput) => Promise<ParkingSpotDTO>;
  remove: (id: string) => Promise<void>;
}

export function useParkingSpots(autoLoad = true): UseParkingSpotsState & UseParkingSpotsActions {
  const [parkingSpots, setParkingSpots] = useState<ParkingSpotDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (buildingId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = buildingId
        ? await parkingSpotsApi.listByBuilding(buildingId)
        : await parkingSpotsApi.list();
      setParkingSpots(data);
    } catch (e: any) {
      setError(e?.message ?? '載入停車位失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const create = useCallback(async (data: CreateParkingSpotInput) => {
    const created = await parkingSpotsApi.create(data);
    setParkingSpots((prev) => [...prev, created]);
    return created;
  }, []);

  const update = useCallback(async (id: string, data: UpdateParkingSpotInput) => {
    const updated = await parkingSpotsApi.update(id, data);
    setParkingSpots((prev) => prev.map((p) => (p.id === id ? updated : p)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await parkingSpotsApi.remove(id);
    setParkingSpots((prev) => prev.filter((p) => p.id !== id));
  }, []);

  useEffect(() => {
    if (autoLoad) void load();
  }, [autoLoad, load]);

  return { parkingSpots, isLoading, error, load, create, update, remove };
}