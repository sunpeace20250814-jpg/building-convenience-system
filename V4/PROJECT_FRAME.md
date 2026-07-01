# V4 大樓住戶管理系統 — 技術架構（PROJECT_FRAME）

> 版本：v1.0 — 2026-06-25 起草
> 對應程式庫：`C:\Users\sunpe\dev\v4-resident-system\`
> 對應產品定義：[PRD.md](./PRD.md)

---

## 1. 技術棧總覽

### 1.1 選擇原則

V4 的所有技術選擇都圍繞「**AI agent 友善**」+「**零後端費用**」+「**配置低 / 耗能低**」三個核心指標。

### 1.2 完整技術棧

| 層 | 技術 | 版本 | 為什麼選它 |
|----|------|------|------------|
| **前端框架** | React | 18.2 | 主流、AI 訓練資料最多、避免冷門框架 |
| **語言** | TypeScript | 5.3+ | strict mode、AI 看 type 就懂架構、減少 runtime bug |
| **建構工具** | Vite | 5.1+ | 啟動 < 1 秒、HMR 極快、ESM 原生 |
| **樣式** | TailwindCSS | 3.4+ | 不用寫 CSS、utility-first、AI 生成樣式直覺 |
| **狀態管理** | Zustand | 4.5+ | 比 Redux 簡單 80%、hooks API、SSR friendly |
| **客戶端 DB** | sql.js (WASM) + IndexedDB | 1.14+ | SQLite 全功能、離線可用、IndexedDB 當儲存後端 |
| **路由** | React Router | 6.22+ | 標準 SPA 路由 |
| **表格** | TanStack Table | 8.0+ | headless、不綁 UI、可完全客製 |
| **圖表** | Chart.js + recharts | 4.5+ / 2.12+ | 兩套互補、Chart.js 簡單、recharts 靈活 |
| **DnD** | dnd-kit | 6.3+ | 現代、輕量、a11y 友善 |
| **i18n** | i18next + react-i18next | 26.3+ | 標準、Lazy load、TypeScript 友善 |
| **PDF / Excel** | jsPDF + xlsx | 4.2 / 0.18 | 純前端、離線可用 |
| **Schema 驗證** | Zod | 3.23+ | client/server 共用、TypeScript inference |
| **測試** | Vitest + Testing Library + happy-dom | 1.6+ | Vite 原生、ESM 友善 |
| **E2E 測試** | Playwright | 1.61+ | 跨瀏覽器、auto-wait |
| **字型 subset** | subset-font + opentype.js | 2.5 / 2.0 | 中文字型 < 200KB |
| | | | |
| **後端框架** | Fastify | 4.26+ | 比 Express 快 2 倍、JSON Schema 內建、TypeScript 友善 |
| **後端語言** | TypeScript (Node.js 20 LTS) | 5.3+ | 與前端共用型別 |
| **DB driver** | better-sqlite3 | 12.0+ | 同步 API、最快 SQLite binding、原生 N-API |
| **DB** | SQLite | 3 | 單檔、無外部依賴、適合單機 |
| **打包** | tsc → node | 5.3+ | 標準、零黑箱 |
| **日誌** | pino + pino-pretty | 13.1+ | Fastify 預設、最高效能 JSON logger |
| **CORS** | @fastify/cors | 9.0+ | 標準 |
| **靜態檔案** | @fastify/static | 7.0+ | 生產模式 serve client/dist/ |
| **CLI** | argparse（自寫）+ zod | — | 輕量、零依賴 |
| | | | |
| **容器** | Docker + docker-compose | 24+ / 2.20+ | 多服務編排、volume 持久化 |
| **基礎映像** | node:22-alpine + nginx:alpine | — | < 80MB client image |
| | | | |
| **monorepo** | pnpm workspace | 8+ | 快、磁碟省、嚴格依賴 |
| **Node 版本管理** | nvm / 直接裝 LTS | 20 LTS | 穩定、better-sqlite3 相容 |
| **瀏覽器** | Chrome 90+ / Edge 90+ | — | WASM + ES2020 支援 |

### 1.3 不選的技術（明確排除）

| 候選 | 不選原因 |
|------|----------|
| Next.js / Remix | SSR 不需要、用戶只有一台桌機 |
| Electron / Tauri | 包成 exe 後 AI agent 看不到原始碼、除錯困難；用 Web + HttpLauncher 已足夠 |
| MongoDB / PostgreSQL | 需要 server 常駐、單機用 SQLite 已足夠 |
| Redux / MobX | Zustand 80% 場景已足夠、更簡單 |
| Material UI / Ant Design | 風格太通用、要客製反而不便；用 Tailwind 自刻 |
| Husky / lint-staged | 單人開發、commit hook 是多餘摩擦 |
| Prisma / TypeORM | ORM 是 overkill；直接 prepared statement 更直覺 |
| GraphQL / tRPC | REST 已足夠、客戶端 API 物件已用 Zod 驗證 |

---

## 2. 完整目錄結構

```
v4-resident-system/
├── package.json                    # workspace root
├── pnpm-workspace.yaml             # monorepo 設定（client + server + shared + cli）
├── pnpm-lock.yaml
├── README.md                       # 30 秒啟動 + 開發指南
├── CHANGELOG.md                    # 版本歷史
├── start.ps1                       # Windows 一鍵啟動（PowerShell HttpLauncher :9527）
├── start.bat                       # Windows 一鍵啟動（cmd 版本）
├── v4.bat                          # alias
├── deploy.example.sh               # Linux/macOS 部署腳本範本
├── docker-compose.yml              # api + web 兩服務
├── .dockerignore
│
├── client/                         # ============================
│   ├── package.json                # @v4-resident/client
│   ├── tsconfig.json               # strict + @/* alias
│   ├── tsconfig.node.json
│   ├── vite.config.ts              # vite-plugin-pwa + react + 路徑別名
│   ├── vitest.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── playwright.config.ts
│   ├── Dockerfile                  # multi-stage build（tsc + vite → nginx:alpine）
│   ├── nginx.conf                  # SPA fallback + /api 反代
│   ├── index.html
│   ├── public/                     # 靜態資源（icon.svg, manifest icons）
│   ├── scripts/
│   │   ├── build-font.ts           # 中文字型 subset
│   │   └── deploy.ps1              # 雲端硬碟鏡像部署
│   ├── e2e/                        # Playwright 測試
│   │   ├── 01-*.spec.ts
│   │   ├── 02-*.spec.ts
│   │   ├── 03-*.spec.ts
│   │   └── 04-*.spec.ts
│   ├── tests/                      # Node.js E2E helper
│   │   └── e2e/
│   ├── docs/                       # 模組設計文件
│   └── src/
│       ├── main.tsx                # React 入口 + i18n init + ErrorBoundary
│       ├── App.tsx                 # Router + Sidebar
│       ├── error-handling.ts       # 全域錯誤處理
│       │
│       ├── ai/                     # AI SQL 助手
│       │   ├── config.ts
│       │   ├── query.ts
│       │   ├── service.ts
│       │   └── sql-executor.ts
│       │
│       ├── api/                    # 30 個 fetch 客戶端
│       │   ├── index.ts            # 統一 `api.<resource>` 物件
│       │   ├── residents.ts        # 每個資源一份
│       │   ├── expenses.ts
│       │   ├── schedule.ts
│       │   ├── ... (28 個資源)
│       │
│       ├── components/
│       │   ├── ErrorBoundary.tsx
│       │   ├── ErrorRecoveryDialog.tsx
│       │   ├── DatabaseStatus.tsx  # 存檔狀態 + 手動備份按鈕
│       │   ├── StorageLocationPrompt.tsx
│       │   ├── TeachingOverlay.tsx
│       │   ├── ReportButton.tsx
│       │   ├── ContextAwareBanner.tsx
│       │   ├── SortableList.tsx
│       │   ├── NotificationBell.tsx
│       │   ├── layout/
│       │   │   ├── Sidebar.tsx     # 主導航 + 語言切換
│       │   │   └── PageHeader.tsx
│       │   ├── ui/                 # 11 個 UI 原子
│       │   │   ├── Button.tsx
│       │   │   ├── Input.tsx
│       │   │   ├── Select.tsx
│       │   │   ├── Modal.tsx
│       │   │   ├── Card.tsx
│       │   │   ├── Badge.tsx
│       │   │   ├── Table.tsx
│       │   │   ├── Spinner.tsx
│       │   │   ├── Toast.tsx
│       │   │   └── ImageUpload.tsx
│       │   └── wizard/
│       │       ├── Wizard.tsx
│       │       └── Stepper.tsx
│       │
│       ├── hooks/                  # 25 個資料 hooks
│       │   ├── index.ts
│       │   ├── useResidents.ts
│       │   ├── useExpenses.ts
│       │   ├── ... (25 個資源)
│       │
│       ├── i18n/                   # 多語系
│       │   ├── index.ts
│       │   └── locales/
│       │       ├── zh-TW.json      # baseline
│       │       ├── zh-CN.json
│       │       └── en.json
│       │
│       ├── lib/
│       │   ├── apiClient.ts        # fetch wrapper
│       │   ├── environment.ts      # dev/prod 偵測
│       │   ├── onboarding.ts
│       │   └── utils.ts
│       │
│       ├── modules/                # 42 個業務 / 系統模組
│       │   ├── residents/          # 住戶管理（5 子元件）
│       │   ├── expenses/           # 記帳（4 子元件 + tests）
│       │   ├── schedule/           # 班表（TrainingPanel）
│       │   ├── settings/           # 設定（5 子頁）
│       │   ├── home-tabs/          # 公告首頁
│       │   ├── facility-booking/   # 公設預約
│       │   ├── calendar/           # 行事曆
│       │   ├── backup/             # 備份
│       │   ├── monitoring/         # 監控 / 壓測
│       │   ├── ai/                 # AI SQL
│       │   ├── tools/              # 標籤列印 / PDF
│       │   ├── tutorials/          # 教學
│       │   └── onboarding/         # 首次使用引導
│       │
│       ├── modules-system/         # 商業模組系統（stub 為主）
│       │   ├── registry.ts
│       │   ├── ModulesPage.tsx
│       │   ├── ModuleGuard.tsx
│       │   ├── modules/            # accounts / audit / bank-reconcile / ...
│       │   └── pages/              # 對應頁面 stub
│       │
│       ├── monitoring/             # 監控核心
│       │   ├── core.ts
│       │   ├── hooks.ts
│       │   ├── init.ts
│       │   └── stress-test.ts
│       │
│       ├── notifications/          # 站內通知
│       │   ├── system.ts
│       │   └── NotificationBell.tsx
│       │
│       ├── reports/                # PDF / Excel 匯出
│       │   ├── export.ts
│       │   └── font.ts
│       │
│       ├── security/               # 加密
│       │   ├── crypto.ts
│       │   └── field-encryption.ts
│       │
│       ├── storage/                # ===== 客戶端儲存層 =====
│       │   ├── adapter.ts          # sql.js + IndexedDB adapter
│       │   ├── indexedDBAdapter.ts
│       │   ├── database.ts         # Repository<T> 通用 CRUD
│       │   ├── migrations.ts       # schema 版本升級
│       │   ├── schema.ts           # 36 表 SQL（含 client-only app_logs / app_settings；server 端為 34 表）
│       │   ├── hooks.ts            # useDatabase 等 hooks
│       │   ├── backupManager.ts    # 三格式備份 (.db/.json/.json.gz)
│       │   ├── appLog.ts
│       │   └── seedTutorials.ts
│       │
│       ├── stores/                 # ===== Zustand 狀態 =====
│       │   ├── index.ts
│       │   ├── residentStore.ts
│       │   ├── expenseStore.ts
│       │   ├── scheduleStore.ts
│       │   ├── settingsStore.ts
│       │   ├── holidayStore.ts
│       │   ├── homeTabsStore.ts
│       │   ├── facilityBookingStore.ts
│       │   └── v1Store.ts
│       │
│       ├── styles/
│       │   └── globals.css
│       │
│       ├── test/                   # 測試
│       │   ├── setup.ts
│       │   ├── components.test.tsx
│       │   ├── modules.test.ts
│       │   ├── monitoring.test.ts
│       │   ├── sql-validator.test.ts
│       │   ├── crypto.test.ts
│       │   └── ai-config.test.ts
│       │
│       ├── types/
│       │   ├── expense.ts
│       │   └── subset-font.d.ts
│       │
│       └── utils/
│           ├── format.ts
│           └── format.test.ts
│
├── server/                         # ============================
│   ├── package.json                # @v4-resident/server
│   ├── tsconfig.json
│   ├── Dockerfile                  # multi-stage build (tsc → node:22-alpine)
│   ├── data/                       # SQLite 持久化（.db 檔）
│   ├── dist/                       # tsc 編譯產物
│   ├── start-with-cloud.mjs        # 雲端硬碟鏡像啟動腳本
│   ├── smoke.log / smoke-err.log
│   └── src/
│       ├── index.ts                # Fastify 入口 + 32 個 route 註冊
│       ├── openapi.ts              # OpenAPI spec 產生器
│       ├── fastify-types.ts        # Fastify 型別擴充
│       │
│       ├── db/
│       │   ├── index.ts            # initDatabase + healthCheck + db singleton
│       │   ├── schema.ts           # 34 表 CREATE TABLE + indexes（ALL_TABLES 為 server 端 single source of truth）
│       │   └── repository.ts       # Repository<T> 通用 CRUD（與 client 對稱）
│       │
│       └── routes/                 # 32 個資源路由
│           ├── _crud.ts            # 共用 schema (idParam / notFound)
│           ├── residents.ts        # 主住戶 + members + keycards 子路徑
│           ├── resident-parking.ts
│           ├── resident-emergency-contacts.ts
│           ├── decoration-records.ts
│           ├── buildings.ts
│           ├── floors.ts
│           ├── facilities.ts
│           ├── facility-bookings.ts
│           ├── parking-spots.ts
│           ├── parking-binding.ts
│           ├── parking-statuses.ts
│           ├── house-statuses.ts
│           ├── status-options.ts
│           ├── expenses.ts
│           ├── expense-budgets.ts
│           ├── allowance-holders.ts
│           ├── allowance-records.ts
│           ├── schedule.ts
│           ├── employees.ts
│           ├── shifts.ts
│           ├── schedule-entries.ts
│           ├── schedule-holidays.ts
│           ├── schedule-notes.ts
│           ├── holidays.ts
│           ├── holiday-categories.ts
│           ├── training.ts
│           ├── calendar-events.ts
│           ├── home-tabs.ts
│           ├── home-records.ts
│           ├── backup-history.ts
│           ├── settings.ts
│           └── license.ts
│
├── shared/                         # ============================
│   ├── package.json                # @v4-resident/shared
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                # 統一出口
│       ├── types/
│       │   └── index.ts            # EntityId / Timestamp / 共用 type
│       └── validation/
│           └── index.ts            # 共用 Zod schemas
│
├── cli/                            # ============================
│   ├── package.json                # @v4-resident/cli
│   ├── tsconfig.json
│   ├── README.md
│   └── src/
│       ├── index.ts                # CLI 入口
│       ├── argparse.ts             # 參數解析
│       ├── http.ts                 # server API client
│       ├── output.ts               # table / JSON / CSV formatter
│       └── commands/
│           ├── index.ts            # 命令註冊表
│           ├── _registry.ts
│           ├── _crud.ts            # 共用 CRUD 命令骨架
│           ├── residents.ts
│           ├── expenses.ts
│           ├── home-tabs.ts
│           ├── schedule.ts
│           └── settings.ts
│
├── docs/                           # 模組設計文件
│   └── *.md
│
├── V4/                             # ============================
│   ├── PRD.md                      # 產品需求（本 repo 文件）
│   └── PROJECT_FRAME.md            # 技術架構（本檔）
│
└── .mavis/                         # 規劃 / 決策
    ├── plans/
    │   ├── plan.yaml
    │   ├── plan-v1.1.yaml
    │   ├── v4-architect-plan.yaml
    │   └── decision.json
    └── ...
