/**
 * useSchedule — React Hook 封裝 schedule_entries 資料讀取 + CRUD
 *
 * ★ Go-style 設計：
 *   - 元件呼叫這個 hook，不直接呼叫 api.schedule
 *   - hook 內部管 loading / error / data 狀態
 *   - 之後若改用 React Query / SWR 只要改這個檔
 *
 * 對應 api/schedule.ts 的 scheduleEntriesApi。
 */

import { useEffect, useState, useCallback } from 'react';
import {
  scheduleEntriesApi,
  type ScheduleEntryDTO,
  type CreateScheduleEntryInput,
  type UpdateScheduleEntryInput,
} from '@/api/schedule';

interface UseScheduleState {
  entries: ScheduleEntryDTO[];
  isLoading: boolean;
  error: string | null;
}

interface UseScheduleActions {
  load: () => Promise<void>;
  loadByDate: (date: string) => Promise<ScheduleEntryDTO[]>;
  loadByRange: (start: string, end: string) => Promise<ScheduleEntryDTO[]>;
  create: (data: CreateScheduleEntryInput) => Promise<ScheduleEntryDTO>;
  update: (id: string, data: UpdateScheduleEntryInput) => Promise<ScheduleEntryDTO>;
  remove: (id: string) => Promise<void>;
}

export function useSchedule(autoLoad = true): UseScheduleState & UseScheduleActions {
  const [entries, setEntries] = useState<ScheduleEntryDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await scheduleEntriesApi.list();
      setEntries(data);
    } catch (e: any) {
      setError(e?.message ?? '載入失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadByDate = useCallback(async (date: string) => {
    return scheduleEntriesApi.listByDate(date);
  }, []);

  const loadByRange = useCallback(async (start: string, end: string) => {
    return scheduleEntriesApi.listByRange(start, end);
  }, []);

  const create = useCallback(async (data: CreateScheduleEntryInput) => {
    const created = await scheduleEntriesApi.create(data);
    setEntries((prev) => [...prev, created]);
    return created;
  }, []);

  const update = useCallback(async (id: string, data: UpdateScheduleEntryInput) => {
    const updated = await scheduleEntriesApi.update(id, data);
    setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await scheduleEntriesApi.remove(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  useEffect(() => {
    if (autoLoad) void load();
  }, [autoLoad, load]);

  return { entries, isLoading, error, load, loadByDate, loadByRange, create, update, remove };
}
