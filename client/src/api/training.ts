/**
 * Training API — 員工教育訓練記錄
 *
 * ★ Go-style 設計：
 *   - 前端只呼叫這些函式，不直接 queryAll SQL
 *   - 後端實作：server/src/routes/training.ts（/api/training）
 *   - 對應資料表：training_records
 *
 * 欄位（schema.ts training_records）：
 *   id, employeeId (FK), date, content, notes, createdAt
 *
 * 路由：
 *   GET    /api/training                       列出所有（依 date DESC）
 *   GET    /api/training/employee/:employeeId  依員工列出
 *   GET    /api/training/:id                   單筆
 *   POST   /api/training                       新增
 *   PUT    /api/training/:id                   更新
 *   DELETE /api/training/:id                   刪除
 */

import { apiClient } from '@/lib/apiClient';

const BASE = '/api/training';

export interface TrainingRecordDTO {
  id: string;
  employeeId: string;
  date: string;
  content: string;
  notes?: string | null;
  createdAt?: string;
}

export interface CreateTrainingRecordInput {
  employeeId: string;
  date: string;
  content: string;
  notes?: string | null;
}

export type UpdateTrainingRecordInput = Partial<CreateTrainingRecordInput>;

export const trainingApi = {
  list: () => apiClient.get<TrainingRecordDTO[]>(BASE),
  listByEmployee: (employeeId: string) =>
    apiClient.get<TrainingRecordDTO[]>(
      `${BASE}/employee/${encodeURIComponent(employeeId)}`,
    ),
  get: (id: string) =>
    apiClient.get<TrainingRecordDTO>(`${BASE}/${encodeURIComponent(id)}`),
  create: (data: CreateTrainingRecordInput) =>
    apiClient.post<TrainingRecordDTO>(BASE, data),
  update: (id: string, data: UpdateTrainingRecordInput) =>
    apiClient.put<TrainingRecordDTO>(
      `${BASE}/${encodeURIComponent(id)}`,
      data,
    ),
  remove: (id: string) =>
    apiClient.delete<{ success: boolean }>(
      `${BASE}/${encodeURIComponent(id)}`,
    ),
};
