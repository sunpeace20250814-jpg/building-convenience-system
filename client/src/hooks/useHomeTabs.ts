/**
 * useHomeTabs — React Hook 封裝 home_tabs 資料讀取 + CRUD
 *
 * 對應 api/home-tabs.ts
 */

import { useEffect, useState, useCallback } from 'react';
import {
  homeTabsApi,
  type HomeTabDTO,
  type CreateHomeTabInput,
  type UpdateHomeTabInput,
} from '@/api/home-tabs';

interface UseHomeTabsState {
  tabs: HomeTabDTO[];
  isLoading: boolean;
  error: string | null;
}

interface UseHomeTabsActions {
  load: () => Promise<void>;
  create: (data: CreateHomeTabInput) => Promise<HomeTabDTO>;
  update: (id: string, data: UpdateHomeTabInput) => Promise<HomeTabDTO>;
  remove: (id: string) => Promise<void>;
}

export function useHomeTabs(autoLoad = true): UseHomeTabsState & UseHomeTabsActions {
  const [tabs, setTabs] = useState<HomeTabDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await homeTabsApi.list();
      setTabs(data);
    } catch (e: any) {
      setError(e?.message ?? '載入失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const create = useCallback(async (data: CreateHomeTabInput) => {
    const created = await homeTabsApi.create(data);
    setTabs((prev) => [...prev, created]);
    return created;
  }, []);

  const update = useCallback(async (id: string, data: UpdateHomeTabInput) => {
    const updated = await homeTabsApi.update(id, data);
    setTabs((prev) => prev.map((t) => (t.id === id ? updated : t)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await homeTabsApi.remove(id);
    setTabs((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (autoLoad) void load();
  }, [autoLoad, load]);

  return { tabs, isLoading, error, load, create, update, remove };
}
