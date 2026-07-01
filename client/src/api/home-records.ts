/**
 * Home Records API — 首頁公告內容（home-records）
 *
 * ★ Go-style 設計：
 *   - 前端只呼叫這些函式，不直接 queryAll SQL
 *   - 後端實作：server/src/routes/home-records.ts（/api/home-records）
 *   - 對應資料表：home_records
 *
 * 欄位（schema home_records）：
 *   id, title, content, imagePath, imageFilename, imageBase64,
 *   tabId (FK→home_tabs), pinned (0/1), createdAt, updatedAt
 *   加上 join：tabName
 *
 * 路由（/api/home-records）：
 *   GET    /                  列出所有（含 tab_name join，依 pinned DESC, created_at DESC）
 *   GET    /tab/:tabId        依 tab 列出
 *   GET    /:id               單筆（含 tab_name join）
 *   POST   /                  新增
 *   PUT    /:id               更新
 *   DELETE /:id               刪除
 */

import { apiClient } from '@/lib/apiClient';

const BASE = '/api/home-records';

export interface HomeRecordDTO {
  id: string;
  title: string;
  content?: string | null;
  imagePath?: string | null;
  imageFilename?: string | null;
  imageBase64?: string | null;
  tabId?: string | null;
  pinned?: number; // 0 | 1
  createdAt?: string;
  updatedAt?: string;
  // join 欄位（從 server 回傳）
  tabName?: string;
}

export interface CreateHomeRecordInput {
  title: string;
  content?: string | null;
  imagePath?: string | null;
  imageFilename?: string | null;
  imageBase64?: string | null;
  tabId?: string | null;
  pinned?: number;
}

export type UpdateHomeRecordInput = Partial<CreateHomeRecordInput>;

export const homeRecordsApi = {
  list: () => apiClient.get<HomeRecordDTO[]>(BASE),
  listByTab: (tabId: string) =>
    apiClient.get<HomeRecordDTO[]>(
      `${BASE}/tab/${encodeURIComponent(tabId)}`,
    ),
  get: (id: string) =>
    apiClient.get<HomeRecordDTO>(`${BASE}/${encodeURIComponent(id)}`),
  create: (data: CreateHomeRecordInput) =>
    apiClient.post<HomeRecordDTO>(BASE, data),
  update: (id: string, data: UpdateHomeRecordInput) =>
    apiClient.put<HomeRecordDTO>(
      `${BASE}/${encodeURIComponent(id)}`,
      data,
    ),
  remove: (id: string) =>
    apiClient.delete<{ success: boolean }>(
      `${BASE}/${encodeURIComponent(id)}`,
    ),
};
