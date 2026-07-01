/**
 * useParkingStatuses — React Hook 封裝 parking_statuses 資料讀取 + CRUD
 *
 * 對應 api/parking-statuses.ts
 */

import { useEffect, useState, useCallback } from 'react';
import {
  parkingStatusesApi,
  type ParkingStatusDTO,
  type CreateParkingStatusInput,
  type UpdateParkingStatusInput,
} from '@/api/parking-statuses';

interface UseParkingStatusesState {
  parkingStatuses: ParkingStatusDTO[];
  isLoading: boolean;
  error: string | null;
}

interface UseParkingStatusesActions {
  load: () => Promise<void>;
  create: (data: CreateParkingStatusInput) => Promise<ParkingStatusDTO>;
  update: (id: string, data: UpdateParkingStatusInput) => Promise<ParkingStatusDTO>;
  remove: (id: string) => Promise<void>;
}

export function useParkingStatuses(autoLoad = true): UseParkingStatusesState & UseParkingStatusesActions {
  const [parkingStatuses, setParkingStatuses] = useState<ParkingStatusDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await parkingStatusesApi.list();
      setParkingStatuses(data);
    } catch (e: any) {
      setError(e?.message ?? '載入停車位狀態失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const create = useCallback(async (data: CreateParkingStatusInput) => {
    const created = await parkingStatusesApi.create(data);
    setParkingStatuses((prev) => [...prev, created]);
    return created;
  }, []);

  const update = useCallback(async (id: string, data: UpdateParkingStatusInput) => {
    const updated = await parkingStatusesApi.update(id, data);
    setParkingStatuses((prev) => prev.map((s) => (s.id === id ? updated : s)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await parkingStatusesApi.remove(id);
    setParkingStatuses((prev) => prev.filter((s) => s.id !== id));
  }, []);

  useEffect(() => {
    if (autoLoad) void load();
  }, [autoLoad, load]);

  return { parkingStatuses, isLoading, error, load, create, update, remove };
}