```

---

## 3. 模組邊界（Go-style 三層）

### 3.1 整體拓樸

```
┌────────────────────────────────────────────────────┐
│                   Browser (PC)                      │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │  React   │  │ Zustand  │  │  TanStack Table  │ │
│  │  View    │←→│  Store   │←→│  Chart.js        │ │
│  └────┬─────┘  └────┬─────┘  └──────────────────┘ │
│       │              │                              │
│       │       ┌──────┴──────┐                       │
│       │       │  Hooks      │ (useResidents 等)    │
│       │       └──────┬──────┘                       │
│       │              │                              │
│       │       ┌──────┴──────┐                       │
│       └──────→│  API client │ (api.<resource>)      │
│                └──────┬──────┘                       │
│                       │ fetch                        │
│  ┌────────────────────┴────────────────────────┐   │
│  │  Storage layer: sql.js (WASM) + IndexedDB    │   │
│  │  Repository<T> 通用 CRUD                      │   │
│  └────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP (Fastify)
┌──────────────────────┴──────────────────────────────┐
│              Fastify Server (Node 20)               │
│                                                     │
│   ┌──────────┐  ┌──────────┐  ┌───────────────┐   │
│   │ Route    │→│Repository│→│  SQLite       │   │
│   │(32 files)│  │  (通用)   │  │  (better-     │   │
│   │          │  │          │  │   sqlite3)    │   │
│   └──────────┘  └──────────┘  └───────────────┘   │
│        ↑                                           │
│        │ JSON Schema 驗證 (Zod via TypeBox)        │
└─────────────────────────────────────────────────────┘
```

### 3.2 Go-style 三層原則

V4 模仿 Go 的標準專案結構（route → service → repository），但簡化成兩層（route → repository），因為商業邏輯目前還很薄、不需要 service 層：

| 層 | 職責 | 不做什麼 |
|----|------|----------|
| **Route**（Fastify handler） | 1. 接收 HTTP request<br>2. JSON Schema 驗證 body / params<br>3. 呼叫 Repository<br>4. 組裝 response<br>5. 錯誤轉拋 | 不直接寫 SQL、不直接操作 DB |
| **Repository**（`server/src/db/repository.ts`） | 1. SQL CRUD（getAll / getById / create / update / delete）<br>2. 欄位 snake_case ↔ camelCase 自動轉換<br>3. ID / 時間戳自動填入<br>4. 用 PRAGMA table_info 內省表結構 | 不處理 HTTP 邏輯、不處理業務規則 |
| **Schema**（`server/src/db/schema.ts`） | 1. 34 表 CREATE TABLE 定義（ALL_TABLES 為 single source of truth）<br>2. FK / Index 宣告<br>3. 預設資料（status_options / house_statuses 等） | — |

### 3.3 對稱性：Client ↔ Server

V4 刻意讓 client 端的 `client/src/storage/database.ts` 與 server 端的 `server/src/db/repository.ts` **結構對稱**：

| 能力 | Client (sql.js + IndexedDB) | Server (better-sqlite3) |
|------|------------------------------|---------------------------|
| Repository 類別 | `class Repository<T>` | `class Repository<T>` |
| CRUD 方法 | getAll / getById / create / update / delete / findBy / count | 同上 |
| 欄位轉換 | camelCase ↔ snake_case | 同上 |
| ID 生成 | `generateId()` | 同上 |
| 時間戳 | `nowIso()` | 同上 |

差異只在底層（sql.js 走 WASM、better-sqlite3 走 N-API），上層 API 完全一致。

### 3.4 Hooks / API / Store 三層職責

| 層 | 檔案 | 職責 |
|----|------|------|
| **Hooks** | `client/src/hooks/useXxx.ts` | 1. 從 server fetch → 快取<br>2. 提供 mutate（create / update / delete）<br>3. 提供 loading / error 狀態<br>4. 訂閱 Zustand store 變更 |
| **API** | `client/src/api/xxx.ts` | 純 fetch wrapper（無 React 依賴） |
| **Store** | `client/src/stores/xxxStore.ts` | 全域狀態（不直接發 fetch，由 hooks 觸發） |

**規則**：hooks 唯一可以同時 import API + Store；API 與 Store 不互相依賴。

---

## 4. 資料模型

### 4.1 SQLite 34 表總覽（server 為 single source of truth）

完整 schema 定義在 [`server/src/db/schema.ts`](../../server/src/db/schema.ts) + [`client/src/storage/schema.ts`](../../client/src/storage/schema.ts)。

**數字校驗（2026-06-25 探勘時實際命令輸出）**：
- Server `ALL_TABLES`：`SELECT-String` 計數 = **34**
- Client schema：`SELECT-String` 計數 = **36**（多 2 表 `app_logs` / `app_settings`，純 client-only）
- 兩者共用 34 表；client 額外的 2 表是 local-only 應用狀態，不走 server

**Client 與 Server 的對應關係**：`client/src/storage/schema.ts` 與 `server/src/db/schema.ts` 同步設計、同步維護。新增表時兩邊都要加，server 端是 API 對外契約，client 端是 IndexedDB 本地快取。

| # | 表名 | 用途 | V1/V4 |
|---|------|------|-------|
| 1 | `status_options` | 通用狀態選項（住戶/車位） | V4 |
| 2 | `house_statuses` | 房屋狀態 | V1 |
| 3 | `parking_statuses` | 車位狀態 | V1 |
| 4 | `buildings` | 建築物 | V1 |
| 5 | `floors` | 樓層 | V4 |
| 6 | `facilities` | 公設 | V4 |
| 7 | `parking_spots` | 車位 | V1 |
| 8 | `residents` | 住戶主表 | V1 |
| 9 | `resident_members` | 住戶成員（多筆） | V1 |
| 10 | `resident_keycards` | 鑰匙卡 | V1 |
| 11 | `resident_parking` | 住戶 ↔ 車位多對多綁定 | V4 |
| 12 | `resident_emergency_contacts` | 區權人緊急聯絡人（多筆） | V4 |
| 13 | `decoration_records` | 裝潢記錄（含圖片） | V4 |
| 14 | `facility_bookings` | 公設借用紀錄 | V4 |
| 15 | `expense_categories` | 收支類別 | V1 |
| 16 | `expense_records` | 收支記錄 | V1 |
| 17 | `expense_budget` | 預算 | V1 |
| 18 | `allowance_holders` | 零用金持有人 | V4 |
| 19 | `allowance_records` | 零用金記錄 | V4 |
| 20 | `allowance_transactions` | 零用金交易 | V4 |
| 21 | `employees` | 員工 | V1 |
| 22 | `shifts` | 班別 | V1 |
| 23 | `shift_statuses` | 班別狀態 | V1 |
| 24 | `schedule_entries` | 班表記錄 | V1 |
| 25 | `schedule_holidays` | 排班假日 | V1 |
| 26 | `schedule_notes` | 排班備註 | V4 |
| 27 | `holiday_categories` | 假日分類 | V4 |
| 28 | `holidays` | 假日（國定/自訂） | V1 |
| 29 | `calendar_events` | 行事曆事件 | V4 |
| 30 | `day_colors` | 日期顏色標記 | V4 |
| 31 | `training_records` | 員工訓練 | V4 |
| 32 | `home_tabs` | 首頁分頁 | V1 |
| 33 | `home_records` | 首頁公告 | V1 |
| 34 | `backup_history` | 備份紀錄 | V4 |

> **Client 端另有 2 表**（不在 server `ALL_TABLES`）：`app_logs`（前端錯誤 / 操作日誌）、`app_settings`（前端個人化設定）。這 2 表純本地，不走 API。

### 4.2 索引策略

- 所有 FK 欄位都有 `idx_<table>_<fk>` 索引
- 高頻查詢欄位：`residents(floor, unit_number)`、`expense_records(date, category_id, type)`、`schedule_entries(date, assignee_id)`、`parking_spots(status)`

### 4.3 預設資料（種子）

`schema.ts` 同時匯出預設資料（啟動時 INSERT OR IGNORE 寫入）：
- `DEFAULT_STATUSES`（5 筆：住戶 3 + 車位 2）
- `V1_DEFAULT_PARKING_STATUSES`（4 筆）
- `V1_DEFAULT_HOUSE_STATUSES`（4 筆）
- `V1_DEFAULT_EXPENSE_CATEGORIES`（11 筆：水電/瓦斯/管理費/.../其他收入）

### 4.4 儲存位置

`.db` 檔可放在兩處（用戶在 StorageSettings 切換）：
- **本地資料夾**：`server/data/resident-system.db`（預設）
- **雲端硬碟鏡像資料夾**：`C:\Users\<user>\OneDrive\<mirror>\v4.db` 或 `D:\GoogleDrive\<mirror>\v4.db`
  - 用雲端硬碟（OneDrive / Google Drive / iCloud）鏡像資料夾做「免費跨裝置備份」
  - **風險**：同時多裝置寫入會 conflict；單機使用 OK

---

## 5. API 契約（32 個 Route）

### 5.1 系統端點（3）

| 方法 | 路徑 | 用途 |
|------|------|------|
| GET | `/api/health` | 健康檢查 |
| GET | `/api/info` | 系統資訊（Node 版本、表數、uptime） |
| GET | `/api/openapi.json` | OpenAPI 3 spec |

### 5.2 業務端點（29 個資源）

| 路徑 prefix | 對應表 / 模組 |
|------------|---------------|
| `/api/residents` | 住戶主表 + `/:id/members` + `/:id/keycards` 子路徑 |
| `/api/resident-parking` | 住戶 ↔ 車位綁定 |
| `/api/resident-emergency-contacts` | 區權人緊急聯絡人 |
| `/api/decoration-records` | 裝潢記錄 |
| `/api/buildings` | 建築物 |
| `/api/floors` | 樓層 |
| `/api/facilities` | 公設 |
| `/api/facility-bookings` | 公設借用 |
| `/api/parking-spots` | 車位 |
| `/api/parking-binding` | 車位綁定操作 |
| `/api/parking-statuses` | 車位狀態 |
| `/api/house-statuses` | 房屋狀態 |
| `/api/status-options` | 通用狀態 |
| `/api/expenses` | 收支 |
| `/api/expense-budgets` | 預算 |
| `/api/allowance-holders` | 零用金持有人 |
| `/api/allowance-records` | 零用金記錄 |
| `/api/schedule` | 班表（含 employees / shifts / holidays 子路徑） |
| `/api/schedule-entries` | 班表記錄（獨立路由） |
| `/api/schedule-holidays` | 排班假日 |
| `/api/schedule-notes` | 排班備註 |
| `/api/employees` | 員工 |
| `/api/shifts` | 班別 |
| `/api/holidays` | 假日 |
| `/api/holiday-categories` | 假日分類 |
| `/api/training` | 員工訓練 |
| `/api/calendar-events` | 行事曆 |
| `/api/home-tabs` | 首頁分頁 |
| `/api/home-records` | 首頁公告 |
| `/api/backup-history` | 備份紀錄 |
| `/api/settings` | 設定 |
| `/api/license` | License 系統 |

**每個資源提供統一 CRUD**：
- `GET /` — list
- `GET /:id` — getById
- `POST /` — create
- `PUT /:id` — update
- `DELETE /:id` — delete

**特殊子路徑**（範例：residents）：
- `GET /search?q=` — 關鍵字搜尋
- `GET /building/:buildingId` — 依建築物
- `GET /:id/members`、`POST /:id/members` — 子資源

### 5.3 錯誤格式

所有錯誤統一格式（`server/src/index.ts` 的 `schemaErrorFormatter` + `setErrorHandler`）：
```json
{
  "statusCode": 400,
  "error": "ValidationError",
  "message": "請求參數驗證失敗",
  "details": [
    { "path": "/name", "message": "must NOT have fewer than 1 characters", "params": {...} }
  ]
}
```

### 5.4 OpenAPI 自動產生

`server/src/openapi.ts` 掃描所有 route 的 schema（每個 route 都有 `tags` / `summary`），自動產生 OpenAPI 3 spec → `GET /api/openapi.json`。

---

## 6. 部署架構

### 6.1 三種啟動方式

#### 方法 A：直接打開（最簡）

```
client/dist/index.html  →  雙擊  →  Chrome 開啟
```

- 適用：個人使用、零設定
- 限制：不能用 service worker（PWA 不完整）、不能 fetch server API

#### 方法 B：HTTP server（推薦）

```powershell
# 前端
cd client
npx vite preview --port 4173

