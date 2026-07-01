/**
 * useExpenses — React Hook 封裝 expenses（records + categories）
 *
 * ★ Go-style 設計：
 *   - 元件呼叫這個 hook，不直接呼叫 api.expenses
 *   - hook 內部管 loading / error / data 狀態
 */

import { useEffect, useState, useCallback } from 'react';
import {
  expensesApi,
  type ExpenseDTO,
  type ExpenseCategoryDTO,
  type CreateExpenseInput,
  type UpdateExpenseInput,
  type CreateExpenseCategoryInput,
  type UpdateExpenseCategoryInput,
} from '@/api/expenses';

interface UseExpensesState {
  expenses: ExpenseDTO[];
  categories: ExpenseCategoryDTO[];
  isLoading: boolean;
  error: string | null;
}

interface UseExpensesActions {
  loadExpenses: () => Promise<void>;
  loadCategories: () => Promise<void>;
  createExpense: (data: CreateExpenseInput) => Promise<ExpenseDTO>;
  updateExpense: (id: string, data: UpdateExpenseInput) => Promise<ExpenseDTO>;
  deleteExpense: (id: string) => Promise<void>;
  createCategory: (data: CreateExpenseCategoryInput) => Promise<ExpenseCategoryDTO>;
  updateCategory: (id: string, data: UpdateExpenseCategoryInput) => Promise<ExpenseCategoryDTO>;
  deleteCategory: (id: string) => Promise<void>;
}

export function useExpenses(autoLoad = true): UseExpensesState & UseExpensesActions {
  const [expenses, setExpenses] = useState<ExpenseDTO[]>([]);
  const [categories, setCategories] = useState<ExpenseCategoryDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadExpenses = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await expensesApi.list();
      setExpenses(data);
    } catch (e: any) {
      setError(e?.message ?? '載入失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    setError(null);
    try {
      const data = await expensesApi.listCategories();
      setCategories(data);
    } catch (e: any) {
      setError(e?.message ?? '載入失敗');
    }
  }, []);

  const createExpense = useCallback(async (data: CreateExpenseInput) => {
    const created = await expensesApi.create(data);
    setExpenses((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateExpense = useCallback(async (id: string, data: UpdateExpenseInput) => {
    const updated = await expensesApi.update(id, data);
    setExpenses((prev) => prev.map((e) => (e.id === id ? updated : e)));
    return updated;
  }, []);

  const deleteExpense = useCallback(async (id: string) => {
    await expensesApi.remove(id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const createCategory = useCallback(async (data: CreateExpenseCategoryInput) => {
    const created = await expensesApi.createCategory(data);
    setCategories((prev) => [...prev, created]);
    return created;
  }, []);

  const updateCategory = useCallback(
    async (id: string, data: UpdateExpenseCategoryInput) => {
      const updated = await expensesApi.updateCategory(id, data);
      setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
      return updated;
    },
    [],
  );

  const deleteCategory = useCallback(async (id: string) => {
    await expensesApi.removeCategory(id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }, []);

  useEffect(() => {
    if (autoLoad) {
      void loadExpenses();
      void loadCategories();
    }
  }, [autoLoad, loadExpenses, loadCategories]);

  return {
    expenses,
    categories,
    isLoading,
    error,
    loadExpenses,
    loadCategories,
    createExpense,
    updateExpense,
    deleteExpense,
    createCategory,
    updateCategory,
    deleteCategory,
  };
}
