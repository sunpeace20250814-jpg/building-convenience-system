# V4 前端交接包（FRONTEND_HANDOFF）

> 對象：接手 V4 前端的 AI / 工程師。
> 目標：看完這份，就能在「前端純接口架構」下加新功能，不踩坑、不破壞現有設計。
>
> V4 v1.4+ 起，前端**不再用 sql.js / IndexedDB 直接 query**。所有資料都透過 HTTP API 從 server 拿。

---

## 0. 一頁總覽

### 0.1 資料流（單向）

```
┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐
│  UI 元件   │ →  │   Store    │ →  │  React     │ →  │  API 契約  │ →  │   Server   │
│ (modules/) │    │ (stores/)  │    │  Hook      │    │  (api/)    │    │ (server/)  │
│            │ ←  │            │ ←  │ (hooks/)   │ ←  │            │ ←  │            │
└────────────┘    └────────────┘    └────────────┘    └────────────┘    └────────────┘
                                                                  ↓
                                                          SQLite (better-sqlite3)
```

**每一層只做一件事，不要混**：
- UI 元件：渲染 + 收使用者輸入
- Store：本地 cache + loading/error state + 多元件共享
- Hook：給純函式元件用的 wrapper（其實是 useState + useCallback）
- API 契約：fetch wrapper（拋 ApiError）
- Server route：接 request → repository → SQLite

### 0.2 最重要的 5 條規則

1. **前端不寫 SQL** — 一律走 `@/api/*` 的函式
2. **前端不存 IndexedDB** — 資料全在 server（PowerShell HttpListener 或 Fastify）
3. **前端不打直接 `/api/*`** — 一定走 `@/api/*` 模組化的 fetch wrapper
4. **加新資源 = 5 步** — schema → server route → client api → hook → store + UI
5. **保持 async** — 所有 CRUD 都 async/await，回傳 Promise

---

## 1. 目錄結構（前端相關）

```
client/src/
├── api/                    # ★ HTTP 契約層（fetch wrappers + DTO types）
│   ├── index.ts            # 統一 api 物件（api.residents.list() 等）
│   ├── residents.ts        # residentsApi + 子資源 membersApi/keycardsApi
│   ├── buildings.ts
│   ├── expenses.ts
│   ├── schedule.ts
│   └── ...（每個資源一個檔）
│
├── hooks/                  # ★ React hook 包裝（給純函式元件用）
│   ├── index.ts
│   ├── useResidents.ts     # useResidents() → { residents, isLoading, error, load, create, update, remove }
│   ├── useBuildings.ts
│   └── ...
│
├── stores/                 # ★ Zustand store（給跨元件共享狀態用）
│   ├── index.ts            # 統一 export
│   ├── residentStore.ts    # useResidentStore
│   ├── expenseStore.ts
│   ├── scheduleStore.ts
│   ├── settingsStore.ts
│   ├── homeTabsStore.ts
│   ├── facilityBookingStore.ts
│   ├── holidayStore.ts
│   └── v1Store.ts
│
├── modules/                # ★ 業務模組（UI + 商業邏輯）
│   ├── residents/          # 4 個 tab：住戶列表 / 停車位 / 狀態 / 裝潢
│   ├── expenses/
│   ├── schedule/
│   ├── facility-booking/
│   ├── calendar/
│   ├── home-tabs/
│   ├── settings/
│   ├── backup/
│   ├── onboarding/         # 首次啟動精靈（5 步）
│   ├── tutorials/
│   ├── ai/
│   ├── monitoring/
│   └── tools/
│
├── lib/                    # 通用工具
│   ├── apiClient.ts        # ★ 統一 fetch wrapper（apiClient.get/post/put/delete）
│   ├── environment.ts      # 雲端硬碟偵測（透過 PowerShell server /api/environment）
│   ├── onboarding.ts       # Onboarding 狀態標記
│   └── utils.ts            # cn() 等工具
│
├── components/             # 共用 UI 元件
│   ├── ui/                 # Button, Card, Modal, Input, Select, Toast, Badge...
│   ├── layout/             # PageHeader, Sidebar...
│   └── wizard/             # 多步驟表單精靈
│
├── storage/                # ★ V4 client 仍殘留的 sql.js + IndexedDB 適配層
│   ├── database.ts         # thin wrapper（initDefaultStorage + CRUD 工具）
│   ├── adapter.ts          # FSA / OPFS / IDB 介面
│   ├── indexedDBAdapter.ts # IndexedDB 實作
│   ├── hooks.ts            # useDatabase() React hook
│   ├── backupManager.ts    # 匯出 / 匯入 .db/.json/.gz
│   ├── schema.ts           # ★ SQL DDL（client + server 共用，編譯時由 shared 提供）
│   ├── migrations.ts       # 客戶端 migrations（holidays 加欄位等）
│   └── seedTutorials.ts    # 教學影片預設資料
│
├── i18n/                   # 多語系（react-i18next）
├── monitoring/             # 效能 / 錯誤監控
├── notifications/          # 通知中心
├── reports/                # 報表產生
├── security/               # 加密 / 授權
├── styles/                 # 全域 CSS
├── test/                   # 測試工具
├── types/                  # 共用 TS 型別
└── utils/                  # 工具（formatBytes 等）
```

