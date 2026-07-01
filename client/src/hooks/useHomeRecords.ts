/**
 * useHomeRecords — React Hook 封裝 home_records 資料讀取 + CRUD
 *
 * 對應 api/home-records.ts
 */

import { useEffect, useState, useCallback } from 'react';
import {
  homeRecordsApi,
  type HomeRecordDTO,
  type CreateHomeRecordInput,
  type UpdateHomeRecordInput,
} from '@/api/home-records';

interface UseHomeRecordsState {
  records: HomeRecordDTO[];
  isLoading: boolean;
  error: string | null;
}

interface UseHomeRecordsActions {
  load: () => Promise<void>;
  loadByTab: (tabId: string) => Promise<HomeRecordDTO[]>;
  create: (data: CreateHomeRecordInput) => Promise<HomeRecordDTO>;
  update: (id: string, data: UpdateHomeRecordInput) => Promise<HomeRecordDTO>;
  remove: (id: string) => Promise<void>;
}

export function useHomeRecords(autoLoad = true): UseHomeRecordsState & UseHomeRecordsActions {
  const [records, setRecords] = useState<HomeRecordDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await homeRecordsApi.list();
      setRecords(data);
    } catch (e: any) {
      setError(e?.message ?? '載入失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadByTab = useCallback(async (tabId: string) => {
    return homeRecordsApi.listByTab(tabId);
  }, []);

  const create = useCallback(async (data: CreateHomeRecordInput) => {
    const created = await homeRecordsApi.create(data);
    setRecords((prev) => [created, ...prev]);
    return created;
  }, []);

  const update = useCallback(async (id: string, data: UpdateHomeRecordInput) => {
    const updated = await homeRecordsApi.update(id, data);
    setRecords((prev) => prev.map((r) => (r.id === id ? updated : r)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await homeRecordsApi.remove(id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }, []);

  useEffect(() => {
    if (autoLoad) void load();
  }, [autoLoad, load]);

  return { records, isLoading, error, load, loadByTab, create, update, remove };
}
