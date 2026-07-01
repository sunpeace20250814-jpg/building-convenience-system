/**
 * Resident Parking API — V4 改寫
 *
 * ★ 改寫：所有 SQL 都走 server API（/api/resident-parking）。
 */

import { apiClient } from '@/lib/apiClient';

export interface ResidentParkingDTO {
  id: string;
  residentId: string;
  parkingSpotId: string;
  etcNumber?: string | null;
  notes?: string | null;
  createdAt?: string;
}

export interface ResidentParkingWithSpotDTO extends ResidentParkingDTO {
  spotFloor?: string | null;
  spotNumber?: string | null;
  spotSpace?: string | null;
  spotType?: 'car' | 'motorcycle' | 'large' | null;
}

export interface CreateResidentParkingInput {
  parkingSpotId: string;
  etcNumber?: string | null;
  notes?: string | null;
}

export type UpdateResidentParkingInput = Partial<CreateResidentParkingInput>;

export const residentParkingApi = {
  async list(residentId: string): Promise<ResidentParkingWithSpotDTO[]> {
    return apiClient.get<ResidentParkingWithSpotDTO[]>(
      `/api/resident-parking/resident/${encodeURIComponent(residentId)}`
    );
  },

  async create(
    residentId: string,
    data: CreateResidentParkingInput
  ): Promise<ResidentParkingDTO> {
    return apiClient.post<ResidentParkingDTO>('/api/resident-parking', {
      ...data,
      residentId,
    });
  },

  async update(id: string, data: UpdateResidentParkingInput): Promise<void> {
    await apiClient.put<ResidentParkingDTO>(
      `/api/resident-parking/${encodeURIComponent(id)}`,
      data
    );
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete<{ success: boolean }>(
      `/api/resident-parking/${encodeURIComponent(id)}`
    );
  },

  /** 整批替換：modal 提交時一次 delete all + insert new */
  async replaceAll(
    residentId: string,
    items: CreateResidentParkingInput[]
  ): Promise<ResidentParkingDTO[]> {
    const existing = await this.list(residentId);
    await Promise.all(existing.map((e) => this.remove(e.id)));
    return await Promise.all(
      items.filter((p) => p.parkingSpotId).map((p) => this.create(residentId, p))
    );
  },
};