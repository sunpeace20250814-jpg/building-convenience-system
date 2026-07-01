/**
 * 公告 Store
 *
 * V4 改寫：原本用 queryAll/execute 讀 sql.js；改用 fetch API。
 * - tabs 走 /api/home-tabs
 * - records 走 /api/home-records（含 imageBase64 / imageFilename / pinned 欄位支援）
 *
 * API surface（保持向後相容，呼叫端不需改）：
 *   state: tabs, records, isLoading, error
 *   actions:
 *     loadTabs, loadRecords,
 *     createTab, updateTab, reorderTabs, deleteTab,
 *     addRecord, updateRecord, removeRecord
 *
 * 注意：
 * - addRecord / updateRecord 現在接受完整 home_records 欄位（含 imageBase64 / pinned）
 *   以取代原本 home-tabs/index.tsx 內用 execute 直接補欄位的 hack
 * - 原本 store 是 sync 行為；改為 async 後 load* 仍 fire-and-forget
 *   （呼叫端不需 await），create/update/delete 改為 async 但呼叫端不需改
 */

import { create } from 'zustand';
import {
  homeTabsApi,
  type HomeTabDTO,
  type CreateHomeTabInput,
  type UpdateHomeTabInput,
} from '@/api/home-tabs';
import {
  homeRecordsApi,
  type HomeRecordDTO,
  type CreateHomeRecordInput,
  type UpdateHomeRecordInput,
} from '@/api/home-records';

// ---------------- DTO 形別 ----------------
export type { HomeTabDTO as HomeTab, HomeRecordDTO as HomeRecord };

// ---------------- State 介面 ----------------
interface HomeTabsState {
  tabs: HomeTabDTO[];
  records: HomeRecordDTO[];
  isLoading: boolean;
  error: string | null;

  loadTabs: () => Promise<void>;
  loadRecords: (tabId?: string) => Promise<void>;

  createTab: (data: CreateHomeTabInput) => Promise<HomeTabDTO>;
  updateTab: (id: string, data: UpdateHomeTabInput) => Promise<HomeTabDTO>;
  reorderTabs: (orderedIds: string[]) => Promise<void>;
  deleteTab: (id: string) => Promise<void>;

  addRecord: (tabId: string, data: CreateHomeRecordInput) => Promise<HomeRecordDTO>;
  updateRecord: (id: string, data: UpdateHomeRecordInput) => Promise<HomeRecordDTO>;
  removeRecord: (id: string) => Promise<void>;
}

export const useHomeTabsStore = create<HomeTabsState>((set) => ({
  tabs: [],
  records: [],
  isLoading: false,
  error: null,

  // ---------------- Loaders ----------------

  loadTabs: async () => {
    try {
      const tabs = await homeTabsApi.list();
      set({ tabs });
    } catch (err: any) {
      set({ error: err?.message ?? '載入標籤失敗' });
    }
  },

  loadRecords: async (tabId) => {
    try {
      const records = tabId
        ? await homeRecordsApi.listByTab(tabId)
        : await homeRecordsApi.list();
      set({ records });
    } catch (err: any) {
      set({ error: err?.message ?? '載入公告失敗' });
    }
  },

  // ---------------- Tabs CRUD ----------------

  createTab: async (data) => {
    const created = await homeTabsApi.create(data);
    set((state) => ({ tabs: [...state.tabs, created] }));
    return created;
  },

  updateTab: async (id, data) => {
    const updated = await homeTabsApi.update(id, data);
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? updated : t)),
    }));
    return updated;
  },

  reorderTabs: async (orderedIds) => {
    // 批次更新 sort_order
    const updates = orderedIds.map((id, index) => ({ id, sortOrder: index }));
    const results = await Promise.all(
      updates.map((u) => homeTabsApi.update(u.id, { sortOrder: u.sortOrder })),
    );
    const map = new Map(results.map((t) => [t.id, t.sortOrder ?? 0]));
    set((state) => {
      const sorted = [...state.tabs].sort((a, b) => (map.get(a.id) ?? 999) - (map.get(b.id) ?? 999));
      return { tabs: sorted };
    });
  },

  deleteTab: async (id) => {
    // server 端 FK CASCADE 連帶刪 records
    await homeTabsApi.remove(id);
    set((state) => ({
      tabs: state.tabs.filter((t) => t.id !== id),
      records: state.records.filter((r) => r.tabId !== id),
    }));
  },

  // ---------------- Records CRUD ----------------

  addRecord: async (tabId, data) => {
    const created = await homeRecordsApi.create({ ...data, tabId });
    set((state) => ({ records: [created, ...state.records] }));
    return created;
  },

  updateRecord: async (id, data) => {
    const updated = await homeRecordsApi.update(id, data);
    set((state) => ({
      records: state.records.map((r) => (r.id === id ? updated : r)),
    }));
    return updated;
  },

  removeRecord: async (id) => {
    await homeRecordsApi.remove(id);
    set((state) => ({ records: state.records.filter((r) => r.id !== id) }));
  },
}));
