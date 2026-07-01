/**
 * 記帳 Store - V4 API 版
 *
 * 支援：
 * - 收支記錄 (expense_records)
 * - 費用類別 (expense_categories)
 * - 月度類別預算 (expense_budget)
 * - 零用金持有人 (allowance_holders) + 交易 (allowance_transactions)
 * - 零用金紀錄 (allowance_records)
 *
 * V4 設計：所有 SQL 改走 fetch API；不依賴 sql.js WASM
 * UI 模組繼續呼叫 useExpenseStore() 取得 state + actions（介面不變）
 */

import { create } from 'zustand';
import { expensesApi } from '@/api/expenses';
import { expenseBudgetsApi } from '@/api/expense-budgets';
import { allowanceHoldersApi } from '@/api/allowance-holders';

// ============================================================================
// 型別（re-export for convenience）
// ============================================================================

export type {
  ExpenseDTO,
  ExpenseCategoryDTO,
  CreateExpenseInput,
  UpdateExpenseInput,
  CreateExpenseCategoryInput,
  UpdateExpenseCategoryInput,
} from '@/api/expenses';

export type {
  ExpenseBudgetDTO,
  CreateExpenseBudgetInput,
  UpdateExpenseBudgetInput,
} from '@/api/expense-budgets';

export type {
  AllowanceHolderDTO,
  AllowanceTransactionDTO,
  CreateAllowanceHolderInput,
  UpdateAllowanceHolderInput,
  CreateAllowanceTransactionInput,
} from '@/api/allowance-holders';

export type {
  AllowanceRecordDTO,
  CreateAllowanceRecordInput,
  UpdateAllowanceRecordInput,
} from '@/api/allowance-records';

// ============================================================================
// State shape（與舊版相同介面，方便模組直接 swap）
// ============================================================================

export interface ExpenseRecord {
  id: string;
  date: string;
  type: 'income' | 'expense';
  category?: string | null;
  categoryId?: string | null;
  amount: number;
  source?: string | null;
  paidBy?: string | null;
  item?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  sharedBy?: string | null;
  splitMethod?: string | null;
  participants?: string | null;
  description?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color?: string | null;
  sortOrder?: number;
}

export interface AllowanceHolder {
  id: string;
  name: string;
  balance?: number;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AllowanceTransaction {
  id: string;
  allowanceId: string;
  date: string;
  amount: number;
  type: 'add' | 'deduct';
  description?: string | null;
  balanceAfter: number;
  createdAt?: string;
}

export interface ExpenseBudget {
  id: string;
  categoryId: string;
  month: string;
  amount: number;
  createdAt?: string;
}

interface ExpenseState {
  expenses: ExpenseRecord[];
  categories: ExpenseCategory[];
  allowanceHolders: AllowanceHolder[];
  /**
   * 依 holderId 索引的交易紀錄
   * - 新版（allowance_transactions via /api/allowance-holders/:id/transactions）
   * - 仍保留舊的「allowanceRecords」key 以相容現有 module
   */
  allowanceRecords: Record<string, AllowanceTransaction[]>;
  budgets: ExpenseBudget[];
  isLoading: boolean;
  error: string | null;