---

## 2. API 呼叫模式

### 2.1 統一 fetch wrapper：`apiClient`

檔案：`client/src/lib/apiClient.ts`

```ts
import { apiClient, ApiError } from '@/lib/apiClient';

// GET
const list = await apiClient.get<ResidentDTO[]>('/api/residents');
const one  = await apiClient.get<ResidentDTO>(`/api/residents/${id}`);

// POST
const created = await apiClient.post<ResidentDTO>('/api/residents', data);

// PUT
const updated = await apiClient.put<ResidentDTO>(`/api/residents/${id}`, patch);

// DELETE
const result = await apiClient.delete<{ success: boolean }>(`/api/residents/${id}`);

// Query params
const filtered = await apiClient.get<ResidentDTO[]>('/api/residents/search', {
  params: { q: '張三' },
});

// 健康檢查
import { pingBackend } from '@/lib/apiClient';
const ok = await pingBackend();  // true / false
```

**ApiError 結構**：
```ts
class ApiError extends Error {
  status: number;    // HTTP status code
  code: string;      // HTTP_404 / TIMEOUT / NETWORK / 自訂
  message: string;   // server 訊息
  details?: unknown; // server 驗證錯誤細節
}
```

### 2.2 API 契約模組：`@/api/*`

每個資源一個檔，例如 `client/src/api/residents.ts`：

```ts
// 1. DTO type（從 server response 推欄位）
export interface ResidentDTO {
  id: string;
  buildingId: string;
  floor: string;
  name: string;
  phone?: string | null;
  // ...
}

// 2. 輸入 type
export interface CreateResidentInput {
  buildingId: string;
  floor: string;
  name: string;
  phone?: string | null;
  // ...
}
export type UpdateResidentInput = Partial<CreateResidentInput>;

// 3. API 物件
export const residentsApi = {
  list: () => apiClient.get<ResidentDTO[]>('/api/residents'),
  search: (q: string) => apiClient.get<ResidentDTO[]>('/api/residents/search', { params: { q } }),
  listByBuilding: (id: string) => apiClient.get<ResidentDTO[]>(`/api/residents/building/${id}`),
  get: (id: string) => apiClient.get<ResidentDTO>(`/api/residents/${id}`),
  create: (data: CreateResidentInput) => apiClient.post<ResidentDTO>('/api/residents', data),
  update: (id: string, data: UpdateResidentInput) => apiClient.put<ResidentDTO>(`/api/residents/${id}`, data),
  remove: (id: string) => apiClient.delete<{ success: boolean }>(`/api/residents/${id}`),
};

// 4. 子資源（同一檔或新檔，看規模）
export const residentMembersApi = {
  list: (rid: string) => apiClient.get<ResidentMemberDTO[]>(`/api/residents/${rid}/members`),
  create: (rid: string, data: CreateResidentMemberInput) => apiClient.post<ResidentMemberDTO>(`/api/residents/${rid}/members`, data),
  // ...
};
```

### 2.3 統一入口：`@/api` 的 `api` 物件

```ts
// 兩種風格任選
import { api } from '@/api';
const residents = await api.residents.list();

import { residentsApi } from '@/api/residents';
const residents = await residentsApi.list();
```

---

## 3. Hook 模式（給純函式元件用）

檔案：`client/src/hooks/useResidents.ts`

```ts
import { useEffect, useState, useCallback } from 'react';
import { residentsApi, type ResidentDTO, type CreateResidentInput } from '@/api/residents';

interface State {
  residents: ResidentDTO[];
  isLoading: boolean;
  error: string | null;
}
interface Actions {
  load: () => Promise<void>;
  create: (data: CreateResidentInput) => Promise<ResidentDTO>;
  update: (id: string, data: UpdateResidentInput) => Promise<ResidentDTO>;
  remove: (id: string) => Promise<void>;
}

export function useResidents(autoLoad = true): State & Actions {
  const [residents, setResidents] = useState<ResidentDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await residentsApi.list();
      setResidents(data);
    } catch (e: any) {
      setError(e?.message ?? '載入失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ... create/update/remove 類似

  useEffect(() => {
    if (autoLoad) void load();
  }, [autoLoad, load]);

  return { residents, isLoading, error, load, create, update, remove };
}
```

