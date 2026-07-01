/**
 * useResidents — React Hook 封裝 residents 資料讀取 + CRUD
 *
 * ★ Go-style 設計：
 *   - 元件呼叫這個 hook，不直接呼叫 api.residents
 *   - hook 內部管 loading / error / data 狀態
 *   - 之後若改用 React Query / SWR 只要改這個檔
 *
 * 注意：members / keycards / emergency_contacts / parking / decoration_records
 *   都是住戶的子資源，由獨立的 store 或 hook 管理，本 hook 只管 residents 主表。
 */

import { useEffect, useState, useCallback } from 'react';
import {
  residentsApi,
  type ResidentDTO,
  type CreateResidentInput,
  type UpdateResidentInput,
} from '@/api/residents';

interface UseResidentsState {
  residents: ResidentDTO[];
  isLoading: boolean;
  error: string | null;
}

interface UseResidentsActions {
  load: () => Promise<void>;
  create: (data: CreateResidentInput) => Promise<ResidentDTO>;
  update: (id: string, data: UpdateResidentInput) => Promise<ResidentDTO>;
  remove: (id: string) => Promise<void>;
  /** 關鍵字搜尋（會覆寫 residents 狀態；如要保留原狀請直接用 residentsApi.search()） */
  search: (q: string) => Promise<void>;
  /** 依建築物取（會覆寫 residents 狀態） */
  loadByBuilding: (buildingId: string) => Promise<void>;
}

export function useResidents(autoLoad = true): UseResidentsState & UseResidentsActions {
  const [residents, setResidents] = useState<ResidentDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await residentsApi.list();
      setResidents(data);
    } catch (e: any) {
      setError(e?.message ?? '載入失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const create = useCallback(async (data: CreateResidentInput) => {
    const created = await residentsApi.create(data);
    setResidents((prev) => [...prev, created]);
    return created;
  }, []);

  const update = useCallback(async (id: string, data: UpdateResidentInput) => {
    const updated = await residentsApi.update(id, data);
    setResidents((prev) => prev.map((r) => (r.id === id ? updated : r)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await residentsApi.remove(id);
    setResidents((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const search = useCallback(async (q: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await residentsApi.search(q);
      setResidents(data);
    } catch (e: any) {
      setError(e?.message ?? '搜尋失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadByBuilding = useCallback(async (buildingId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await residentsApi.listByBuilding(buildingId);
      setResidents(data);
    } catch (e: any) {
      setError(e?.message ?? '載入失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoLoad) void load();
  }, [autoLoad, load]);

  return {
    residents,
    isLoading,
    error,
    load,
    create,
    update,
    remove,
    search,
    loadByBuilding,
  };
}