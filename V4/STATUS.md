# STATUS.md — V4 當前狀態

最後更新：2026-06-26

## 總體進度

| Phase | 描述 | 狀態 | 完成時間 |
|---|---|---|---|
| **Phase 1** | vite proxy + apiClient + buildings 抽換範例 | ✅ 完成 | 2026-06-25 |
| **Phase 2** | 30 個 API + 25 個 hooks 建立（前端契約層） | ✅ 完成 | 2026-06-25 |
| **Phase 3** | 4 worker 並行抽換 8 stores + 13 modules（sql.js → API） | ✅ 完成 | 2026-06-25 |
| **Phase 4** | modules 內 queryAll 全部抽換 | ✅ 完成 | 2026-06-25 |
| **Phase 5** | 補 server 11 個 routes + db 救援 + schedule.ts BUG 修 | ✅ 完成 | 2026-06-25 |
| **Phase 6** | 後端 services 層（業務邏輯從 routes 抽離） | ✅ 完成 | 2026-06-25 |
| **Phase 7** | BackupManager 四觸發（startup/hourly/daily/shutdown）+ idle skip + 30 天清理 | ✅ 完成 | 2026-06-27 |
| **Phase 8** | 雙擊啟動器（start-v4.bat → Edge App）+ 開機排程 | ✅ 完成 | 2026-06-27 |
| **Phase 9** | 移除 sql.js WASM / IndexedDB / FSA 死碼 | ✅ 完成 | 2026-06-25 |

## 當前版本：V4.2（2026-06-27）

完整 Go-style 架構，純本機儲存（repo/data/）+ BackupManager 四觸發備份 + 雙擊啟動器（Edge App）+ 7/7 驗收 PASS。

## 已完成的功能

### 後端（Fastify + better-sqlite3 + Zod）

- ✅ **33 個 routes** 全部 register（含 plan_1654a823 worker 補的 11 個）
- ✅ **domain/ + services/ 兩層**（building / holiday / resident / schedule）
- ✅ **BackupManager 四觸發備份**（startup 每啟動一次 / hourly 每小時 / daily 02:00 / shutdown 每次關機）+ idle skip + 30 天自動清理
- ✅ **idempotent migration**（holidays 表補 category_id/color/notes/created_at/updated_at）

### 前端（React + Vite + TypeScript + Tailwind）

- ✅ **30 個 API 契約**（`client/src/api/`）— 統一 fetch 介面
- ✅ **25 個 React hooks**（`client/src/hooks/`）— 封裝 loading/error/data
- ✅ **8 個 stores 全部抽換**（queryAll/execute → fetch API）
- ✅ **13 個 modules 內 queryAll 全部抽換**
- ✅ **HolidayCell 共用元件** — 套色到 calendar + facility-booking 月曆
- ✅ **vite proxy `/api` → `localhost:3001`**（dev + preview 都加）
- ✅ **vite preview `Cache-Control: no-store`**

### 部署工具

- ✅ **`start-v4.bat`** — Windows 雙擊啟動器（雙擊 → server 啟動 → 自動開 Edge App，普通人可用）
- ✅ **`start-v4.mjs`** — Node.js 起動器（developer 用，server + vite preview + Edge App）
- ✅ **`tools/install-autostart.ps1`** — 桌面捷徑 + 開機排程（支援 -Uninstall）
- ✅ **`V4/verify.mjs`** — Node.js 版 7 gate 驗收（Windows 友好）

### 資料庫

- ✅ **Schema**：34 tables（migration 後，含 app_settings / holiday_categories / decoration_records）
- ✅ **位於**：`repo/data/resident-system.db`（本機，雙擊 start-v4.bat 後自動建立）
- ✅ **救援**：sql.js → better-sqlite3 重建 + migration 補欄位（138 rows preserved）

## 驗收測試結果（V4/verify.mjs — 7 gate）

```
✓ Gate 1 Server build                PASS
✓ Gate 2 Client build                PASS
✓ Gate 3 Server smoke (5 endpoints)  PASS
✓ Gate 4 Client proxy smoke          PASS
✓ Gate 5 Full API test               30/30 PASS
✓ Gate 6 0 queryAll in stores/       PASS
✓ Gate 7 Dead code check             PASS

Totals: PASS=7  FAIL=0  WARN=0  SKIP=0
🎉 ALL GATES PASSED
```

執行方式：`node V4/verify.mjs`

## 當前版本：V4.0（2026-06-25）

