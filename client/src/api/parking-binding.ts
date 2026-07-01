/**
 * Parking Binding API — 雙向綁定 住戶 ↔ 停車位
 *
 * ★ V4 改寫：所有 SQL 都走 server API，不再直接 queryAll 本地 SQLite。
 *   server/src/routes/parking-binding.ts 提供完整 bind / unbind 邏輯。
 */

import { apiClient } from '@/lib/apiClient';

export interface BindArgs {
  spotId: string;
  residentId: string | null;
}

interface BindingRecordDTO {
  spotId: string;
  residentId: string;
  buildingId: string | null;
  floor: string;
  number: string;
  type: string;
  updatedAt: string | null;
}

export const parkingBindingApi = {
  /**
   * 建立綁定（spot 綁定到 resident）
   */
  async bind(args: BindArgs): Promise<BindingRecordDTO> {
    if (!args.residentId) {
      throw new Error('residentId 不可為空，請用 unbind 解綁');
    }
    return apiClient.post<BindingRecordDTO>('/api/parking-binding', {
      spotId: args.spotId,
      residentId: args.residentId,
    });
  },

  /**
   * 解除綁定（spot 取消綁定住戶）
   * 注意：PUT /:id with residentId=null 即可解綁
   */
  async unbind(spotId: string): Promise<BindingRecordDTO> {
    return apiClient.put<BindingRecordDTO>(`/api/parking-binding/${spotId}`, {
      residentId: null,
    });
  },

  /**
   * 列出所有綁定（bound_resident_id != null 的 spot）
   */
  async listAll(): Promise<BindingRecordDTO[]> {
    return apiClient.get<BindingRecordDTO[]>('/api/parking-binding');
  },

  /**
   * 取某住戶的綁定車位
   */
  async listByResident(residentId: string): Promise<BindingRecordDTO[]> {
    return apiClient.get<BindingRecordDTO[]>(
      `/api/parking-binding/resident/${residentId}`
    );
  },
};