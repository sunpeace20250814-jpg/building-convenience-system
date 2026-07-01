/**
 * Allowance Holders API — 零用金持有人
 *
 * ★ Go-style 設計：
 *   - 前端只呼叫這些函式，不直接 queryAll SQL
 *   - 後端實作：server/src/routes/allowance-holders.ts（/api/allowance-holders）
 *
 * 對應資料表：allowance_holders
 *   id, name, balance, notes, createdAt, updatedAt
 *
 * 路由：
 *   GET    /api/allowance-holders                    列出所有
 *   GET    /api/allowance-holders/:id                單筆
 *   POST   /api/allowance-holders                    新增
 *   PUT    /api/allowance-holders/:id                更新
 *   DELETE /api/allowance-holders/:id                刪除（FK CASCADE 連帶刪 transactions）
 *   GET    /api/allowance-holders/:id/transactions   該持有人所有交易
 *   POST   /api/allowance-holders/:id/transactions   新增交易（自動重算 balance）
 */

import { apiClient } from '@/lib/apiClient';

// ============================================================================
// Allowance Holder DTO
// ============================================================================

export interface AllowanceHolderDTO {
  id: string;
  name: string;
  balance?: number;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateAllowanceHolderInput {
  name: string;
  balance?: number;
  notes?: string;
}

export type UpdateAllowanceHolderInput = Partial<CreateAllowanceHolderInput>;

// ============================================================================
// Allowance Transaction DTO（V4 詳列版，含 description）
// ============================================================================

export interface AllowanceTransactionDTO {
  id: string;
  allowanceId: string;
  date: string;
  amount: number;
  type: 'add' | 'deduct';
  description?: string | null;
  balanceAfter: number;
  createdAt?: string;
}

export interface CreateAllowanceTransactionInput {
  date: string;
  amount: number;
  type: 'add' | 'deduct';
  description?: string;
}

// ============================================================================
// API
// ============================================================================

export const allowanceHoldersApi = {
  // ----- Holders -----
  list: () =>
    apiClient.get<AllowanceHolderDTO[]>('/api/allowance-holders'),
  get: (id: string) =>
    apiClient.get<AllowanceHolderDTO>(
      `/api/allowance-holders/${encodeURIComponent(id)}`,
    ),
  create: (data: CreateAllowanceHolderInput) =>
    apiClient.post<AllowanceHolderDTO>('/api/allowance-holders', data),
  update: (id: string, data: UpdateAllowanceHolderInput) =>
    apiClient.put<AllowanceHolderDTO>(
      `/api/allowance-holders/${encodeURIComponent(id)}`,
      data,
    ),
  remove: (id: string) =>
    apiClient.delete<{ success: boolean }>(
      `/api/allowance-holders/${encodeURIComponent(id)}`,
    ),

  // ----- Transactions (sub-resource) -----
  listTransactions: (holderId: string) =>
    apiClient.get<AllowanceTransactionDTO[]>(
      `/api/allowance-holders/${encodeURIComponent(holderId)}/transactions`,
    ),
  createTransaction: (
    holderId: string,
    data: CreateAllowanceTransactionInput,
  ) =>
    apiClient.post<AllowanceTransactionDTO>(
      `/api/allowance-holders/${encodeURIComponent(holderId)}/transactions`,
      data,
    ),
};
