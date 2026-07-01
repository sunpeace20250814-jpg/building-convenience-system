/**
 * useHolidayCategories — React Hook 封裝 holiday_categories 資料讀取 + CRUD
 *
 * 對應 api/holiday-categories.ts
 */

import { useEffect, useState, useCallback } from 'react';
import {
  holidayCategoriesApi,
  type HolidayCategoryDTO,
  type CreateHolidayCategoryInput,
  type UpdateHolidayCategoryInput,
} from '@/api/holiday-categories';

interface UseHolidayCategoriesState {
  categories: HolidayCategoryDTO[];
  isLoading: boolean;
  error: string | null;
}

interface UseHolidayCategoriesActions {
  load: () => Promise<void>;
  create: (data: CreateHolidayCategoryInput) => Promise<HolidayCategoryDTO>;
  update: (id: string, data: UpdateHolidayCategoryInput) => Promise<HolidayCategoryDTO>;
  remove: (id: string) => Promise<void>;
}

export function useHolidayCategories(autoLoad = true): UseHolidayCategoriesState & UseHolidayCategoriesActions {
  const [categories, setCategories] = useState<HolidayCategoryDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await holidayCategoriesApi.list();
      setCategories(data);
    } catch (e: any) {
      setError(e?.message ?? '載入失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const create = useCallback(async (data: CreateHolidayCategoryInput) => {
    const created = await holidayCategoriesApi.create(data);
    setCategories((prev) => [...prev, created]);
    return created;
  }, []);

  const update = useCallback(async (id: string, data: UpdateHolidayCategoryInput) => {
    const updated = await holidayCategoriesApi.update(id, data);
    setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await holidayCategoriesApi.remove(id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }, []);

  useEffect(() => {
    if (autoLoad) void load();
  }, [autoLoad, load]);

  return { categories, isLoading, error, load, create, update, remove };
}
