/**
 * Schedule Notes API — 個人筆記/待辦/日記（calendar module 使用）
 *
 * ★ Go-style 設計：
 *   - 前端只呼叫這些函式，不直接 queryAll SQL
 *   - 後端對應：server/src/db/schema.ts (schedule_notes)
 *   - 對應 client 端：client/src/storage/schema.ts (schedule_notes)
 *
 * 注意：V4 server 目前尚未為 schedule_notes 提供獨立 route
 * （repository 有但 routes/schedule-notes.ts 還沒建）。本檔定義的是
 * 「contract」 — 等 server route 補上後即可直接連通。
 * 路徑約定為 /api/schedule-notes（與其他子資源保持 kebab-case 一致）。
 *
 * 欄位（schema schedule_notes — 含 v1.3 ALTER 加的 type/color/is_done）：
 *   id, date (UNIQUE), type ('note' | 'todo' | 'diary'),
 *   content, color, isDone (0/1), updatedAt
 *
 * 路由（預期對應 server route，可由本次 task 之外的 sibling 補上）：
 *   GET    /api/schedule-notes           列出所有（依 date DESC, updated_at DESC）
 *   GET    /api/schedule-notes/:id        單筆
 *   POST   /api/schedule-notes            新增
 *   PUT    /api/schedule-notes/:id        更新
 *   DELETE /api/schedule-notes/:id        刪除
 */

import { apiClient } from '@/lib/apiClient';

const BASE = '/api/schedule-notes';

export type ScheduleNoteType = 'note' | 'todo' | 'diary';

export interface ScheduleNoteDTO {
  id: string;
  date: string;
  type: ScheduleNoteType;
  content: string;
  color: string;
  isDone: number; // 0 | 1
  updatedAt: string;
}

export interface CreateScheduleNoteInput {
  date: string;
  type: ScheduleNoteType;
  content: string;
  color: string;
  isDone?: boolean;
}

export type UpdateScheduleNoteInput = Partial<CreateScheduleNoteInput>;

export const scheduleNotesApi = {
  list: () => apiClient.get<ScheduleNoteDTO[]>(BASE),
  get: (id: string) =>
    apiClient.get<ScheduleNoteDTO>(`${BASE}/${encodeURIComponent(id)}`),
  create: (data: CreateScheduleNoteInput) =>
    apiClient.post<ScheduleNoteDTO>(BASE, data),
  update: (id: string, data: UpdateScheduleNoteInput) =>
    apiClient.put<ScheduleNoteDTO>(
      `${BASE}/${encodeURIComponent(id)}`,
      data,
    ),
  remove: (id: string) =>
    apiClient.delete<{ success: boolean }>(
      `${BASE}/${encodeURIComponent(id)}`,
    ),
};
