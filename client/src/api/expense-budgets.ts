/**
 * Expense Budgets API — 月度類別預算
 *
 * ★ Go-style 設計：
 *   - 前端只呼叫這些函式，不直接 queryAll SQL
 *   - 後端實作：server/src/routes/expense-budgets.ts（/api/expense-budgets）
 *
 * 對應資料表：expense_budget
 *   id, categoryId, month (YYYY-MM), amount, createdAt
 *   UNIQUE(categoryId, month)
 *
 * 路由：
 *   GET    /api/expense-budgets            列出所有
 *   GET    /api/expense-budgets/month/:month 依月份（YYYY-MM）
 *   GET    /api/expense-budgets/:id        單筆
 *   POST   /api/expense-budgets            新增
 *   PUT    /api/expense-budgets/:id        更新
 *   DELETE /api/expense-budgets/:id        刪除
 */

import { apiClient } from '@/lib/apiClient';

export interface ExpenseBudgetDTO {
  id: string;
  categoryId: string;
  month: string; // YYYY-MM
  amount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateExpenseBudgetInput {
  categoryId: string;
  month: string; // YYYY-MM
  amount: number;
}

export type UpdateExpenseBudgetInput = Partial<CreateExpenseBudgetInput>;

export const expenseBudgetsApi = {
  list: () => apiClient.get<ExpenseBudgetDTO[]>('/api/expense-budgets'),
  listByMonth: (month: string) =>
    apiClient.get<ExpenseBudgetDTO[]>('/api/expense-budgets/month/' + month),
  get: (id: string) =>
    apiClient.get<ExpenseBudgetDTO>(
      `/api/expense-budgets/${encodeURIComponent(id)}`,
    ),
  create: (data: CreateExpenseBudgetInput) =>
    apiClient.post<ExpenseBudgetDTO>('/api/expense-budgets', data),
  update: (id: string, data: UpdateExpenseBudgetInput) =>
    apiClient.put<ExpenseBudgetDTO>(
      `/api/expense-budgets/${encodeURIComponent(id)}`,
      data,
    ),
  remove: (id: string) =>
    apiClient.delete<{ success: boolean }>(
      `/api/expense-budgets/${encodeURIComponent(id)}`,
    ),
};
