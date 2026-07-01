/**
 * useFloors — React Hook 封裝 floors 資料讀取 + CRUD
 *
 * 對應 api/floors.ts
 */

import { useEffect, useState, useCallback } from 'react';
import {
  floorsApi,
  type FloorDTO,
  type CreateFloorInput,
  type UpdateFloorInput,
} from '@/api/floors';

interface UseFloorsState {
  floors: FloorDTO[];
  isLoading: boolean;
  error: string | null;
}

interface UseFloorsActions {
  load: (buildingId?: string) => Promise<void>;
  create: (data: CreateFloorInput) => Promise<FloorDTO>;
  update: (id: string, data: UpdateFloorInput) => Promise<FloorDTO>;
  remove: (id: string) => Promise<void>;
}

export function useFloors(autoLoad = true): UseFloorsState & UseFloorsActions {
  const [floors, setFloors] = useState<FloorDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (buildingId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = buildingId
        ? await floorsApi.listByBuilding(buildingId)
        : await floorsApi.list();
      setFloors(data);
    } catch (e: any) {
      setError(e?.message ?? '載入樓層失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const create = useCallback(async (data: CreateFloorInput) => {
    const created = await floorsApi.create(data);
    setFloors((prev) => [...prev, created]);
    return created;
  }, []);

  const update = useCallback(async (id: string, data: UpdateFloorInput) => {
    const updated = await floorsApi.update(id, data);
    setFloors((prev) => prev.map((f) => (f.id === id ? updated : f)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await floorsApi.remove(id);
    setFloors((prev) => prev.filter((f) => f.id !== id));
  }, []);

  useEffect(() => {
    if (autoLoad) void load();
  }, [autoLoad, load]);

  return { floors, isLoading, error, load, create, update, remove };
}