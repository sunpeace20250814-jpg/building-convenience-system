/**
 * Allowance Records API — 零用金紀錄（V1 簡版，balance_after 由 server 計算）
 *
 * ★ Go-style 設計：
 *   - 前端只呼叫這些函式，不直接 queryAll SQL
 *   - 後端實作：server/src/routes/allowance-records.ts（/api/allowance-records）
 *
 * 對應資料表：allowance_records（注意：V4 也存在 allowance_transactions，
 * 那邊由 allowance-holders.ts 的 transactions 子端點對應）
 *
 * 欄位（schema.ts allowance_records）：
 *   id, allowanceId (FK), date, amount, type, balanceAfter, notes, createdAt
 *
 * 路由：
 *   GET    /api/allowance-records                       列出所有
 *   GET    /api/allowance-records/holder/:holderId     依持有人列出
 *   GET    /api/allowance-records/:id                   單筆
 *   POST   /api/allowance-records                       新增
 *   PUT    /api/allowance-records/:id                   更新
 *   DELETE /api/allowance-records/:id                   刪除
 */

import { apiClient } from '@/lib/apiClient';

export interface AllowanceRecordDTO {
  id: string;
  allowanceId: string;
  date: string;
  amount: number;
  type: 'add' | 'deduct';
  balanceAfter: number;
  notes?: string | null;
  createdAt?: string;
}

export interface CreateAllowanceRecordInput {
  allowanceId: string;
  date: string;
  amount: number;
  type: 'add' | 'deduct';
  balanceAfter: number;
  notes?: string;
}

export type UpdateAllowanceRecordInput = Partial<
  Omit<CreateAllowanceRecordInput, 'allowanceId'>
>;

export const allowanceRecordsApi = {
  list: () =>
    apiClient.get<AllowanceRecordDTO[]>('/api/allowance-records'),
  listByHolder: (holderId: string) =>
    apiClient.get<AllowanceRecordDTO[]>(
      `/api/allowance-records/holder/${encodeURIComponent(holderId)}`,
    ),
  get: (id: string) =>
    apiClient.get<AllowanceRecordDTO>(
      `/api/allowance-records/${encodeURIComponent(id)}`,
    ),
  create: (data: CreateAllowanceRecordInput) =>
    apiClient.post<AllowanceRecordDTO>('/api/allowance-records', data),
  update: (id: string, data: UpdateAllowanceRecordInput) =>
    apiClient.put<AllowanceRecordDTO>(
      `/api/allowance-records/${encodeURIComponent(id)}`,
      data,
    ),
  remove: (id: string) =>
    apiClient.delete<{ success: boolean }>(
      `/api/allowance-records/${encodeURIComponent(id)}`,
    ),
};
