/**
 * useAllowanceRecords — React Hook 封裝零用金紀錄（V1 簡版）
 *
 * ★ Go-style 設計：
 *   - 元件呼叫這個 hook，不直接呼叫 api.allowanceRecords
 *
 * 注意：
 *   這是 V1 的 allowance_records 表，server 端用 allowance_records route
 *   （V4 較詳列的 allowance_transactions 走 allowance-holders 的子端點）
 */

import { useEffect, useState, useCallback } from 'react';
import {
  allowanceRecordsApi,
  type AllowanceRecordDTO,
  type CreateAllowanceRecordInput,
  type UpdateAllowanceRecordInput,
} from '@/api/allowance-records';

interface UseAllowanceRecordsState {
  records: AllowanceRecordDTO[];
  isLoading: boolean;
  error: string | null;
}

interface UseAllowanceRecordsActions {
  loadRecords: (holderId?: string) => Promise<void>;
  createRecord: (data: CreateAllowanceRecordInput) => Promise<AllowanceRecordDTO>;
  updateRecord: (id: string, data: UpdateAllowanceRecordInput) => Promise<AllowanceRecordDTO>;
  deleteRecord: (id: string) => Promise<void>;
}

export function useAllowanceRecords(autoLoad = true): UseAllowanceRecordsState & UseAllowanceRecordsActions {
  const [records, setRecords] = useState<AllowanceRecordDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRecords = useCallback(async (holderId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = holderId
        ? await allowanceRecordsApi.listByHolder(holderId)
        : await allowanceRecordsApi.list();
      setRecords(data);
    } catch (e: any) {
      setError(e?.message ?? '載入失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createRecord = useCallback(async (data: CreateAllowanceRecordInput) => {
    const created = await allowanceRecordsApi.create(data);
    setRecords((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateRecord = useCallback(async (id: string, data: UpdateAllowanceRecordInput) => {
    const updated = await allowanceRecordsApi.update(id, data);
    setRecords((prev) => prev.map((r) => (r.id === id ? updated : r)));
    return updated;
  }, []);

  const deleteRecord = useCallback(async (id: string) => {
    await allowanceRecordsApi.remove(id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }, []);

  useEffect(() => {
    if (autoLoad) void loadRecords();
  }, [autoLoad, loadRecords]);

  return {
    records,
    isLoading,
    error,
    loadRecords,
    createRecord,
    updateRecord,
    deleteRecord,
  };
}