**用 hook 的元件**（無跨元件共享需求時用這個）：
```tsx
function ResidentsListTab() {
  const { residents, isLoading, error, remove } = useResidents();

  if (isLoading) return <Spinner />;
  if (error) return <Error msg={error} />;
  return <Table data={residents} onDelete={remove} />;
}
```

---

## 4. Store 模式（給跨元件共享時用）

檔案：`client/src/stores/residentStore.ts`（Zustand）

```ts
import { create } from 'zustand';
import {
  residentsApi,
  residentMembersApi,
  residentKeycardsApi,
  type ResidentDTO,
  type CreateResidentInput,
  type UpdateResidentInput,
} from '@/api/residents';

interface ResidentState {
  residents: ResidentDTO[];
  members: Record<string, ResidentMemberDTO[]>;
  keycards: Record<string, ResidentKeycardDTO[]>;
  isLoading: boolean;
  error: string | null;

  loadResidents: () => Promise<void>;
  loadMembers: (residentId: string) => Promise<void>;
  loadKeycards: (residentId: string) => Promise<void>;
  createResident: (data: CreateResidentInput) => Promise<ResidentDTO>;
  updateResident: (id: string, data: UpdateResidentInput) => Promise<ResidentDTO | null>;
  deleteResident: (id: string) => Promise<void>;
  addMember: (residentId: string, data: ...) => Promise<...>;
  // ...
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

  createResident: async (data) => {
    const created = await residentsApi.create({
      ...data,
      unitType: data.unitType ?? 'normal',
      status: data.status ?? '正常',
    });
    set((state) => ({ residents: [...state.residents, created] }));
    return created;
  },
  // ...
}));
```

**用 store 的元件**（多元件共享時用這個）：
```tsx
function ResidentsListTab() {
  const residents = useResidentStore((s) => s.residents);
  const isLoading = useResidentStore((s) => s.isLoading);
  const loadResidents = useResidentStore((s) => s.loadResidents);
  const deleteResident = useResidentStore((s) => s.deleteResident);

  useEffect(() => { void loadResidents(); }, [loadResidents]);
  return <Table data={residents} onDelete={deleteResident} />;
}
```

### 4.1 Hook vs Store 怎麼選

| 情境 | 用 |
|------|-----|
| 只有一個元件用 | Hook |
| 多個元件共享同一份資料 | Store |
| 跨頁面 / 跨模組共享 | Store |
| 純派生資料（filter / sort） | Hook 用 useMemo |
| 寫入邏輯複雜（多步驗證） | Store |
| 大量資料 + 需要分頁 | 兩者都可以，看團隊 |

### 4.2 Store 已存在的清單

不要重複建立，看有沒有現成的：

| Store | 路徑 | 管什麼 |
|-------|------|--------|
| `useResidentStore` | `stores/residentStore.ts` | 住戶 + members + keycards |
| `useExpenseStore` | `stores/expenseStore.ts` | 記帳 + 帳戶 + 零用金 |
| `useScheduleStore` | `stores/scheduleStore.ts` | 班表 + 員工 + 班別 |
| `useSettingsStore` | `stores/settingsStore.ts` | 棟別 + 樓層 + 假期 |
| `useHomeTabsStore` | `stores/homeTabsStore.ts` | 首頁分頁 + 記事 |
| `useFacilityBookingStore` | `stores/facilityBookingStore.ts` | 公設借用 |
| `useHolidayStore` | `stores/holidayStore.ts` | 國定假日 + 類別 |
| `useV1Store` | `stores/v1Store.ts` | V1 殘留狀態（逐步淘汰） |

---

## 5. 加新功能的 5 步流程（前端部分）

**情境**：要加一個「公告」模組（announcements），有 CRUD + 分類。

### Step 1：在 `@/api/` 建契約檔

```ts
// client/src/api/announcements.ts
import { apiClient } from '@/lib/apiClient';

export interface AnnouncementDTO {
  id: string;
  title: string;
  content: string;
  category: 'general' | 'urgent' | 'maintenance';
  pinned: boolean;
  publishedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateAnnouncementInput {
  title: string;
  content: string;
  category: 'general' | 'urgent' | 'maintenance';
  pinned?: boolean;
}

export type UpdateAnnouncementInput = Partial<CreateAnnouncementInput>;

export const announcementsApi = {
  list: () => apiClient.get<AnnouncementDTO[]>('/api/announcements'),
  listByCategory: (cat: string) =>
    apiClient.get<AnnouncementDTO[]>(`/api/announcements/category/${cat}`),
  get: (id: string) => apiClient.get<AnnouncementDTO>(`/api/announcements/${id}`),
  create: (data: CreateAnnouncementInput) =>
    apiClient.post<AnnouncementDTO>('/api/announcements', data),
  update: (id: string, data: UpdateAnnouncementInput) =>
    apiClient.put<AnnouncementDTO>(`/api/announcements/${id}`, data),
  remove: (id: string) =>
    apiClient.delete<{ success: boolean }>(`/api/announcements/${id}`),
};
```