# 後端
cd server
npx tsx src/index.ts          # port 3001
```

- 適用：完整功能（fetch server、API 互動）
- 啟動時間：< 5 秒

#### 方法 C：PowerShell HttpLauncher（整合）

```powershell
# 根目錄
.\start.ps1                   # 或 .\v4.bat
```

- 自動啟動 server + 前端於 port 9527（單 port 統一）
- `client\dist\start-server.ps1` 已有實作
- 適用：日常使用，一鍵啟動

### 6.2 Docker（正式部署）

```yaml
# docker-compose.yml
services:
  api:
    build: ./server
    image: v4-resident-api:latest
    ports: ["3001:3001"]
    volumes: ["v4-data:/data"]
    environment:
      - PORT=3001
      - NODE_ENV=production
  web:
    build: ./client
    image: v4-resident-web:latest
    ports: ["8080:80"]
    depends_on: [api]
volumes:
  v4-data:
```

- **image 大小**：api ~120MB、web ~30MB（nginx:alpine）
- **記憶體**：api ~80MB idle、web ~10MB idle
- **適用**：4GB RAM VPS（如 Hetzner CX22、Oracle Cloud free tier）

### 6.3 雲端硬碟鏡像（個人備份）

```
[本機 .db]  ←定時同步→  [OneDrive/Google Drive 鏡像資料夾]
                          ↓
                       其他裝置可拉取
