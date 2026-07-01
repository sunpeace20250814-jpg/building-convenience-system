/**
 * useFacilities — React Hook 封裝 facilities 資料讀取 + CRUD
 *
 * 對應 api/facilities.ts
 */

import { useEffect, useState, useCallback } from 'react';
import {
  facilitiesApi,
  type FacilityDTO,
  type CreateFacilityInput,
  type UpdateFacilityInput,
} from '@/api/facilities';

interface UseFacilitiesState {
  facilities: FacilityDTO[];
  isLoading: boolean;
  error: string | null;
}

interface UseFacilitiesActions {
  load: (buildingId?: string) => Promise<void>;
  create: (data: CreateFacilityInput) => Promise<FacilityDTO>;
  update: (id: string, data: UpdateFacilityInput) => Promise<FacilityDTO>;
  remove: (id: string) => Promise<void>;
}

export function useFacilities(autoLoad = true): UseFacilitiesState & UseFacilitiesActions {
  const [facilities, setFacilities] = useState<FacilityDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (buildingId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = buildingId
        ? await facilitiesApi.listByBuilding(buildingId)
        : await facilitiesApi.list();
      setFacilities(data);
    } catch (e: any) {
      setError(e?.message ?? '載入公設失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const create = useCallback(async (data: CreateFacilityInput) => {
    const created = await facilitiesApi.create(data);
    setFacilities((prev) => [...prev, created]);
    return created;
  }, []);

  const update = useCallback(async (id: string, data: UpdateFacilityInput) => {
    const updated = await facilitiesApi.update(id, data);
    setFacilities((prev) => prev.map((f) => (f.id === id ? updated : f)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await facilitiesApi.remove(id);
    setFacilities((prev) => prev.filter((f) => f.id !== id));
  }, []);

  useEffect(() => {
    if (autoLoad) void load();
  }, [autoLoad, load]);

  return { facilities, isLoading, error, load, create, update, remove };
}