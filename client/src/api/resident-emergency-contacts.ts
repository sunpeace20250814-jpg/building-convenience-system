/**
 * Resident Emergency Contacts API — V4 改寫
 *
 * ★ 改寫：所有 SQL 都走 server API（/api/resident-emergency-contacts）。
 */

import { apiClient } from '@/lib/apiClient';

export interface ResidentEmergencyContactDTO {
  id: string;
  residentId: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  relation?: string | null;
  notes?: string | null;
  createdAt?: string;
}

export interface CreateResidentEmergencyContactInput {
  name: string;
  phone?: string | null;
  address?: string | null;
  relation?: string | null;
  notes?: string | null;
}

export type UpdateResidentEmergencyContactInput = Partial<CreateResidentEmergencyContactInput>;

export const residentEmergencyContactsApi = {
  async list(residentId: string): Promise<ResidentEmergencyContactDTO[]> {
    return apiClient.get<ResidentEmergencyContactDTO[]>(
      `/api/resident-emergency-contacts/resident/${encodeURIComponent(residentId)}`
    );
  },

  async get(id: string): Promise<ResidentEmergencyContactDTO | null> {
    const all = await apiClient.get<ResidentEmergencyContactDTO[]>(
      '/api/resident-emergency-contacts'
    );
    return all.find((c) => c.id === id) ?? null;
  },

  async create(
    residentId: string,
    data: CreateResidentEmergencyContactInput
  ): Promise<ResidentEmergencyContactDTO> {
    return apiClient.post<ResidentEmergencyContactDTO>(
      '/api/resident-emergency-contacts',
      { ...data, residentId }
    );
  },

  async update(id: string, data: UpdateResidentEmergencyContactInput): Promise<void> {
    await apiClient.put<ResidentEmergencyContactDTO>(
      `/api/resident-emergency-contacts/${encodeURIComponent(id)}`,
      data
    );
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete<{ success: boolean }>(
      `/api/resident-emergency-contacts/${encodeURIComponent(id)}`
    );
  },

  /** 整批替換（先 delete all → create new）：用在 modal 提交時 */
  async replaceAll(
    residentId: string,
    items: CreateResidentEmergencyContactInput[]
  ): Promise<ResidentEmergencyContactDTO[]> {
    const existing = await this.list(residentId);
    await Promise.all(existing.map((e) => this.remove(e.id)));
    return await Promise.all(
      items.filter((c) => c.name?.trim()).map((c) => this.create(residentId, c))
    );
  },
};