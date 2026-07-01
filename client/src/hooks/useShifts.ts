/**
 * useShifts — React Hook 封裝 shifts 資料讀取 + CRUD
 *
 * ★ Go-style 設計：
 *   - 元件呼叫這個 hook，不直接呼叫 api.shifts
 *   - hook 內部管 loading / error / data 狀態
 *   - 之後若改用 React Query / SWR 只要改這個檔
 */

import { useEffect, useState, useCallback } from 'react';
import {
  shiftsApi,
  type ShiftDTO,
  type CreateShiftInput,
  type UpdateShiftInput,
} from '@/api/shifts';

interface UseShiftsState {
  shifts: ShiftDTO[];
  isLoading: boolean;
  error: string | null;
}

interface UseShiftsActions {
  load: () => Promise<void>;
  create: (data: CreateShiftInput) => Promise<ShiftDTO>;
  update: (id: string, data: UpdateShiftInput) => Promise<ShiftDTO>;
  remove: (id: string) => Promise<void>;
}

export function useShifts(autoLoad = true): UseShiftsState & UseShiftsActions {
  const [shifts, setShifts] = useState<ShiftDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await shiftsApi.list();
      setShifts(data);
    } catch (e: any) {
      setError(e?.message ?? '載入失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const create = useCallback(async (data: CreateShiftInput) => {
    const created = await shiftsApi.create(data);
    setShifts((prev) => [...prev, created]);
    return created;
  }, []);

  const update = useCallback(async (id: string, data: UpdateShiftInput) => {
    const updated = await shiftsApi.update(id, data);
    setShifts((prev) => prev.map((s) => (s.id === id ? updated : s)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await shiftsApi.remove(id);
    setShifts((prev) => prev.filter((s) => s.id !== id));
  }, []);

  useEffect(() => {
    if (autoLoad) void load();
  }, [autoLoad, load]);

  return { shifts, isLoading, error, load, create, update, remove };
}
