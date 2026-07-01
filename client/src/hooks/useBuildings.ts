/**
 * useBuildings — React Hook 封裝 buildings 資料讀取 + CRUD
 *
 * ★ Go-style 設計：
 *   - 元件呼叫這個 hook，不直接呼叫 api.buildings
 *   - hook 內部管 loading / error / data 狀態
 *   - 之後若改用 React Query / SWR 只要改這個檔
 */

import { useEffect, useState, useCallback } from 'react';
import { buildingsApi, type BuildingDTO, type CreateBuildingInput, type UpdateBuildingInput } from '@/api/buildings';

interface UseBuildingsState {
  buildings: BuildingDTO[];
  isLoading: boolean;
  error: string | null;
}

interface UseBuildingsActions {
  load: () => Promise<void>;
  create: (data: CreateBuildingInput) => Promise<BuildingDTO>;
  update: (id: string, data: UpdateBuildingInput) => Promise<BuildingDTO>;
  remove: (id: string) => Promise<void>;
}

export function useBuildings(autoLoad = true): UseBuildingsState & UseBuildingsActions {
  const [buildings, setBuildings] = useState<BuildingDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await buildingsApi.list();
      setBuildings(data);
    } catch (e: any) {
      setError(e?.message ?? '載入失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const create = useCallback(async (data: CreateBuildingInput) => {
    const created = await buildingsApi.create(data);
    setBuildings((prev) => [...prev, created]);
    return created;
  }, []);

  const update = useCallback(async (id: string, data: UpdateBuildingInput) => {
    const updated = await buildingsApi.update(id, data);
    setBuildings((prev) => prev.map((b) => (b.id === id ? updated : b)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await buildingsApi.remove(id);
    setBuildings((prev) => prev.filter((b) => b.id !== id));
  }, []);

  useEffect(() => {
    if (autoLoad) void load();
  }, [autoLoad, load]);

  return { buildings, isLoading, error, load, create, update, remove };
}