/**
 * useStatusOptions — React Hook 封裝 status_options 資料讀取 + CRUD
 *
 * 對應 api/status-options.ts
 */

import { useEffect, useState, useCallback } from 'react';
import {
  statusOptionsApi,
  type StatusOptionDTO,
  type CreateStatusOptionInput,
  type UpdateStatusOptionInput,
} from '@/api/status-options';

interface UseStatusOptionsState {
  statusOptions: StatusOptionDTO[];
  isLoading: boolean;
  error: string | null;
}

interface UseStatusOptionsActions {
  load: (type?: 'resident' | 'parking') => Promise<void>;
  create: (data: CreateStatusOptionInput) => Promise<StatusOptionDTO>;
  update: (id: string, data: UpdateStatusOptionInput) => Promise<StatusOptionDTO>;
  remove: (id: string) => Promise<void>;
}

export function useStatusOptions(autoLoad = true): UseStatusOptionsState & UseStatusOptionsActions {
  const [statusOptions, setStatusOptions] = useState<StatusOptionDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (type?: 'resident' | 'parking') => {
    setIsLoading(true);
    setError(null);
    try {
      const data = type ? await statusOptionsApi.listByType(type) : await statusOptionsApi.list();
      setStatusOptions(data);
    } catch (e: any) {
      setError(e?.message ?? '載入狀態選項失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const create = useCallback(async (data: CreateStatusOptionInput) => {
    const created = await statusOptionsApi.create(data);
    setStatusOptions((prev) => [...prev, created]);
    return created;
  }, []);

  const update = useCallback(async (id: string, data: UpdateStatusOptionInput) => {
    const updated = await statusOptionsApi.update(id, data);
    setStatusOptions((prev) => prev.map((s) => (s.id === id ? updated : s)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await statusOptionsApi.remove(id);
    setStatusOptions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  useEffect(() => {
    if (autoLoad) void load();
  }, [autoLoad, load]);

  return { statusOptions, isLoading, error, load, create, update, remove };
}