完整 Go-style 架構上線，前後端分離，純接口前端 + Fastify 三層後端。

## 已完成的功能

### 後端（Fastify + better-sqlite3 + Zod）

- ✅ **33 個 routes** 全部 register（含 plan_1654a823 worker 補的 11 個）
  - health, info, openapi
  - 22 個業務 routes（residents / expenses / schedule / settings / home-tabs / floors / facilities / house-statuses / parking-statuses / employees / shifts / schedule-holidays / training / allowance-holders / allowance-records / expense-budgets / backup-history / home-records / calendar-events）
  - 11 個新 routes（parking-spots / status-options / parking-binding / resident-parking / resident-emergency-contacts / decoration-records / facility-bookings / holidays / holiday-categories / schedule-entries / schedule-notes）

### 前端（React + Vite + TypeScript + Tailwind）

- ✅ **30 個 API 契約**（`client/src/api/`）— 統一 fetch 介面
- ✅ **25 個 React hooks**（`client/src/hooks/`）— 封裝 loading/error/data
- ✅ **8 個 stores 全部抽換**（queryAll/execute → fetch API）
- ✅ **13 個 modules 內 queryAll 全部抽換**
- ✅ **vite proxy `/api` → `localhost:3001`**（dev + preview 都加）
- ✅ **vite preview `Cache-Control: no-store`**（避免 Edge HTTP cache 卡舊 build）

### 資料庫

- ✅ **Schema**：37+ tables（含 app_settings / holiday_categories / decoration_records 等 V4 新增）
- ✅ **位於**：`G:\我的雲端硬碟\V4住戶管理\resident-system.db`（393 KB / 138 rows）
- ✅ **救援**：今天 worker 並行寫入造成 corruption，已用 better-sqlite3 重建（資料完整保留）

## 驗收測試結果（V4 API 完整測試）

| 測試項 | 數量 | 結果 |
|---|---|---|
| **完整 CRUD PASS** | 17 個 endpoints | ✅ |
| **NOT IMPLEMENTED** | 0 個 | ✅ 之前 11 個全補 |
| **測試資料欄位錯 FAIL** | 13 個 endpoints | ⚠️ 測試 body 待修（FK parent 不存在 / NOT NULL 欄位缺 / schema 驗證） |
| **總計測試** | 30 個 endpoints | 17/30 PASS |

測試腳本：`workspace/test-all-endpoints.mjs`（Node.js）

## 下一步（按優先級）

### 高優先（立即可做）

1. **V4 文檔系統**（plan_742ea08a 派 4 worker 並行）
   - Worker 1: PRD.md + PROJECT_FRAME.md
   - Worker 2: FLOWS.md + FRONTEND_HANDOFF.md
   - Worker 3: GATES.md + check.sh
   - Worker 4: CHANGELOG.md

### 中優先（架構完善）

2. **Phase 6: 後端 services 層**（業務邏輯從 routes 抽離）
3. **Phase 9: 移除 sql.js WASM / IndexedDB / FSA 死碼**（檔案還在但 0 引用）

### 低優先（自動化 / 部署）

4. **Phase 7: 每日自動備份**（node-cron in server）
5. **Phase 8: PowerShell 啟動器 + 排程註冊**

### 測試資料修整（13 個 FAIL 端點）

測試 body 的 FK / NOT NULL / validation 欄位補齊（不是 API bug，是測試資料問題）。

## 重要檔案位置

| 檔案 | 路徑 |
|---|---|
| V4 文檔系統根目錄 | `C:\Users\sunpe\dev\v4-resident-system\V4\` |
| 用戶 .db 檔 | `G:\我的雲端硬碟\V4住戶管理\resident-system.db` |
| 用戶 V4 資料夾 | `G:\我的雲端硬碟\V4住戶管理\` |
| Server 啟動器 | `server/start-with-cloud.mjs` |
| Server 預設 port | 3001 |
| Client 預設 port | 9527（vite preview） |
| API 測試腳本 | `workspace/test-all-endpoints.mjs` |
| .db 救援腳本 | `workspace/repair-db.mjs` |

## 啟動指令

```powershell
# Server（背景跑）
Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "cd /d C:\Users\sunpe\dev\v4-resident-system\server && npx tsx start-with-cloud.mjs" -WindowStyle Hidden

# Client vite preview
Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "cd /d C:\Users\sunpe\dev\v4-resident-system\client && pnpm preview" -WindowStyle Hidden

# 驗收測試（未來）
bash V4/check.sh
```