```

- 用戶在 StorageSettings 設定鏡像資料夾路徑
- 自動偵測是否在鏡像資料夾內 → 警告「可能與其他裝置衝突」

### 6.4 環境變數

| 變數 | 預設值 | 用途 |
|------|--------|------|
| `PORT` | 3001 | Server port |
| `HOST` | 0.0.0.0 | Bind host |
| `NODE_ENV` | development | production → 嚴格 CORS + 隱藏 stack |
| `LOG_LEVEL` | info | pino log level |
| `ALLOWED_ORIGINS` | — | production CORS 白名單（逗號分隔） |

---

## 7. 實作切片（Phase 進度）

### 7.1 已完成（5 phases）

| Phase | 名稱 | 產出 |
|-------|------|------|
| **1** | 專案骨架（Scaffold） | pnpm workspace + client / server / shared / cli 4 packages + tsconfig + vite + tailwind + README |
| **2** | 共享類型 + Zod validation | `shared/src/types` + `shared/src/validation` + EntityId / Timestamp 公用型別 |
| **3** | 後端資料庫層 | `server/src/db/schema.ts`（34 表 ALL_TABLES）+ `repository.ts`（通用 Repository<T>）+ `index.ts`（initDatabase + healthCheck） |
| **4** | 後端 Fastify API | `server/src/index.ts` + 32 個 `routes/*.ts` + OpenAPI 自動產生 + 統一錯誤處理 |
| **5** | 前端應用 | client 全套：storage adapter（sql.js + IndexedDB） + Repository<T> + 30 API modules + 25 hooks + 9 個 Zustand stores + 11 個 UI 原子 + 42 個業務模組 + AI SQL 助手 + 監控 + PWA 配置 + i18n（zh-TW / en） |

### 7.2 待做（4 phases）

| Phase | 名稱 | 預期產出 | 對應 task |
|-------|------|----------|----------|
| **6** | Docker 化 | server Dockerfile（multi-stage node:22-alpine）+ client Dockerfile（nginx:alpine SPA fallback）+ docker-compose.yml（api + web + v4-data volume）+ deploy.example.sh | `docker-deploy` |
| **7** | i18n 多語系 | i18next + 3 語 locale（zh-TW baseline + zh-CN + en）+ Sidebar 語言切換 + i18n.test.ts | `i18n-multilang`（部分已完成 locale 檔） |
| **8** | PWA 強化 | vite-plugin-pwa + manifest + icons（192/512）+ Service Worker precache + OfflineBanner + autoUpdate 提示 | `pwa-offline` |
| **9** | 最終整合驗證 | typecheck + test + build + docker-compose up + curl /api/health + INTEGRATION_REPORT.md | `final-integration` |

### 7.3 已知技術債

| 項目 | 影響 | 處理方式 |
|------|------|----------|
| Client / Server 端 `repository.ts` 有部分重複 | 維護成本 | 已對稱設計；共用部分可在未來抽到 `shared/` |
| `client/src/storage/schema.ts` 與 `server/src/db/schema.ts` 重複 | 維護成本 | 已加 JSDoc 互相參照；未來考慮 codegen |
| 部分 route 還是用 `additionalProperties: true` 寬鬆驗證 | 安全性 / 文件性 | 強化 Zod schema |
| Playwright E2E timeout 問題 | CI 不穩 | 預啟 dev server + reuseExistingServer |

---

## 8. 監控與可觀測性

| 工具 | 用途 |
|------|------|
| `client/src/monitoring/` | 客戶端錯誤收集 + 效能監控 + 壓測 |
| `fastify.log`（pino） | 伺服器結構化日誌（JSON 格式可餵 Loki / ELK） |
| `/api/health` + `/api/info` | 健康檢查 + 系統資訊（可串 Uptime Kuma） |
| `pino-pretty` | 開發模式彩色輸出 |

---

## 9. 開發流程

### 9.1 安裝

```powershell
git clone <repo>
cd v4-resident-system
pnpm install
```

### 9.2 開發模式

```powershell
# 同時啟 client + server
pnpm dev

# 分別啟動
pnpm --prefix server dev          # port 3001, tsx watch
pnpm --prefix client dev          # port 5173, vite HMR
```

### 9.3 測試

```powershell
pnpm --prefix client test         # vitest unit
pnpm --prefix client test:e2e     # playwright E2E
pnpm --prefix client typecheck    # tsc --noEmit
```

### 9.4 建置

```powershell
pnpm build                        # 全部 packages
pnpm --prefix client build        # tsc + font subset + vite build
pnpm --prefix server build        # tsc → dist/
```

### 9.5 啟動生產

```powershell
pnpm --prefix server start        # node dist/index.js
npx vite preview --port 4173      # client/dist/
```

---

## 10. 決策紀錄（為什麼這樣選）

| 決策 | 替代方案 | 選 V4 的理由 |
|------|----------|--------------|
| 純前端 + Fastify 後端（兩 process） | Next.js 全端 | 兩 process 易除錯、AI 看 code 不用理解 SSR |
| sql.js WASM + IndexedDB（前端） | Dexie / localStorage | 與 server 同 SQL 語法、易遷移、WASM 效能好 |
| Fastify | Express / Nest | 快 2 倍、JSON Schema 內建、輕量 |
| better-sqlite3 | sqlite3 / Sequelize | 同步 API 最簡潔、原生 N-API 效能最佳 |
| Zod | Yup / Joi | TypeScript inference 最好、與 React Hook Form 整合佳 |
| Zustand | Redux / Jotai | 80% 場景已足夠、零 boilerplate |
| Tailwind | styled-components | 不用寫 CSS、AI 生成樣式直覺、bundle 小 |
| PowerShell HttpLauncher | Electron / Tauri | 不包 exe、AI 看得到原始碼、除錯容易 |
| pnpm workspace | npm workspaces / Yarn | 快、磁碟省、嚴格依賴 |
| Docker 多階段 build | single-stage | image 從 1GB 縮到 30-120MB |

---

## 附錄：對應檔案索引

| 需求類別 | 對應檔案 |
|----------|----------|
| 產品定義 | [PRD.md](./PRD.md) |
| 程式碼 | `client/src/`、`server/src/`、`shared/src/`、`cli/src/` |
| 啟動腳本 | `start.ps1`、`v4.bat`、`docker-compose.yml` |
| 文件 | `README.md`、`CHANGELOG.md`、`docs/` |
| 規劃 | `.mavis/plans/` |