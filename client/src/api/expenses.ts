/**
 * Expenses API — 收支記錄 + 費用類別
 *
 * ★ Go-style 設計：
 *   - 前端只呼叫這些函式，不直接 queryAll SQL
 *   - 後端實作：server/src/routes/expenses.ts（/api/expenses）
 *   - 加新欄位 → 後端 repository → 後端 schema → 前端 ExpenseDTO type 同步更新
 *
 * 路由（含 categories 子路徑）：
 *   GET    /api/expenses                  列出所有
 *   GET    /api/expenses/range?start=&end=  依日期區間
 *   GET    /api/expenses/:id              單筆
 *   POST   /api/expenses                  新增
 *   PUT    /api/expenses/:id              更新
 *   DELETE /api/expenses/:id              刪除
 *
 *   GET    /api/expenses/categories            列出所有類別
 *   GET    /api/expenses/categories/type/:type 依類型
 *   GET    /api/expenses/categories/:id        單筆
 *   POST   /api/expenses/categories            新增
 *   PUT    /api/expenses/categories/:id        更新
 *   DELETE /api/expenses/categories/:id        刪除
 */

import { apiClient } from '@/lib/apiClient';

// ============================================================================
// Expense Record DTO
// ============================================================================

export interface ExpenseDTO {
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
  splitMethod?: 'equal' | 'by_count' | 'manual' | null;
  participants?: string | null;
  description?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateExpenseInput {
  date: string;
  type: 'income' | 'expense';
  amount: number;
  category?: string;
  categoryId?: string;
  source?: string;
  paidBy?: string;
  item?: string;
  quantity?: number;
  unitPrice?: number;
  sharedBy?: string;
  splitMethod?: 'equal' | 'by_count' | 'manual';
  participants?: string;
  description?: string;
  notes?: string;
}

export type UpdateExpenseInput = Partial<CreateExpenseInput>;

// ============================================================================
// Expense Category DTO
// ============================================================================

export interface ExpenseCategoryDTO {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color?: string | null;
  sortOrder?: number;
}

export interface CreateExpenseCategoryInput {
  name: string;
  type: 'income' | 'expense';
  color?: string;
  sortOrder?: number;
}

export type UpdateExpenseCategoryInput = Partial<CreateExpenseCategoryInput>;

// ============================================================================
// API
// ============================================================================

export const expensesApi = {
  // ----- Records -----
  list: () => apiClient.get<ExpenseDTO[]>('/api/expenses'),
  listByRange: (start: string, end: string) =>
    apiClient.get<ExpenseDTO[]>('/api/expenses/range', {
      params: { start, end },
    }),
  get: (id: string) =>
    apiClient.get<ExpenseDTO>(`/api/expenses/${encodeURIComponent(id)}`),
  create: (data: CreateExpenseInput) =>
    apiClient.post<ExpenseDTO>('/api/expenses', data),
  update: (id: string, data: UpdateExpenseInput) =>
    apiClient.put<ExpenseDTO>(`/api/expenses/${encodeURIComponent(id)}`, data),
  remove: (id: string) =>
    apiClient.delete<{ success: boolean }>(
      `/api/expenses/${encodeURIComponent(id)}`,
    ),

  // ----- Categories -----
  listCategories: () =>
    apiClient.get<ExpenseCategoryDTO[]>('/api/expenses/categories'),
  listCategoriesByType: (type: 'income' | 'expense') =>
    apiClient.get<ExpenseCategoryDTO[]>(
      `/api/expenses/categories/type/${type}`,
    ),
  getCategory: (id: string) =>
    apiClient.get<ExpenseCategoryDTO>(
      `/api/expenses/categories/${encodeURIComponent(id)}`,
    ),
  createCategory: (data: CreateExpenseCategoryInput) =>
    apiClient.post<ExpenseCategoryDTO>('/api/expenses/categories', data),
  updateCategory: (id: string, data: UpdateExpenseCategoryInput) =>
    apiClient.put<ExpenseCategoryDTO>(
      `/api/expenses/categories/${encodeURIComponent(id)}`,
      data,
    ),
  removeCategory: (id: string) =>
    apiClient.delete<{ success: boolean }>(
      `/api/expenses/categories/${encodeURIComponent(id)}`,
    ),
};
