# CHANGELOG.md — V4 大樓住戶管理系統

> 格式：[Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/) v1.1.0
> 語意化版本：[Semantic Versioning](https://semver.org/lang/zh-TW/) 2.0.0
> 對應程式庫：`C:\Users\sunpe\dev\v4-resident-system\`

所有「重要變更」都標記在此檔。版本號遵循 `V<major>.<minor>` 慣例（V1 → V4 是產品線大版本，V4.0 → V4.1 是同產品的迭代）。

---

## [Unreleased]

### 規劃中（待排期）

#### Phase 6 — 後端 services 層
- **Added**：將業務邏輯從 routes 抽離為獨立 services 層（route → service → repository → schema）
- **Changed**：`server/src/routes/*.ts` 僅保留 HTTP 綁定，商業規則與驗證委派給 `server/src/services/*.ts`
- **目的**：便於單元測試 + 跨 routes 共用邏輯 + AI agent 更容易理解層次

#### Phase 7 — 每日自動備份
- **Added**：在 server 內啟用 node-cron，每日 02:00 自動把 `.db` 快照到 `G:\我的雲端硬碟\V4住戶管理\backup\YYYY-MM-DD.db`
- **Added**：保留 7 天滾動歷史（過期自動刪除）
- **Added**：`backup_history` 表新增排程備份紀錄（與手動備份區分）

#### Phase 8 — PowerShell 啟動器 + Windows Task Scheduler
- **Added**：`v4.bat` / `start.ps1` 一鍵啟動 server + client vite preview
- **Added**：Windows Task Scheduler 註冊每日排程（開機自動啟動 + 每日 02:00 觸發備份）

#### Phase 9 — 移除 sql.js WASM / IndexedDB / FSA 死碼
- **Removed**：`client/src/storage/database/adapter.ts`（sql.js WASM 介面層）
- **Removed**：`client/src/storage/database/indexedDBAdapter.ts`（前端 IndexedDB fallback）
- **Removed**：FSA / File System Access API 相關 polyfill
- **Removed**：v1Store.ts（V1 localStorage 相容層）— V4 全面改用 fetch API
- **目的**：減少 bundle size、避免 AI agent 誤讀已棄用路徑

---

## [V4.0] - 2026-06-25

V4 主線第一個穩定版。**純前端 + Go-style 三層架構 + Fastify 後端 + SQLite** 完整上線。

### Added

#### 架構 — 前端到後端完整三層
- 純前端 React 19 + TypeScript 5 + Vite 5 + Tailwind CSS 3
- 後端 Fastify 4 + better-sqlite3 11 + Zod 3
- Go-style 三層架構（route → repository → schema）— 取代 V3 的「store 直接吃 sql.js」
- 共享型別 + Zod validation 在 `shared/` workspace（前端後端共用同一份 schema）

#### 後端 API（33 個 routes）
- 健康檢查 + 中介層：`/api/health`、`/api/info`、`/api/openapi.json`
- 22 個既有業務 routes（residents / expenses / schedule / settings / home-tabs / floors / facilities / house-statuses / parking-statuses / employees / shifts / schedule-holidays / training / allowance-holders / allowance-records / expense-budgets / backup-history / home-records / calendar-events）
- 11 個新補 routes（parking-spots / status-options / parking-binding / resident-parking / resident-emergency-contacts / decoration-records / facility-bookings / holidays / holiday-categories / schedule-entries / schedule-notes）

#### 前端層（30 API + 25 hooks）
- 30 個 API 契約（`client/src/api/`）— 統一 fetch 介面
- 25 個 React hooks（`client/src/hooks/`）— 封裝 loading / error / data
- 8 個 Zustand stores 全部抽換（queryAll / execute → fetch API）
- 13 個 modules 內 queryAll 全部抽換
- vite proxy `/api → localhost:3001`（dev + preview 都加）

#### 資料庫（37+ 個 tables）
- 完整 SQLite schema（涵蓋 V1 業務 + V4 新增 + 會計 + 報表）
- 新增表（V4 才有）：`app_settings`、`holiday_categories`、`decoration_records`、`parking_binding`、`resident_parking`、`resident_emergency_contacts`、`facility_bookings`、`schedule_notes` 等

#### 部署
- Docker compose（web + api，volume 命名 `v4-data`）
- PC Windows：`client\dist\index.html` 雙擊直接開啟（method A）
- HTTP server：`npx vite preview --port 4173`（method B）
- 雲端硬碟鏡像：`.db` 放 OneDrive / Google Drive 鏡像資料夾 → 自動備份

#### 測試基礎
- OpenAPI schema 自動產生（`GET /api/openapi.json` 回傳 200，列所有 endpoints）
- V4 API 驗收測試腳本（17/30 endpoints PASS；剩 13 個為測試 body 待修，非 API bug）

### Changed

#### Phase 1 — vite proxy + apiClient + buildings 抽換範例（2026-06-25）
- 從 V3 的「瀏覽器 sql.js WASM 讀 .db」改為「瀏覽器 → fetch → Fastify → better-sqlite3」
- vite proxy 設定讓 `/api/*` 自動轉發到 `localhost:3001`
- `buildingsStore` 作為第一個抽換範例，確立「store 改用 hooks 不用 queryAll」的 pattern

#### Phase 2 — 30 個 API + 25 個 hooks 建立（2026-06-25）
- 前端契約層完成 — 每個業務模組對應一份 API + 一份 hooks

#### Phase 3 — 4 worker 並行抽換 8 stores + 13 modules（2026-06-25）
- 並行 worker 把 V3 時代的 `database.queryAll()` / `database.execute()` 全部改為 fetch API
- 跨瀏覽器一致行為（V3 sql.js WASM 在 Firefox / Safari 會有 WASM 載入競態）

#### Phase 4 — modules 內 queryAll 全部抽換（2026-06-25）
- 收尾所有 module 層的 sql.js 引用
- store API gap 補齊：擴 `homeTabsStore.addRecord` / `updateRecord` 支援 `imageBase64` / `pinned`，讓 module 內的 execute 能安全移除

#### Phase 5 — 補 server 11 個 routes + db 救援 + schedule.ts BUG 修（2026-06-25）
- 並行 worker 寫入造成 schema.ts / repository.ts race → SQLite 損毀
- 用 better-sqlite3 重建（資料完整保留）
- schedule.ts BUG：班表日期比較時區錯誤（fixed）

### Fixed

- **並行 worker race**：`schema.ts` / `repository.ts` 在多 worker 同時編輯時產生不一致 → 統一由主 worker 寫入 + 子 worker 只新增 routes 檔
- **schedule.ts 時區 BUG**：班表月份邊界判斷用 UTC 造成跨日錯誤 → 改用本地時區
- **vite preview HTTP cache**：Edge 瀏覽器會 cache 舊 build → 加 `Cache-Control: no-store`
- **V3 holidays schema drift**：server 端 `holidays` 表少 `category_id / color / notes` 欄位 → 統一改由 client API 送、server 接受 `additionalProperties`
- **storage adapter 介面不一致**：`adapter.ts`（sql.js）vs `indexedDBAdapter.ts` 對外介面漂移 → V4 統一走 fetch，adapter 直接刪除（Phase 9）

### Removed

- **Phase 3 起**：client 端不再 import `sql.js`、`better-sqlite3-wasm`、`opfs`、`fsa`、`@originjs/vite-plugin-commonjs`（V3 時代依賴）
- **Phase 4 起**：所有 module 內 `database.execute()` / `database.queryAll()` 直接呼叫全部消失

---

## [V3] - 2025-Q2 ~ Q3 — sql.js WASM + 模組化（已廢棄）

> 純前端 WASM 資料庫 + 雲端硬碟鏡像部署的實驗版。

### Added

#### 架構
- 純前端 sql.js WASM（SQLite compiled to WebAssembly）+ IndexedDB 雙層
- Zustand 狀態管理 + TanStack Table 資料表
- 模組化架構：10+ 業務模組（住戶 / 記帳 / 班表 / 公告 / 設定 / 工具 / 行事曆 / 公設預約 / 標籤 / PDF）

#### 部署模式
- **雲端硬碟鏡像部署**：PowerShell HttpLauncher（小型 PowerShell HTTP server） 把 `client/dist/` 掛到本地 port，整個資料夾鏡像到 Google Drive 讓多裝置同步
- **Edge App mode**：把 `client/dist/index.html` 釘選到 Edge / Chrome 應用程式捷徑，從開始選單啟動（無需瀏覽器開啟首頁）

#### 資料庫
- 28 個業務表（涵蓋住戶 / 車位 / 樓層 / 公設 / 記帳 / 班表 / 培訓 / 公告）
- Web Worker 跑 sql.js 不卡 UI

#### 整合工具
- 班表（含國定假日自動標紅）
- 標籤列印（自訂標籤紙尺寸）
- PDF / Excel 匯出（自訂中文楷體字型 subset）
- 教學 / 說明外部工具

### Changed

- 從 V2 的 IndexedDB-only 改為 sql.js WASM 主、IndexedDB 輔助（用戶資料量大後純 IndexedDB 不夠用）
- 從 V2 的響應式設計改為純桌面版（用戶確認只使用 PC）

### Fixed

- 修補 V2 的雲端同步複雜度爆增問題（V3 改用「雲端硬碟鏡像整包資料夾」取代「資料雙向同步」）

### Removed

- PWA service worker（V2 實驗，V3 移除）
- 響應式設計（V2 的 over-design）

---

## [V2] - 2025-Q1 — IndexedDB + Dexie.js（過渡版）

> 突破 V1 localStorage 4.5MB 上限，加入 i18n 與基本模組化。

### Added

#### 資料層
- Dexie.js（IndexedDB 封裝庫），突破 5MB 上限
- 多 store 結構（不再單一 JSON blob）

#### i18n
- 三語切換：zh-TW / en / ja
- 抽換 strings 檔即可切語系

#### 模組化
- 基本模組化（5 大模組：住戶 / 記帳 / 班表 / 公告 / 設定）
- 從 V1 的「單一 HTML + 內嵌 JS」改為「多檔 + ES modules」

#### 響應式設計
- 桌面 + 平板 + 手機 layout（後來證實 over-design）

#### PWA
- 離線可用 + 加到主畫面

### Fixed

- **V1 的 4.5MB 容量上限問題**：V2 用 IndexedDB 解決（實測可到數 GB）
- **V1 的 Excel 匯出亂碼問題**：V2 改用 UTF-8 BOM 處理

### Known Issues（V3 解決）

- 響應式對桌面用戶是過度設計 — V3 移除
- 雲端同步複雜度爆增 — V3 改用「雲端硬碟鏡像整包資料夾」

---

## [V1] - 2024-Q4 — Big5 + localStorage（已廢棄）

> 傳統老 App 思維的初版。單一 HTML + Vanilla JS + localStorage。

### Added

#### 核心功能
- 5 大模組：住戶 / 記帳 / 班表 / 公告 / 設定
- 純 HTML + Vanilla JS + localStorage
- Big5 編碼（用戶原本的 Windows 環境預設）
- 單一語系切換（多語言但手動切換）

#### 部署
- 本地 HTML 雙擊開啟（最簡部署）
- localStorage 永久保存（用戶不清瀏覽器資料就還在）

### Known Issues（V2 之後逐步解決）

- **容量上限 4.5MB**：localStorage 瀏覽器限制，超過就 `QuotaExceededError` → V2 改 IndexedDB
- **Excel 匯出亂碼**：Big5 + UTF-8 混用，匯出 CSV 在 Excel 開變亂碼 → V2 改 UTF-8 BOM
- **響應式差**：純桌面 layout，手機開幾乎不能用 → V2 加響應式（後來 V3 移除）
- **無雲端備份**：localStorage 綁瀏覽器，清資料 = 資料全失 → V3 改雲端硬碟鏡像

---

## 版本比較一覽表

| 維度 | V1 | V2 | V3 | **V4.0** |
|------|----|----|----|----------|
| **時間** | 2024-Q4 | 2025-Q1 | 2025-Q2~Q3 | 2026-06-25 |
| **狀態** | 已廢棄 | 已廢棄 | 已廢棄 | **本版** |
| **資料層** | localStorage | IndexedDB + Dexie | sql.js WASM + IndexedDB | Fastify + SQLite |
| **容量上限** | 4.5MB | ~數 GB | 數 GB | 數 TB（SQLite） |
| **編碼** | Big5 | UTF-8 | UTF-8 | UTF-8 |
| **i18n** | 單一語系 | 三語 | 三語 | 三語 |
| **後端** | 無 | 無 | 無（純前端 WASM） | Fastify + 33 routes |
| **部署** | HTML 雙擊 | HTML 雙擊 | PowerShell HttpLauncher + 雲端硬碟鏡像 + Edge App | Docker / Windows / 雲端硬碟鏡像 |
| **資料表數** | ~5 | ~10 | 28 | 37+ |
| **跨瀏覽器** | 一致 | 一致 | sql.js WASM 在 Firefox / Safari 有競態 | 一致 |
| **AI 友善** | ❌ 散落多檔 | ❌ 同 V1 | ⚠️ sql.js 黑箱 | ✅ 純 Web + 標準後端、原始碼全在 repo |

---

## 連結

- [AGENTS.md](./AGENTS.md) — V4 入口
- [STATUS.md](./STATUS.md) — 當前進度
- [PRD.md](./PRD.md) — 產品需求
- [PROJECT_FRAME.md](./PROJECT_FRAME.md) — 技術架構
- [FLOWS.md](./FLOWS.md) — 交互流程
- [FRONTEND_HANDOFF.md](./FRONTEND_HANDOFF.md) — 前端交接包
- [GATES.md](./GATES.md) — 驗收閘門
- [ERRORS.md](./ERRORS.md) — 歷史報錯

---

[Unreleased]: #unreleased
[V4.0]: #v40---2026-06-25
[V3]: #v3---2025-q2--q3--sqljs-wasm--模組化已廢棄
[V2]: #v2---2025-q1--indexeddb--dexiejs過渡版
[V1]: #v1---2024-q4--big5--localstorage已廢棄