  // ---- Records / Categories ----
  loadExpenses: () => Promise<void>;
  loadCategories: () => Promise<void>;
  createExpense: (data: Partial<ExpenseRecord>) => Promise<ExpenseRecord>;
  updateExpense: (id: string, data: Partial<ExpenseRecord>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  createCategory: (data: Partial<ExpenseCategory>) => Promise<ExpenseCategory>;
  deleteCategory: (id: string) => Promise<void>;

  // ---- Allowance Holders + Transactions ----
  loadAllowanceHolders: () => Promise<void>;
  createAllowanceHolder: (data: Partial<AllowanceHolder>) => Promise<AllowanceHolder>;
  updateAllowanceHolder: (id: string, data: Partial<AllowanceHolder>) => Promise<void>;
  deleteAllowanceHolder: (id: string) => Promise<void>;
  loadAllowanceRecords: (holderId: string) => Promise<void>;
  addAllowanceRecord: (
    holderId: string,
    data: { type: 'add' | 'deduct'; amount: number; date: string; notes?: string },
  ) => Promise<void>;

  // ---- Budget ----
  loadBudgets: (month?: string) => Promise<void>;
  createBudget: (data: Partial<ExpenseBudget>) => Promise<ExpenseBudget>;
  updateBudget: (id: string, data: Partial<ExpenseBudget>) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
}

// ============================================================================
// Store 實作（直接呼叫 API client，不經 React hook）
// ============================================================================

export const useExpenseStore = create<ExpenseState>((set) => ({
  expenses: [],
  categories: [],
  allowanceHolders: [],
  allowanceRecords: {},
  budgets: [],
  isLoading: false,
  error: null,

  // ============================================================
  // Expense Records
  // ============================================================

  loadExpenses: async () => {
    set({ isLoading: true, error: null });
    try {
      const expenses = await expensesApi.list();
      set({ expenses, isLoading: false });
    } catch (err: any) {
      set({ error: err?.message ?? '載入失敗', isLoading: false });
    }
  },

  loadCategories: async () => {
    try {
      const categories = await expensesApi.listCategories();
      set({ categories });
    } catch (err: any) {
      set({ error: err?.message ?? '載入失敗' });
    }
  },

  createExpense: async (data) => {
    const created = await expensesApi.create({
      date: data.date!,
      type: data.type!,
      amount: data.amount!,
      category: data.category ?? undefined,
      categoryId: data.categoryId ?? undefined,
      source: data.source ?? undefined,
      paidBy: data.paidBy ?? undefined,
      item: data.item ?? undefined,
      quantity: data.quantity ?? undefined,
      unitPrice: data.unitPrice ?? undefined,
      sharedBy: data.sharedBy ?? undefined,
      splitMethod: (data.splitMethod as 'equal' | 'by_count' | 'manual' | undefined) ?? undefined,
      participants: data.participants ?? undefined,
      description: data.description ?? undefined,
      notes: data.notes ?? undefined,
    });
    set((state) => ({ expenses: [created, ...state.expenses] }));
    return created as ExpenseRecord;
  },

  updateExpense: async (id, data) => {
    const updated = await expensesApi.update(id, {
      date: data.date,
      type: data.type,
      amount: data.amount,
      category: data.category ?? undefined,
      categoryId: data.categoryId ?? undefined,
      source: data.source ?? undefined,
      paidBy: data.paidBy ?? undefined,
      item: data.item ?? undefined,
      quantity: data.quantity ?? undefined,
      unitPrice: data.unitPrice ?? undefined,
      sharedBy: data.sharedBy ?? undefined,
      splitMethod: (data.splitMethod as 'equal' | 'by_count' | 'manual' | undefined) ?? undefined,
      participants: data.participants ?? undefined,
      description: data.description ?? undefined,
      notes: data.notes ?? undefined,
    });
    set((state) => ({
      expenses: state.expenses.map((e) => (e.id === id ? updated : e)),
    }));
  },

  deleteExpense: async (id) => {
    await expensesApi.remove(id);
    set((state) => ({ expenses: state.expenses.filter((e) => e.id !== id) }));
  },

  createCategory: async (data) => {
    const created = await expensesApi.createCategory({
      name: data.name!,
      type: data.type!,
      color: data.color ?? undefined,
      sortOrder: data.sortOrder,
    });
    set((state) => ({ categories: [...state.categories, created as ExpenseCategory] }));
    return created as ExpenseCategory;
  },

  deleteCategory: async (id) => {
    await expensesApi.removeCategory(id);
    set((state) => ({ categories: state.categories.filter((c) => c.id !== id) }));
  },

  // ============================================================
  // Allowance Holders + Transactions
  // ============================================================

  loadAllowanceHolders: async () => {
    try {
      const list = await allowanceHoldersApi.list();
      set({ allowanceHolders: list as AllowanceHolder[] });
    } catch (err: any) {
      set({ error: err?.message ?? '載入失敗' });
    }
  },

  createAllowanceHolder: async (data) => {
    const created = await allowanceHoldersApi.create({
      name: data.name!,
      balance: data.balance,
      notes: data.notes ?? undefined,
    });
    set((state) => ({
      allowanceHolders: [...state.allowanceHolders, created as AllowanceHolder],
    }));
    return created as AllowanceHolder;
  },

  updateAllowanceHolder: async (id, data) => {
    const updated = await allowanceHoldersApi.update(id, {
      name: data.name,
      balance: data.balance,
      notes: data.notes ?? undefined,
    });
    set((state) => ({
      allowanceHolders: state.allowanceHolders.map((h) =>
        h.id === id ? (updated as AllowanceHolder) : h,
      ),
    }));
  },

  deleteAllowanceHolder: async (id) => {
    await allowanceHoldersApi.remove(id);
    set((state) => ({
      allowanceHolders: state.allowanceHolders.filter((h) => h.id !== id),
      allowanceRecords: Object.fromEntries(
        Object.entries(state.allowanceRecords).filter(([k]) => k !== id),
      ),
    }));
  },

  loadAllowanceRecords: async (holderId) => {
    try {
      const records = await allowanceHoldersApi.listTransactions(holderId);
      set((state) => ({
        allowanceRecords: {
          ...state.allowanceRecords,
          [holderId]: records as AllowanceTransaction[],
        },
      }));
    } catch (err: any) {
      set({ error: err?.message ?? '載入失敗' });
    }
  },

  addAllowanceRecord: async (holderId, data) => {
    const created = await allowanceHoldersApi.createTransaction(holderId, {
      date: data.date,
      amount: data.amount,
      type: data.type,
      description: data.notes,
    });
    // 1) 新增到 transactions map
    set((state) => ({
      allowanceRecords: {
        ...state.allowanceRecords,
        [holderId]: [created as AllowanceTransaction, ...(state.allowanceRecords[holderId] ?? [])],
      },
    }));
    // 2) 重新拉 holder（server 已自動重算 balance）
    try {
      const refreshed = await allowanceHoldersApi.get(holderId);
      set((state) => ({
        allowanceHolders: state.allowanceHolders.map((h) =>
          h.id === holderId ? (refreshed as AllowanceHolder) : h,
        ),
      }));
    } catch {
      // ignore 拉取失敗不影響主流程
    }
  },

  // ============================================================
  // Budget
  // ============================================================

  loadBudgets: async (month) => {
    try {
      const list = month
        ? await expenseBudgetsApi.listByMonth(month)
        : await expenseBudgetsApi.list();
      set({ budgets: list as ExpenseBudget[] });
    } catch (err: any) {
      set({ error: err?.message ?? '載入失敗' });
    }
  },

  createBudget: async (data) => {
    const created = await expenseBudgetsApi.create({
      categoryId: data.categoryId!,
      month: data.month!,
      amount: data.amount!,
    });
    set((state) => {
      // (categoryId, month) UNIQUE — 同組合時替換
      const others = state.budgets.filter(
        (b) => !(b.categoryId === data.categoryId && b.month === data.month),
      );
      return { budgets: [...others, created as ExpenseBudget] };
    });
    return created as ExpenseBudget;
  },

  updateBudget: async (id, data) => {
    const updated = await expenseBudgetsApi.update(id, {
      categoryId: data.categoryId,
      month: data.month,
      amount: data.amount,
    });
    set((state) => ({
      budgets: state.budgets.map((b) => (b.id === id ? (updated as ExpenseBudget) : b)),
    }));
  },

  deleteBudget: async (id) => {
    await expenseBudgetsApi.remove(id);
    set((state) => ({ budgets: state.budgets.filter((b) => b.id !== id) }));
  },
}));
