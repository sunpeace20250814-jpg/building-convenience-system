/**
 * useAllowanceHolders — React Hook 封裝零用金持有人 + 交易
 *
 * ★ Go-style 設計：
 *   - 元件呼叫這個 hook，不直接呼叫 api.allowanceHolders
 *   - hook 內部管 loading / error / data 狀態
 *
 * 注意：
 *   這個 hook 同時管 holders 和 per-holder 的 transactions
 *   （因為後端 /api/allowance-holders/:id/transactions 是 holders 的子資源）
 *   allowance_records（V1 簡版）由獨立的 useAllowanceRecords hook 處理
 */

import { useEffect, useState, useCallback } from 'react';
import {
  allowanceHoldersApi,
  type AllowanceHolderDTO,
  type AllowanceTransactionDTO,
  type CreateAllowanceHolderInput,
  type UpdateAllowanceHolderInput,
  type CreateAllowanceTransactionInput,
} from '@/api/allowance-holders';

interface UseAllowanceHoldersState {
  holders: AllowanceHolderDTO[];
  /** 依 holderId 索引的交易紀錄 */
  transactions: Record<string, AllowanceTransactionDTO[]>;
  isLoading: boolean;
  error: string | null;
}

interface UseAllowanceHoldersActions {
  loadHolders: () => Promise<void>;
  createHolder: (data: CreateAllowanceHolderInput) => Promise<AllowanceHolderDTO>;
  updateHolder: (id: string, data: UpdateAllowanceHolderInput) => Promise<AllowanceHolderDTO>;
  deleteHolder: (id: string) => Promise<void>;
  loadTransactions: (holderId: string) => Promise<AllowanceTransactionDTO[]>;
  addTransaction: (
    holderId: string,
    data: CreateAllowanceTransactionInput,
  ) => Promise<AllowanceTransactionDTO>;
}

export function useAllowanceHolders(autoLoad = true): UseAllowanceHoldersState & UseAllowanceHoldersActions {
  const [holders, setHolders] = useState<AllowanceHolderDTO[]>([]);
  const [transactions, setTransactions] = useState<Record<string, AllowanceTransactionDTO[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHolders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await allowanceHoldersApi.list();
      setHolders(data);
    } catch (e: any) {
      setError(e?.message ?? '載入失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createHolder = useCallback(async (data: CreateAllowanceHolderInput) => {
    const created = await allowanceHoldersApi.create(data);
    setHolders((prev) => [...prev, created]);
    return created;
  }, []);

  const updateHolder = useCallback(async (id: string, data: UpdateAllowanceHolderInput) => {
    const updated = await allowanceHoldersApi.update(id, data);
    setHolders((prev) => prev.map((h) => (h.id === id ? updated : h)));
    return updated;
  }, []);

  const deleteHolder = useCallback(async (id: string) => {
    await allowanceHoldersApi.remove(id);
    setHolders((prev) => prev.filter((h) => h.id !== id));
    // FK CASCADE 連帶刪除 transactions
    setTransactions((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const loadTransactions = useCallback(async (holderId: string) => {
    try {
      const data = await allowanceHoldersApi.listTransactions(holderId);
      setTransactions((prev) => ({ ...prev, [holderId]: data }));
      return data;
    } catch (e: any) {
      setError(e?.message ?? '載入失敗');
      return [];
    }
  }, []);

  const addTransaction = useCallback(
    async (holderId: string, data: CreateAllowanceTransactionInput) => {
      const created = await allowanceHoldersApi.createTransaction(holderId, data);
      // 1) 新增到 transactions map 前端
      setTransactions((prev) => ({
        ...prev,
        [holderId]: [created, ...(prev[holderId] ?? [])],
      }));
      // 2) 重新拉 holders（server 已自動重算 balance）
      try {
        const refreshed = await allowanceHoldersApi.get(holderId);
        setHolders((prev) => prev.map((h) => (h.id === holderId ? refreshed : h)));
      } catch {
        // ignore 拉取失敗不影響主流程
      }
      return created;
    },
    [],
  );

  useEffect(() => {
    if (autoLoad) void loadHolders();
  }, [autoLoad, loadHolders]);

  return {
    holders,
    transactions,
    isLoading,
    error,
    loadHolders,
    createHolder,
    updateHolder,
    deleteHolder,
    loadTransactions,
    addTransaction,
  };
}
