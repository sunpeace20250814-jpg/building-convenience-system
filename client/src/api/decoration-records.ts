/**
 * Decoration Records API — V4 改寫
 *
 * ★ 改寫：所有 SQL 都走 server API（/api/decoration-records），
 *   不再直接 queryAll 本地 SQLite（storage/database.ts 是 throw-stub）。
 */

import { apiClient } from '@/lib/apiClient';

export interface DecorationRecordDTO {
  id: string;
  residentId: string;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  removalDate?: string | null;
  startImage?: string | null;
  removalImage?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateDecorationRecordInput {
  residentId: string;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  removalDate?: string | null;
  startImage?: string | null;
  removalImage?: string | null;
  notes?: string | null;
}

export type UpdateDecorationRecordInput = Partial<CreateDecorationRecordInput>;

export const decorationRecordsApi = {
  async listAll(): Promise<DecorationRecordDTO[]> {
    return apiClient.get<DecorationRecordDTO[]>('/api/decoration-records');
  },

  async listByResident(residentId: string): Promise<DecorationRecordDTO[]> {
    return apiClient.get<DecorationRecordDTO[]>(
      `/api/decoration-records?residentId=${encodeURIComponent(residentId)}`
    );
  },

  async get(id: string): Promise<DecorationRecordDTO | null> {
    const row = await apiClient.get<DecorationRecordDTO>(
      `/api/decoration-records/${encodeURIComponent(id)}`
    );
    return row ?? null;
  },

  async create(data: CreateDecorationRecordInput): Promise<DecorationRecordDTO> {
    return apiClient.post<DecorationRecordDTO>('/api/decoration-records', data);
  },

  async update(id: string, data: UpdateDecorationRecordInput): Promise<DecorationRecordDTO | null> {
    return apiClient.put<DecorationRecordDTO>(
      `/api/decoration-records/${encodeURIComponent(id)}`,
      data
    );
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete<{ success: boolean }>(
      `/api/decoration-records/${encodeURIComponent(id)}`
    );
  },

  /** 整批替換：modal 提交時一次 delete all + create new */
  async replaceAll(
    residentId: string,
    items: CreateDecorationRecordInput[]
  ): Promise<DecorationRecordDTO[]> {
    // 取得既有 → 刪除 → 重建
    const existing = await this.listByResident(residentId);
    await Promise.all(existing.map((e) => this.remove(e.id)));
    const created = await Promise.all(
      items
        .filter((d) => d.name?.trim())
        .map((d) => this.create(d))
    );
    return created;
  },
};