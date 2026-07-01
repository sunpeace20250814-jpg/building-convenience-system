/**
 * 住戶 Store — V4 API 版
 *
 * 從 sql.js WASM 直接 queryAll 改成 fetch API。
 *
 * 設計原則：
 * - 保留原本 store 的 public API surface（元件呼叫方式不變）
 * - 所有 CRUD 走 client/src/api/residents.ts
 * - 子資源（members / keycards）走對應的 api
 * - 函式改 async，回傳 Promise — 元件端可 await 也可 fire-and-forget
 *
 * 注意：
 * - server route 已支援 residents / members / keycards
 * - residents 表的 server body 沒有 owner_address 跟 delivery_date（見 schema.ts），
 *   所以這些欄位會被存在本地 client-only 欄位（讓原本 UI 不破壞）
 * - store 仍然維護 isLoading / error 給 UI 觀察
 */

import { create } from 'zustand';
import {
  residentsApi,
  residentMembersApi,
  residentKeycardsApi,
  type ResidentDTO,
  type CreateResidentInput,
  type UpdateResidentInput,
  type ResidentMemberDTO,
  type CreateResidentMemberInput,
  type UpdateResidentMemberInput,
  type ResidentKeycardDTO,
  type CreateResidentKeycardInput,
} from '@/api/residents';

// 用 Record 保留原本 store 的 index-by-id 結構
type MembersByResident = Record<string, ResidentMemberDTO[]>;
type KeycardsByResident = Record<string, ResidentKeycardDTO[]>;

interface ResidentState {
  residents: ResidentDTO[];
  members: MembersByResident;
  keycards: KeycardsByResident;
  isLoading: boolean;
  error: string | null;

  loadResidents: () => Promise<void>;
  loadMembers: (residentId: string) => Promise<void>;
  loadKeycards: (residentId: string) => Promise<void>;

  createResident: (data: CreateResidentInput) => Promise<ResidentDTO>;
  updateResident: (id: string, data: UpdateResidentInput) => Promise<ResidentDTO | null>;
  deleteResident: (id: string) => Promise<void>;

  addMember: (residentId: string, data: CreateResidentMemberInput) => Promise<ResidentMemberDTO | null>;
  updateMember: (memberId: string, data: UpdateResidentMemberInput) => Promise<void>;
  removeMember: (residentId: string, memberId: string) => Promise<void>;

  addKeycard: (residentId: string, data: CreateResidentKeycardInput) => Promise<ResidentKeycardDTO | null>;
  removeKeycard: (residentId: string, keycardId: string) => Promise<void>;

  /** 取得某樓的現有住戶（判斷空房；純前端 filter） */
  getResidentsByBuildingFloor: (buildingId: string, floor: string) => ResidentDTO[];
}

export const useResidentStore = create<ResidentState>((set, get) => ({
  residents: [],
  members: {},
  keycards: {},
  isLoading: false,
  error: null,

  loadResidents: async () => {
    set({ isLoading: true, error: null });
    try {
      const residents = await residentsApi.list();
      set({ residents, isLoading: false });
    } catch (err: any) {
      set({ error: err?.message ?? '載入失敗', isLoading: false });
    }
  },

  loadMembers: async (residentId) => {
    try {
      const members = await residentMembersApi.list(residentId);
      set((state) => ({ members: { ...state.members, [residentId]: members } }));
    } catch (err: any) {
      set({ error: err?.message ?? '載入失敗' });
    }
  },

  loadKeycards: async (residentId) => {
    try {
      const keycards = await residentKeycardsApi.list(residentId);
      set((state) => ({ keycards: { ...state.keycards, [residentId]: keycards } }));
    } catch (err: any) {
      set({ error: err?.message ?? '載入失敗' });
    }
  },

  createResident: async (data) => {
    const created = await residentsApi.create({
      ...data,
      // 預設值（跟原本 store 行為一致）
      unitType: data.unitType ?? 'normal',
      status: data.status ?? '正常',
      buildingId: data.buildingId || 'default',
    });
    set((state) => ({ residents: [...state.residents, created] }));
    return created;
  },

  updateResident: async (id, data) => {
    try {
      const updated = await residentsApi.update(id, data);
      set((state) => ({
        residents: state.residents.map((r) => (r.id === id ? updated : r)),
      }));
      return updated;
    } catch (err: any) {
      // 404 等情況：從本地 cache 移除並回傳 null
      if (err?.status === 404) {
        set((state) => ({ residents: state.residents.filter((r) => r.id !== id) }));
        return null;
      }
      throw err;
    }
  },

  deleteResident: async (id) => {
    // server route 已 FK CASCADE：DELETE /api/residents/:id 會連帶刪 members / keycards
    await residentsApi.remove(id);
    set((state) => {
      const { [id]: _m, ...restMembers } = state.members;
      const { [id]: _k, ...restKeycards } = state.keycards;
      void _m;
      void _k;
      return {
        residents: state.residents.filter((r) => r.id !== id),
        members: restMembers,
        keycards: restKeycards,
      };
    });
  },

  addMember: async (residentId, data) => {
    const created = await residentMembersApi.create(residentId, data);
    if (created) {
      set((state) => ({
        members: {
          ...state.members,
          [residentId]: [...(state.members[residentId] ?? []), created],
        },
      }));
    }
    return created;
  },

  updateMember: async (memberId, data) => {
    // 先找這是哪個 resident 的 member（從本地 cache 反查）
    let targetResidentId: string | undefined;
    for (const [rid, list] of Object.entries(get().members)) {
      if (list.some((m) => m.id === memberId)) {
        targetResidentId = rid;
        break;
      }
    }
    if (!targetResidentId) {
      throw new Error(`找不到 member ${memberId} 的所屬住戶`);
    }
    const updated = await residentMembersApi.update(targetResidentId, memberId, data);
    set((state) => ({
      members: {
        ...state.members,
        [targetResidentId!]: (state.members[targetResidentId!] ?? []).map((m) =>
          m.id === memberId ? updated : m
        ),
      },
    }));
  },

  removeMember: async (residentId, memberId) => {
    await residentMembersApi.remove(residentId, memberId);
    set((state) => ({
      members: {
        ...state.members,
        [residentId]: (state.members[residentId] ?? []).filter((m) => m.id !== memberId),
      },
    }));
  },

  addKeycard: async (residentId, data) => {
    const created = await residentKeycardsApi.create(residentId, data);
    if (created) {
      set((state) => ({
        keycards: {
          ...state.keycards,
          [residentId]: [...(state.keycards[residentId] ?? []), created],
        },
      }));
    }
    return created;
  },

  removeKeycard: async (residentId, keycardId) => {
    await residentKeycardsApi.remove(residentId, keycardId);
    set((state) => ({
      keycards: {
        ...state.keycards,
        [residentId]: (state.keycards[residentId] ?? []).filter((k) => k.id !== keycardId),
      },
    }));
  },

  getResidentsByBuildingFloor: (buildingId, floor) => {
    return get().residents.filter(
      (r) => r.buildingId === buildingId && r.floor === floor
    );
  },
}));