### Step 2：在 `@/api/index.ts` 加到 `api` 物件

```ts
// client/src/api/index.ts
export * from './announcements';  // ← 加這行

import { announcementsApi } from './announcements';  // ← 加這行

export const api = {
  // ...
  announcements: announcementsApi,  // ← 加這行
};
```

### Step 3：在 `@/hooks/` 建 hook

```ts
// client/src/hooks/useAnnouncements.ts
import { useEffect, useState, useCallback } from 'react';
import {
  announcementsApi,
  type AnnouncementDTO,
  type CreateAnnouncementInput,
  type UpdateAnnouncementInput,
} from '@/api/announcements';

export function useAnnouncements(autoLoad = true) {
  const [announcements, setAnnouncements] = useState<AnnouncementDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setAnnouncements(await announcementsApi.list());
    } catch (e: any) {
      setError(e?.message ?? '載入失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const create = useCallback(async (data: CreateAnnouncementInput) => {
    const created = await announcementsApi.create(data);
    setAnnouncements((prev) => [created, ...prev]);
    return created;
  }, []);

  // ... update/remove 類似

  useEffect(() => { if (autoLoad) void load(); }, [autoLoad, load]);

  return { announcements, isLoading, error, load, create, update, remove };
}
```

```ts
// client/src/hooks/index.ts
export * from './useAnnouncements';  // ← 加這行
```

### Step 4：（選擇性）在 `@/stores/` 建 store

只在「多個元件共享同一份 announcements」時才需要。

```ts
// client/src/stores/announcementStore.ts
import { create } from 'zustand';
import { announcementsApi, type AnnouncementDTO } from '@/api/announcements';

interface AnnouncementState {
  announcements: AnnouncementDTO[];
  isLoading: boolean;
  error: string | null;
  load: () => Promise<void>;
  create: (data: CreateAnnouncementInput) => Promise<AnnouncementDTO>;
  // ...
}

export const useAnnouncementStore = create<AnnouncementState>((set) => ({
  announcements: [],
  isLoading: false,
  error: null,
  load: async () => {
    set({ isLoading: true, error: null });
    try {
      set({ announcements: await announcementsApi.list(), isLoading: false });
    } catch (e: any) {
      set({ error: e?.message ?? '載入失敗', isLoading: false });
    }
  },
  // ...
}));
```

```ts
// client/src/stores/index.ts
export { useAnnouncementStore } from './announcementStore';  // ← 加這行
```

### Step 5：在 `@/modules/` 建 UI 元件

```
client/src/modules/announcements/
├── index.tsx              # AnnouncementsModule 主元件（路由入口）
├── AnnouncementList.tsx   # 列表 + 篩選
└── AnnouncementForm.tsx   # 新增 / 編輯表單
```

```tsx
// client/src/modules/announcements/index.tsx
import { useEffect } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAnnouncements } from '@/hooks/useAnnouncements';

export function AnnouncementsModule() {
  const { announcements, isLoading, error, load } = useAnnouncements();

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="p-6">
      <PageHeader title="公告" />
      {isLoading ? <Spinner /> : <AnnouncementList data={announcements} />}
      {error && <Error msg={error} />}
    </div>
  );
}
```

```tsx
// client/src/modules/announcements/AnnouncementList.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { announcementsApi } from '@/api/announcements';

export function AnnouncementList({ data }) {
  const handleDelete = async (id: string) => {
    if (!confirm('確定刪除？')) return;
    await announcementsApi.remove(id);
    // refresh...
  };
  return (
    <Card>
      {data.map((a) => (
        <div key={a.id}>
          <h3>{a.title}</h3>
          <Button variant="danger" onClick={() => handleDelete(a.id)}>刪除</Button>
        </div>
      ))}
    </Card>
  );
}
```

**完成！** UI 直接呼叫 hook / store → API 契約 → server 處理 SQL。

---

## 6. 加新 Server Route 的步驟（前端需要知道的）

前端雖然不寫 server，但要知道「server route 怎麼命名 / 放哪」，這樣寫 `@/api/*` 時才知道對應的路徑。

### 6.1 新增 route 檔

