/**
 * useHouseStatuses — React Hook 封裝 house_statuses 資料讀取 + CRUD
 *
 * 對應 api/house-statuses.ts
 */

import { useEffect, useState, useCallback } from 'react';
import {
  houseStatusesApi,
  type HouseStatusDTO,
  type CreateHouseStatusInput,
  type UpdateHouseStatusInput,
} from '@/api/house-statuses';

interface UseHouseStatusesState {
  houseStatuses: HouseStatusDTO[];
  isLoading: boolean;
  error: string | null;
}

interface UseHouseStatusesActions {
  load: () => Promise<void>;
  create: (data: CreateHouseStatusInput) => Promise<HouseStatusDTO>;
  update: (id: string, data: UpdateHouseStatusInput) => Promise<HouseStatusDTO>;
  remove: (id: string) => Promise<void>;
}

export function useHouseStatuses(autoLoad = true): UseHouseStatusesState & UseHouseStatusesActions {
  const [houseStatuses, setHouseStatuses] = useState<HouseStatusDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await houseStatusesApi.list();
      setHouseStatuses(data);
    } catch (e: any) {
      setError(e?.message ?? '載入住屋狀態失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const create = useCallback(async (data: CreateHouseStatusInput) => {
    const created = await houseStatusesApi.create(data);
    setHouseStatuses((prev) => [...prev, created]);
    return created;
  }, []);

  const update = useCallback(async (id: string, data: UpdateHouseStatusInput) => {
    const updated = await houseStatusesApi.update(id, data);
    setHouseStatuses((prev) => prev.map((s) => (s.id === id ? updated : s)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await houseStatusesApi.remove(id);
    setHouseStatuses((prev) => prev.filter((s) => s.id !== id));
  }, []);

  useEffect(() => {
    if (autoLoad) void load();
  }, [autoLoad, load]);

  return { houseStatuses, isLoading, error, load, create, update, remove };
}