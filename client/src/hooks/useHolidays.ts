/**
 * useHolidays — React Hook 封裝 holidays 資料讀取 + CRUD
 *
 * 對應 api/holidays.ts（含 categoryId / color / notes 擴充欄位）
 */

import { useEffect, useState, useCallback } from 'react';
import {
  holidaysApi,
  type HolidayDTO,
  type CreateHolidayInput,
  type UpdateHolidayInput,
} from '@/api/holidays';

interface UseHolidaysState {
  holidays: HolidayDTO[];
  isLoading: boolean;
  error: string | null;
}

interface UseHolidaysActions {
  load: () => Promise<void>;
  loadByYear: (year: string | number) => Promise<HolidayDTO[]>;
  create: (data: CreateHolidayInput) => Promise<HolidayDTO>;
  update: (id: string, data: UpdateHolidayInput) => Promise<HolidayDTO>;
  remove: (id: string) => Promise<void>;
}

export function useHolidays(autoLoad = true): UseHolidaysState & UseHolidaysActions {
  const [holidays, setHolidays] = useState<HolidayDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await holidaysApi.list();
      setHolidays(data);
    } catch (e: any) {
      setError(e?.message ?? '載入失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadByYear = useCallback(async (year: string | number) => {
    return holidaysApi.listByYear(year);
  }, []);

  const create = useCallback(async (data: CreateHolidayInput) => {
    const created = await holidaysApi.create(data);
    setHolidays((prev) => [...prev, created]);
    return created;
  }, []);

  const update = useCallback(async (id: string, data: UpdateHolidayInput) => {
    const updated = await holidaysApi.update(id, data);
    setHolidays((prev) => prev.map((h) => (h.id === id ? updated : h)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await holidaysApi.remove(id);
    setHolidays((prev) => prev.filter((h) => h.id !== id));
  }, []);

  useEffect(() => {
    if (autoLoad) void load();
  }, [autoLoad, load]);

  return { holidays, isLoading, error, load, loadByYear, create, update, remove };
}