```
server/src/routes/announcements.ts
```

```ts
import { FastifyPluginAsync } from 'fastify';

const announcementsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => {
    return fastify.db.prepare('SELECT * FROM announcements ORDER BY pinned DESC, published_at DESC').all();
  });
  // POST /, GET /:id, PUT /:id, DELETE /:id ...
};
export default announcementsRoutes;
```

### 6.2 在 server/src/index.ts 註冊

```ts
// server/src/index.ts
import announcementsRoutes from './routes/announcements.js';

await fastify.register(announcementsRoutes, { prefix: '/api/announcements' });
```

### 6.3 加 schema（如新表）

```
server/src/db/schema.ts
```

```ts
export const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    pinned INTEGER NOT NULL DEFAULT 0,
    published_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;
```

**前端不用動 schema 檔** — 但要知道 server 可能尚未有 route，這時前端 API 呼叫會 404。

### 6.4 跨專案同步

- `shared/` 套件裝的是共用 schema / DTO type
- 改完 schema 後 `pnpm --filter @v4-resident/shared run build`
- 前端 `pnpm --filter @v4-resident/client run dev` 會重新編譯
- 但 @/api/* 的 DTO type 是手寫的（不從 shared 自動生成）— 改了 server schema 要記得同步 DTO

---

## 7. 不做的事（鐵律）

| 不要做 | 為什麼 | 怎麼做才對 |
|--------|--------|------------|
| ❌ 在 React 元件裡寫 `queryAll(...)` / `execute(...)` | 前端不該直接操作 SQLite | 走 `@/api/*` |
| ❌ 寫 `indexedDB.open(...)` / `indexedDB.deleteDatabase(...)`（除了 settings 重置） | 資料已經不在 IndexedDB | 走 server（讓 server 處理） |
| ❌ 用 `fetch('/api/...')` 直接打 server | 沒經過 `@/api/*` 契約 | `import { xxxApi } from '@/api/...'` |
| ❌ 寫 SQL 字串（`SELECT ... FROM ...`） | 那是 server repository 的工作 | 改 server route |
| ❌ 在 client/src/storage/database.ts 加新方法 | 那個檔是 V4 v1.0~v1.3 殘留的 sql.js wrapper | 新功能不該走這條 |
| ❌ 把 store / hook 命名加 `V1` / `V2` 前綴 | V1/V2/V3 是歷史命名，新功能用對應的 domain name | 用 `useAnnouncementStore` 而非 `useAnnouncementStoreV2` |
| ❌ 同步函式（`function list(): ResidentDTO[]`） | server 是 async，UI 也要 await | `async function load(): Promise<ResidentDTO[]>` |
| ❌ 把所有 DTO 用 `any` | 失去 typecheck 保護 | 從 server response 手動推欄位寫成 interface |
| ❌ 用 React Query / SWR / TanStack Query 直接替換 | 目前統一用自製 hook + Zustand | 想改可開 RFC，但單純「加新功能」時不要引入 |
| ❌ 改 `client/src/storage/database.ts` 的 API surface | 那是給現有模組用的，新功能不該依賴它 | 走 `@/api/*` |

---

## 8. 不允許的模式

### 8.1 繞過 proxy 直接打 /api/*

```ts
// ❌ 錯的
const res = await fetch('http://localhost:3001/api/residents');
const res = await fetch('http://localhost:9527/api/residents');

// ✅ 對的（vite proxy / PowerShell HttpListener 自動處理）
import { apiClient } from '@/lib/apiClient';
const residents = await apiClient.get<ResidentDTO[]>('/api/residents');
```

### 8.2 在元件裡直接 await fetch 拿資料

```tsx
// ❌ 錯的（沒 loading / error 狀態管理、沒 type 安全）
function ResidentsListTab() {
  const [data, setData] = useState<ResidentDTO[]>([]);
  useEffect(() => {
    fetch('/api/residents').then(r => r.json()).then(setData);
  }, []);
  return <Table data={data} />;
}

// ✅ 對的
function ResidentsListTab() {
  const { residents, isLoading, error } = useResidents();
  if (isLoading) return <Spinner />;
  if (error) return <Error msg={error} />;
  return <Table data={residents} />;
}
```

### 8.3 把資料庫查詢藏在 utils

```ts
// ❌ 錯的（utils 不該知道 DB）
// utils/residents.ts
export function getAllResidents(): ResidentDTO[] {
  return queryAll('SELECT * FROM residents');
}

// ✅ 對的
// api/residents.ts
export const residentsApi = {
  list: () => apiClient.get<ResidentDTO[]>('/api/residents'),
};
```

### 8.4 自己接 server response 處理分頁

```ts
// ❌ 錯的（自己拿 raw response）
const res = await fetch('/api/residents');
const json = await res.json();
if (!res.ok) alert(json.message);

// ✅ 對的（apiClient 統一拋 ApiError）
try {
  const data = await apiClient.get<ResidentDTO[]>('/api/residents');
  setData(data);
} catch (e) {
  if (e instanceof ApiError) {
    toast.addToast(`錯誤：${e.message}`, 'error');
  } else {
    throw e;
  }
}
```

---

## 9. 完整範例：加一個「公告」分頁（從 0 到 1）

完整可運行的最小範例，假設 server route 已經寫好。

### 9.1 API 契約

```ts
// client/src/api/announcements.ts
import { apiClient } from '@/lib/apiClient';

export interface AnnouncementDTO {
  id: string;
  title: string;
  content: string;
  category: 'general' | 'urgent' | 'maintenance';
  pinned: boolean;
  publishedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateAnnouncementInput {
  title: string;
  content: string;
  category: 'general' | 'urgent' | 'maintenance';
  pinned?: boolean;
}

export type UpdateAnnouncementInput = Partial<CreateAnnouncementInput>;

export const announcementsApi = {
  list: () => apiClient.get<AnnouncementDTO[]>('/api/announcements'),
  get: (id: string) => apiClient.get<AnnouncementDTO>(`/api/announcements/${id}`),
  create: (data: CreateAnnouncementInput) =>
    apiClient.post<AnnouncementDTO>('/api/announcements', data),
  update: (id: string, data: UpdateAnnouncementInput) =>
    apiClient.put<AnnouncementDTO>(`/api/announcements/${id}`, data),
  remove: (id: string) =>
    apiClient.delete<{ success: boolean }>(`/api/announcements/${id}`),
};
```

### 9.2 Hook

```ts
// client/src/hooks/useAnnouncements.ts
import { useEffect, useState, useCallback } from 'react';
import {
  announcementsApi,
  type AnnouncementDTO,
  type CreateAnnouncementInput,
  type UpdateAnnouncementInput,
} from '@/api/announcements';

export function useAnnouncements(autoLoad = true) {
  const [announcements, setAnnouncements] = useState<AnnouncementDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setAnnouncements(await announcementsApi.list());
    } catch (e: any) {
      setError(e?.message ?? '載入失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const create = useCallback(async (data: CreateAnnouncementInput) => {
    const created = await announcementsApi.create(data);
    setAnnouncements((prev) => [created, ...prev]);
    return created;
  }, []);

  const update = useCallback(async (id: string, data: UpdateAnnouncementInput) => {
    const updated = await announcementsApi.update(id, data);
    setAnnouncements((prev) => prev.map((a) => (a.id === id ? updated : a)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await announcementsApi.remove(id);
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
  }, []);

  useEffect(() => {
    if (autoLoad) void load();
  }, [autoLoad, load]);

  return { announcements, isLoading, error, load, create, update, remove };
}
```

### 9.3 Store（可選）

```ts
// client/src/stores/announcementStore.ts
import { create } from 'zustand';
import { announcementsApi, type AnnouncementDTO } from '@/api/announcements';

interface AnnouncementState {
  announcements: AnnouncementDTO[];
  isLoading: boolean;
  error: string | null;
  load: () => Promise<void>;
  create: (data: CreateAnnouncementInput) => Promise<AnnouncementDTO>;
  update: (id: string, data: UpdateAnnouncementInput) => Promise<AnnouncementDTO>;
  remove: (id: string) => Promise<void>;
}

export const useAnnouncementStore = create<AnnouncementState>((set) => ({
  announcements: [],
  isLoading: false,
  error: null,
  load: async () => {
    set({ isLoading: true, error: null });
    try {
      set({ announcements: await announcementsApi.list(), isLoading: false });
    } catch (e: any) {
      set({ error: e?.message ?? '載入失敗', isLoading: false });
    }
  },
  create: async (data) => {
    const created = await announcementsApi.create(data);
    set((s) => ({ announcements: [created, ...s.announcements] }));
    return created;
  },
  update: async (id, data) => {
    const updated = await announcementsApi.update(id, data);
    set((s) => ({ announcements: s.announcements.map((a) => (a.id === id ? updated : a)) }));
    return updated;
  },
  remove: async (id) => {
    await announcementsApi.remove(id);
    set((s) => ({ announcements: s.announcements.filter((a) => a.id !== id) }));
  },
}));
```

### 9.4 UI 元件

```tsx
// client/src/modules/announcements/index.tsx
import { useEffect } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useAnnouncementStore } from '@/stores/announcementStore';

export function AnnouncementsModule() {
  const { announcements, isLoading, error, load } = useAnnouncementStore();

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="p-6">
      <PageHeader title="公告" description="大樓公告與通知" />
      <Card>
        {isLoading && <Spinner />}
        {error && <p className="text-red-600">{error}</p>}
        {!isLoading && !error && announcements.length === 0 && (
          <p className="text-gray-400">目前沒有公告</p>
        )}
        {announcements.map((a) => (
          <div key={a.id} className="border-b py-2">
            {a.pinned && <span className="text-yellow-600">📌 </span>}
            <strong>{a.title}</strong>
            <span className="text-gray-500 ml-2">{a.category}</span>
            <p className="text-sm text-gray-700">{a.content}</p>
          </div>
        ))}
      </Card>
    </div>
  );
}
```

### 9.5 註冊模組

到 `client/src/modules-system/modules/registry.ts`（或類似路由檔）註冊模組：

```ts
import { AnnouncementsModule } from '@/modules/announcements';

export const modules = [
  // ...
  { id: 'announcements', label: '公告', icon: 'megaphone', component: AnnouncementsModule },
];
```

---

## 10. 錯誤處理模式

### 10.1 三層錯誤

```
網路錯誤（fetch 失敗）  → apiClient 拋 ApiError(0, 'NETWORK')
逾時（timeout）         → apiClient 拋 ApiError(0, 'TIMEOUT')
HTTP 4xx/5xx            → apiClient 拋 ApiError(status, code, message)
```

### 10.2 UI 怎麼接

```tsx
function ResidentsListTab() {
  const { residents, isLoading, error } = useResidents();
  const toast = useToast();

  const handleDelete = async (id: string) => {
    try {
      await residentsApi.remove(id);
      toast.addToast('已刪除', 'success');
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        toast.addToast('這筆資料已經不存在了', 'warning');
      } else {
        toast.addToast(`刪除失敗：${e?.message ?? '未知錯誤'}`, 'error');
      }
    }
  };

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBanner msg={error} />;
  return <Table data={residents} onDelete={handleDelete} />;
}
```

### 10.3 全域監控

`client/src/monitoring/core.ts` 自動記錄：
- 所有 SQL 查詢（即便前端不該用 SQL，但若舊模組用了）
- Storage 寫入 bytes / 耗時 / 成功失敗
- 一般 error / perf metric

不要在元件裡再自己 try/catch + console.log — 讓 monitoring 統一收。

---

## 11. 國際化（i18n）

```tsx
import { useTranslation } from 'react-i18next';

function ResidentsListTab() {
  const { t } = useTranslation();
  return <h1>{t('residents.title')}</h1>;
}
```

語言檔位置：`client/src/i18n/locales/{zh-TW,zh-CN,en}.json`

新增 key 時三個語言檔都要加：
```json
{
  "residents": {
    "title": "住戶管理",
    "add": "新增住戶"
  }
}
```

語言切換在 Onboarding Step 2 + Settings → Language。

---

## 12. 常見任務速查

### 12.1 加一個欄位到現有資源

例：住戶加 `email` 欄位

1. Server: `server/src/db/schema.ts` ALTER TABLE + repository 改
2. Server: `server/src/routes/residents.ts` 改 body schema
3. Frontend: `client/src/api/residents.ts` 加 `email?: string` 到 `ResidentDTO` + `CreateResidentInput`
4. Frontend: 任何用到 email 的 UI 元件加上欄位

### 12.2 改某個資源的列表邏輯

例：住戶列表要支援 filter by status

1. Server route 加 query param：`GET /api/residents?status=active`
2. Frontend api 加 wrapper：`residentsApi.listByStatus(status)`
3. Frontend hook / store 加對應的 `loadByStatus` action

### 12.3 加新的 Modal / Form

參考現有的 `ResidentModal.tsx`：
- 檔案位置：`client/src/modules/residents/ResidentModal.tsx`
- 用 `<Modal>` 元件（已在 `components/ui/Modal.tsx`）
- 用 `<Button>` / `<Input>` / `<Select>` 等共用元件

### 12.4 顯示 Server 錯誤給使用者

```tsx
try {
  await someApiCall();
} catch (e) {
  if (e instanceof ApiError) {
    if (e.status === 400) {
      // 驗證錯誤 — 顯示 details
      toast.addToast(`資料格式錯誤：${e.message}`, 'error');
    } else if (e.status === 404) {
      toast.addToast('找不到資料', 'warning');
    } else if (e.status >= 500) {
      toast.addToast('伺服器錯誤，請稍後再試', 'error');
    }
  }
}
```

---

## 13. 測試

### 13.1 跑測試

```powershell
pnpm --filter @v4-resident/client test
```

Vitest 配置在 `client/vitest.config.ts`。

### 13.2 寫測試的時機

- 加新 utility / parser（例如 CSV parser）→ 必寫
- 加新 API 契約 → 寫 hook 的單元測試（mock apiClient）
- 加新 store → 寫 store 的單元測試
- 加新 UI 元件 → 不一定要寫（UI 測試成本高），但有複雜邏輯要寫

### 13.3 測試範本（hook 測試）

```ts
// client/src/hooks/useAnnouncements.test.ts
import { renderHook, act } from '@testing-library/react';
import { useAnnouncements } from './useAnnouncements';
import { announcementsApi } from '@/api/announcements';

vi.mock('@/api/announcements');

describe('useAnnouncements', () => {
  it('loads on mount', async () => {
    vi.mocked(announcementsApi.list).mockResolvedValue([{ id: '1', title: 'Hi', ... }]);
    const { result } = renderHook(() => useAnnouncements());
    await act(() => Promise.resolve());
    expect(result.current.announcements).toHaveLength(1);
  });
});
```

---

## 14. 部署 / Build 檢查

### 14.1 Build 前

```powershell
# Type check
pnpm --filter @v4-resident/client exec tsc --noEmit

# Lint
pnpm --filter @v4-resident/client exec eslint src

# 跑測試
pnpm --filter @v4-resident/client test -- --run
```

### 14.2 Build

```powershell
pnpm --filter @v4-resident/client build
# 產出 client/dist/
```

### 14.3 確認 dist 可用

```powershell
# 啟動 PowerShell server（不需要 Node）
cd client/dist
.\啟動 V4 住戶管理.bat
```

---

## 15. FAQ

**Q: 我可以直接在 client/src/storage/database.ts 加新方法嗎？**
A: 不要。那個檔是 v1.0~v1.3 的 sql.js wrapper，新功能應該走 `@/api/*`。除非是要修現有 storage bug，否則不要碰。

**Q: 可以用 React Query 嗎？**
A: 目前不用。要引入新依賴需要先在 PR 描述為什麼、影響哪些檔。短期內請用自製 hook + Zustand。

**Q: DTO type 要不要從 server schema 自動生成？**
A: 目前是手寫的（client/src/api/*.ts 的 interface）。改 server schema 要記得同步 DTO。長期可以考慮用 OpenAPI codegen，但目前還沒做。

**Q: 為什麼 store 命名是 `useResidentStore` 而 hook 是 `useResidents`？**
A: 約定：store 是「管理一塊 state 集合」用單數 domain（residentStore）；hook 是「提供一組 CRUD 操作」用複數或單數都可以，但推薦複數（useResidents）。

**Q: 我改了 `@/api/residents.ts` 但 server route 還沒寫，怎麼辦？**
A: 可以先寫 client API + hook + UI，server route 還沒寫時呼叫會 404。報錯時 toast 顯示「載入失敗」。不要因為 server 還沒寫就放棄 client API 設計 — 契約先行。

**Q: PowerShell HttpListener（dist 用）跟 Fastify server（dev 用）有什麼差別？**
A:
- PowerShell HttpListener：只支援 4 個端點（environment / pick-folder / test-backup-dir / schedule-backup），純為了偵測雲端硬碟 + 排程設定
- Fastify server：完整實作所有 `/api/*` 業務路由
- 前端不需要知道 server 是哪個 — `@/api/*` 都打 `/api/*`，由 vite proxy 或 PowerShell server 處理

**Q: IndexedDB 還有資料怎麼辦？**
A: v1.4+ 前端的 IndexedDB 是「過渡期相容」用的。新模組不該用。如果使用者從 v1.3 升上來，舊 IndexedDB 還在但不會被新模組用到 — 不影響功能。

---

## 16. 相關檔案總覽

| 用途 | 路徑 |
|------|------|
| API 統一入口 | `client/src/api/index.ts` |
| 統一 fetch wrapper | `client/src/lib/apiClient.ts` |
| Hook 統一入口 | `client/src/hooks/index.ts` |
| Store 統一入口 | `client/src/stores/index.ts` |
| 業務模組 | `client/src/modules/*` |
| 共用 UI | `client/src/components/ui/*` |
| 共用 Layout | `client/src/components/layout/*` |
| 多步驟精靈 | `client/src/components/wizard/*` |
| 多語系 | `client/src/i18n/locales/*.json` |
| 監控 | `client/src/monitoring/core.ts` |
| 環境偵測 | `client/src/lib/environment.ts` |
| Vite proxy 設定 | `client/vite.config.ts` |

---

最後更新：2026-06-25