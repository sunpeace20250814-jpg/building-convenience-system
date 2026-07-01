/**
 * useExpenseBudgets — React Hook 封裝月度類別預算
 *
 * ★ Go-style 設計：
 *   - 元件呼叫這個 hook，不直接呼叫 api.expenseBudgets
 *   - hook 內部管 loading / error / data 狀態
 */

import { useEffect, useState, useCallback } from 'react';
import {
  expenseBudgetsApi,
  type ExpenseBudgetDTO,
  type CreateExpenseBudgetInput,
  type UpdateExpenseBudgetInput,
} from '@/api/expense-budgets';

interface UseExpenseBudgetsState {
  budgets: ExpenseBudgetDTO[];
  isLoading: boolean;
  error: string | null;
}

interface UseExpenseBudgetsActions {
  loadBudgets: (month?: string) => Promise<void>;
  createBudget: (data: CreateExpenseBudgetInput) => Promise<ExpenseBudgetDTO>;
  updateBudget: (id: string, data: UpdateExpenseBudgetInput) => Promise<ExpenseBudgetDTO>;
  deleteBudget: (id: string) => Promise<void>;
}

export function useExpenseBudgets(autoLoad = true): UseExpenseBudgetsState & UseExpenseBudgetsActions {
  const [budgets, setBudgets] = useState<ExpenseBudgetDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBudgets = useCallback(async (month?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = month
        ? await expenseBudgetsApi.listByMonth(month)
        : await expenseBudgetsApi.list();
      setBudgets(data);
    } catch (e: any) {
      setError(e?.message ?? '載入失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createBudget = useCallback(async (data: CreateExpenseBudgetInput) => {
    const created = await expenseBudgetsApi.create(data);
    setBudgets((prev) => {
      // (categoryId, month) UNIQUE — 同組合時替換
      const filtered = prev.filter(
        (b) => !(b.categoryId === data.categoryId && b.month === data.month),
      );
      return [...filtered, created];
    });
    return created;
  }, []);

  const updateBudget = useCallback(async (id: string, data: UpdateExpenseBudgetInput) => {
    const updated = await expenseBudgetsApi.update(id, data);
    setBudgets((prev) => prev.map((b) => (b.id === id ? updated : b)));
    return updated;
  }, []);

  const deleteBudget = useCallback(async (id: string) => {
    await expenseBudgetsApi.remove(id);
    setBudgets((prev) => prev.filter((b) => b.id !== id));
  }, []);

  useEffect(() => {
    if (autoLoad) void loadBudgets();
  }, [autoLoad, loadBudgets]);

  return {
    budgets,
    isLoading,
    error,
    loadBudgets,
    createBudget,
    updateBudget,
    deleteBudget,
  };
}
