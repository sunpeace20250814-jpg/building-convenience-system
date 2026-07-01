# V4 使用流程（FLOWS）

> 對象：實際使用 V4 大樓住戶管理的人。
> 目的：用「照著做就會用」的角度，描述每一條主要使用路徑。

---

## 0. 30 秒總覽

V4 是一個跑在瀏覽器（Edge / Chrome）裡的大樓管理軟體，資料存你家電腦。

| 你要做的事 | 流程所在章節 |
|------------|--------------|
| 第一次打開 V4 | §1 首次啟動 |
| 登入日常功能（住戶/記帳/班表） | §2 日常使用 |
| 換資料夾或搬電腦 | §3 儲存位置管理 |
| 整套搬去新電腦 | §4 資料遷移 |
| 換瀏覽器 / 不同瀏覽器輪流用 | §5 跨瀏覽器 |
| 開每日自動備份 | §6 自動備份（待做） |
| 怎麼部署、更新、雲端鏡像 | §7 部署流程 |

---

## 1. 首次啟動（DB 初始化 → Onboarding）

### 1.1 啟動方式

**桌面捷徑（一般使用者，99% 走這條）**

1. 雙擊桌面 `啟動 V4 住戶管理.bat`（或雲端版的捷徑）
2. BAT 會呼叫 `launcher.ps1`：
   - 停掉舊的 V4 server（標題為 `V4 HTTP Server` 的 PowerShell 視窗）
   - 啟動 PowerShell HttpListener server（port **9527**）
   - 開 Edge App mode（`--app=http://localhost:9527/`，1400×900）
3. 看到 V4 首頁 = 啟動成功

**開發者模式**

```powershell
# 在 repo root
pnpm install
pnpm --filter @v4-resident/shared run build
pnpm --filter @v4-resident/server run build
pnpm --filter @v4-resident/server run dev   # Fastify :3001
pnpm --filter @v4-resident/client run dev   # Vite :5173（proxy /api → :3001）
# 開 http://localhost:5173
```

或用 `start.ps1` / `start.bat` 一鍵開（會開兩個 PowerShell 視窗 + 自動等 server ready）。

### 1.2 DB 初始化流程

入口：`client/src/storage/database.ts → initDefaultStorage()`

```
首次啟動 V4
  ↓
App 判斷 localStorage 'v4-storage-backend'
  ├─ 'file-system'（少數進階使用者）
  │    ↓
  │  FileSystemAccessAdapter.restorePreviousLocation()
  │    ├─ 找到 → 讀 .db → initSchema → 完成
  │    └─ 找不到 → 降級 IndexedDB
  │
  └─ 沒設 / 'indexeddb'（99% 使用者）
       ↓
     IndexedDBAdapter.readDatabase()
       ├─ 有舊 DB → 載入 + 自動偵測 schema 版本
       │    ├─ schema 完整 → 用舊 DB
       │    └─ schema 缺欄位（例如 holidays.category_id）→ 自動重建 + 清掉 IDB
       └─ 沒資料 → 建全新 DB + initSchema + 預設資料（住戶狀態 / 停車狀態 / 費用類別）
```

**自動偵測舊版 schema 規則**（重要）：

- `PRAGMA table_info(holidays)` 看有沒有 `category_id`
- 沒有 → 視為舊版 → 清掉 + 重建
- 重建後立刻 `scheduleSave(true)` 把新 schema 寫回 IDB

### 1.3 首次啟動精靈（Onboarding）

5 步驟（`client/src/modules/onboarding/OnboardingModule.tsx`）：

| 步驟 | 元件 | 用途 |
|------|------|------|
| 1 | `Step1Welcome` | 歡迎畫面，預估 3 分鐘 |
| 2 | `Step2Language` | 選語言（zh-TW / zh-CN / en）→ 寫 `localStorage['v4-lang']` |
| 3 | `Step3Storage` | 選「瀏覽器內建 (IndexedDB)」vs「本地資料夾 (FSA)」+ 偵測雲端硬碟 |
| 4 | `Step4Backup` | 設定每日自動備份（呼叫 PowerShell server `/api/test-backup-dir` 測資料夾可寫） |
| 5 | `Step5Finish` | 套用所有設定 + `markOnboardingCompleted()` |

**Storage 步驟的判定邏輯**（`Step3Storage`）：
- 預設 IndexedDB（推薦）
- 顯示進階選項才看得到「本地資料夾」按鈕
- 選「本地資料夾」會立刻 `db.switchToFileSystem()` → 觸發瀏覽器原生資料夾 picker

**備份步驟呼叫的 server 端點**（PowerShell HttpListener）：
- `POST /api/environment` — 偵測雲端硬碟（OneDrive / Google Drive / Dropbox）
- `POST /api/pick-folder` — 開原生 FolderBrowserDialog
- `POST /api/test-backup-dir` — 測試資料夾可寫入
- `POST /api/schedule-backup` — 註冊排程（只記到 `.v4-backup-config.json`，PowerShell server 沒真的跑 cron）

**為什麼分兩層 server？**

- PowerShell HttpListener（client/dist/start-server.ps1）→ 給 V4 dist 用，只有 4 個端點（environment / pick-folder / test-backup-dir / schedule-backup）
- Fastify server（pnpm dev）→ 給開發用，所有 `/api/*` 業務路由都在這

兩個 server 不會同時跑（前端只會跟一個通）。dist 用 PowerShell server 是因為沒有 Node.js 環境。

---

## 2. 日常使用（業務模組）

V4 有 13 個業務模組（`client/src/modules/`）。每個模組對應一個「資料主體」+ UI 元件。

| 模組 | 入口檔 | 用途 |
|------|--------|------|
| 🏠 **首頁分頁** | `home-tabs/index.tsx` | 自訂首頁顯示的分頁（記事 / 待辦 / 公告） |
| 📅 **日曆** | `calendar/index.tsx` | 月曆視圖 + 筆記 / 待辦 / 日記 |
| 👥 **住戶管理** | `residents/index.tsx` | 4 個 tab：住戶列表 / 停車位 / 狀態 / 裝潢紀錄 |
| 💰 **記帳** | `expenses/index.tsx` | 帳戶 / 零用金 / 預算 / 圖表 / 快速輸入 |
| 📋 **班表** | `schedule/index.tsx` | 月曆 + 員工 / 班別 / 培訓 |
| 🏢 **公設紀錄** | `facility-booking/index.tsx` | 公設借用 / 收費 / 設施管理 |
| ⚙️ **設定** | `settings/index.tsx` | 棟別 / 樓層 / 假期 / 儲存 |
| 💾 **備份** | `backup/index.tsx` | 手動備份 / 還原 / 自動排程 / 歷史 |
| 🧰 **工具** | `tools/index.tsx` | 標籤列印 / PDF 工具 |
| 📚 **教學** | `tutorials/index.tsx` | 教學影片清單（首次啟動自動 seed） |
| 🤖 **AI 助理** | `ai/index.tsx` | AI 對話助手 |
| 👋 **Onboarding** | `onboarding/index.tsx` | 首次啟動精靈 |
| 📊 **監控** | `monitoring/index.tsx` | 效能 / 錯誤監控面板 |

### 2.1 典型操作流程（舉例：新增住戶）

```
使用者打開「住戶管理」分頁
  ↓
ResidentsListTab 渲染 → useResidents() hook 自動 fetch GET /api/residents
  ↓
點「新增住戶」按鈕 → 開 ResidentModal
  ↓
填表單（棟別/樓層/戶號/姓名/電話/...）
  ↓
點「儲存」→ ResidentModal 呼叫 residentStore.createResident(data)
  ↓
residentStore → residentsApi.create(data) → POST /api/residents
  ↓
Server：residents route handler → repository.create() → INSERT INTO residents ...
  ↓
回傳新住戶 DTO → store 更新 state → Modal 關閉 → 列表自動 refresh
```

**所有模組的 CRUD 都走同一條路徑**：

```
UI 元件
  → Zustand store（管理本地 cache + loading/error state）
    → React hook（useXxx，給純函式元件用）
      → apiClient.{get,post,put,delete}（統一 fetch wrapper）
        → /api/* 路由
          → Server repository
            → SQLite（better-sqlite3）
```

---

## 3. 儲存位置管理

### 3.1 兩種後端

| 後端 | 儲存位置 | 適用情境 |
|------|----------|----------|
| **IndexedDB** | Edge 的 `IndexedDB\chrome-extension_*\...` 內部 | 零設定、隨開即用、本機不動 |
| **本地資料夾** | 你選的資料夾（含雲端硬碟鏡像資料夾） | 想換電腦、想雲端自動備份 |

**V4.1 預設**：IndexedDB 仍然是預設，但設定頁（`Settings → Storage`）鼓勵使用者切到「本地資料夾」以避免清瀏覽器資料 = 資料消失。

### 3.2 換資料夾

入口：`client/src/modules/settings/StorageSettings.tsx` → 「變更資料夾位置」按鈕

```
按「變更資料夾」
  ↓
switchToFileSystemStorage()
  ↓
FileSystemAccessAdapter.pickFolder()
  ↓
瀏覽器原生「選擇資料夾」對話框
  ↓
選好資料夾 → 寫入新的 .db 檔
  ↓
localStorage['v4-storage-backend'] = 'file-system'
  ↓
切換完成（不複製舊資料 — 舊資料留在舊資料夾）
```

**重要**：切換資料夾 = 換 DB 實體，**不會自動合併**。如果你從 A 資料夾換到 B 資料夾，B 是空的就會建全新的 DB。

### 3.3 重置整個資料庫（危險區）

入口：`StorageSettings` 最底下的「重置整個資料庫」紅色按鈕（要按兩次確認）

```
按「重置整個資料庫」
  ↓
confirm() 兩次
  ↓
indexedDB.deleteDatabase('v4-resident-system')
  ↓
「重新整理頁面後會提示重新選擇資料夾」
```

**警告**：這個動作**不可逆**。備份模組的匯出檔不會被刪。

---

## 4. 資料遷移（整個資料夾複製就帶走）

### 4.1 同電腦搬位置

```
1. 打開「備份」模組 → 匯出 .db（或 .json.gz）→ 存到新位置
2. 從「設定 → 儲存」改指到新資料夾
3. 從「備份」匯入剛剛的備份檔
4. 完成
```

### 4.2 整個資料夾複製就帶走（V4 設計哲學）

V4 的核心承諾：**你的資料就是一個 SQLite 檔**。任何能複製檔案的方式都能搬資料。

| 搬法 | 怎麼做 |
|------|--------|
| USB 隨身碟 | 把 `backups/` 整個資料夾複製到隨身碟 |
| 雲端硬碟（OneDrive / Google Drive） | 把整個 `client/dist/` 移到雲端硬碟內的資料夾 |
| 雲端硬碟 + 自動同步 | 用 `setup-cloud.bat` 一鍵安裝到雲端硬碟鏡像資料夾 |
| Git（只適合 schema） | 不用 — .db 不進 Git |

### 4.3 雲端同步（OneDrive / Google Drive / Dropbox）

**安裝**：

```
1. 雙擊 client/dist/setup-cloud.bat
2. 選雲端硬碟（自動偵測）
3. 確認安裝位置（雲端硬碟\V4 住戶管理\）
4. 完成 → 雲端硬碟會自動同步整個資料夾
```

**換電腦**：

```
1. 在新電腦登入雲端硬碟（OneDrive / Google Drive / Dropbox）
2. 雲端硬碟會自動下載 V4 資料夾
3. 雙擊雲端硬碟裡的「啟動 V4 住戶管理.bat」
4. 首次進入「備份」模組匯入最新備份即可
```

**注意**：
- 雲端同步 .db 檔**有衝突風險**（兩台電腦同時寫會 conflict）
- 建議：只用一台電腦當主要寫入端，其他電腦只讀
- 或：用「每日自動備份」當同步機制（每天早上 02:00 自動匯出一份到雲端硬碟）

---

## 5. 跨瀏覽器行為

### 5.1 IndexedDB 模式

```
IndexedDB 是 per-origin + per-browser 隔離的
  ↓
同一台電腦的 Edge 和 Chrome 看到的資料不同
  ↓
Edge 的資料 Chrome 看不到
```

### 5.2 本地資料夾模式

```
本地資料夾是 OS 層級的檔案系統
  ↓
Edge 寫 → 檔案更新 → Chrome 讀 → 看到新資料
  ↓
但 Chrome 也要做一次「picker」確認位置
  ↓
每個瀏覽器第一次都要 picker 一次
```

### 5.3 同瀏覽器多 profile

Edge / Chrome 的每個 profile 也是 IndexedDB 隔離的。同 profile 看到的資料一致。

---

## 6. 每日自動備份（待做）

> 狀態：UI 已做，但**真正的排程執行器還沒實作**。

### 6.1 目前實作

- Onboarding Step 4 + 備份模組 UI：可設定（啟用 / 備份位置 / 保留份數 / 備份時間）
- 設定存到 PowerShell server 的 `.v4-backup-config.json`
- **實際備份動作**：要 V4 視窗開著才能跑（前端 `setInterval` 每分鐘檢查，超過 N 天就觸發）

### 6.2 限制

- V4 沒開 = 不備份
- 排程存在 PowerShell server 的記憶體，重啟 server 就掉
- OS 排程（Task Scheduler / cron）**還沒串接**

### 6.3 真正可靠的備份策略（目前推薦）

**雲端硬碟鏡像 + 資料夾模式**：
```
1. 安裝到 OneDrive / Google Drive（setup-cloud.bat）
2. 設定儲存位置指到雲端硬碟內的資料夾
3. 雲端硬碟自動每天同步整個資料夾
4. 不用 V4 自己排程
```

**或手動備份 + 雲端硬碟**：
```
1. 設定儲存位置指本機資料夾（例：D:\V4-Data）
2. 每週手動按「備份」匯出 .db 到雲端硬碟
3. 雲端硬碟自動同步
```

### 6.4 未來要做（v1.3+）

- Windows Task Scheduler 排程器（PowerShell 啟動時檢查 + 註冊）
- 自動備份歷史 UI（已做）+ 雲端同步檢查
- 備份檔加密

---

## 7. 部署流程

### 7.1 開發模式（pnpm dev）

```powershell
# 一次性
pnpm install
pnpm --filter @v4-resident/shared run build

# 啟動（會等 server ready 才開瀏覽器）
.\start.ps1
# 或分開：
pnpm --filter @v4-resident/server run dev   # Fastify :3001
pnpm --filter @v4-resident/client run dev   # Vite :5173（proxy /api → :3001）

# 跑測試
pnpm --filter @v4-resident/client test
pnpm --filter @v4-resident/server test

# Type check
pnpm --filter @v4-resident/client exec tsc --noEmit
pnpm --filter @v4-resident/server exec tsc --noEmit

# Lint
pnpm --filter @v4-resident/client exec eslint src
```

**port 衝突處理**：先 `Get-NetTCPConnection -LocalPort 9527 -State Listen` 看有沒有殭屍 process。

### 7.2 Production Build（單機 PC Windows）

```powershell
# 一次性
pnpm install

# Build 前端 + 後端
pnpm --filter @v4-resident/client build      # 產出 client/dist/
pnpm --filter @v4-resident/server build      # 產出 server/dist/

# 用戶體驗：把整個 client/dist/ 資料夾複製到目標電腦
# 雙擊「啟動 V4 住戶管理.bat」即可
```

**dist 內容**：
```
client/dist/
├── 啟動 V4 住戶管理.bat           # 一鍵啟動
├── launcher.ps1                    # 啟動器 PowerShell
├── start-server.ps1                # HttpListener server（port 9527）
├── setup-cloud.bat                 # 雲端硬碟安裝腳本
├── 使用說明.txt                    # 使用者手冊
├── 使用說明.txt                    # 使用說明
├── index.html + assets/ + fonts/   # 完整 SPA
├── schedule.html                   # 班表 iframe
├── label-print.html                # 標籤列印
├── pdf-tools.html                  # PDF 工具
└── icon.svg                        # App 圖示
```

### 7.3 Preview Build（測試 dist）

```powershell
# build 完後測試 dist
cd client/dist
.\啟動 V4 住戶管理.bat
# 或直接：
powershell -ExecutionPolicy Bypass -File .\start-server.ps1 -Port 9527 -Root "C:\path\to\dist"
```

### 7.4 PowerShell HttpLauncher（dist 用的 launcher）

`launcher.ps1` 做的事：
1. 砍掉舊的 `V4 HTTP Server` 視窗（by MainWindowTitle）
2. 砍掉 stale Edge V4 視窗
3. 啟動 `start-server.ps1`（hidden window）
4. 等 port 9527 listen（最多 15 秒）
5. 啟動 Edge App mode（`--app=http://localhost:9527/`，1400×900）
6. Poll Edge process，Edge 關閉就自動關 server

### 7.5 雲端硬碟鏡像（雲端版）

```
1. 雙擊 setup-cloud.bat
2. 自動偵測所有雲端硬碟（OneDrive / Google Drive / Dropbox）
3. 選一個 → 確認安裝位置
4. 自動建立雲端硬碟\V4 住戶管理\ + 複製 dist + 建桌面捷徑
5. 之後雲端硬碟自動同步整個資料夾
```

**為什麼雲端版有意義**：
- 換電腦自動下載（不用手動複製）
- 多台電腦（家裡 + 公司）共用同一份 .db
- 自動版本控管（雲端硬碟有歷史）

**為什麼雲端版有風險**：
- 兩台電腦同時開 V4 寫 → SQLite conflict（SQLite 不是設計給 multi-writer 的）
- 雲端硬碟 sync delay → 看到的是「昨天的版本」
- **目前建議**：單一寫入端 + 其他電腦只讀

### 7.6 升級流程

從 V4 v1.x 升到 v1.y：

```
1. 匯出備份（.db 或 .json.gz）→ 存到 V4 資料夾外
2. 關閉 V4
3. 覆蓋 client/dist/ 整個資料夾（新 build）
4. 雙擊啟動 BAT
5. V4 自動偵測舊 schema → 自動重建（如需要）
6. 從「備份」匯入剛剛備份的檔
7. 完成
```

**為什麼要「重建」而非 in-place upgrade**：
- SQLite schema 改欄位 = `ALTER TABLE`，但實務上常遇到 NOT NULL / DEFAULT / FK 衝突
- 「重建」 = 從乾淨 DB 開始 + 灌預設資料 + 讓使用者從備份還原
- 比寫一堆 migration 程式穩

---

## 8. 故障排除

| 症狀 | 可能原因 | 解法 |
|------|----------|------|
| V4 打不開 | port 9527 被佔 | `Get-NetTCPConnection -LocalPort 9527` → Stop-Process |
| 「資料庫尚未初始化」一直轉圈 | IndexedDB 卡住 | 設定 → 儲存 → 重置資料庫 |
| 「儲存失敗」錯誤 | 權限 / 雲端硬碟斷線 | 檢查選擇的資料夾還在不在 |
| Edge 開啟但看不到 UI | Service Worker 舊版 | Ctrl+Shift+R 強制重整 |
| 資料不見 | 換瀏覽器 / 清 Edge 資料 | 從「備份」匯入最近備份 |
| Schema 缺欄位錯誤 | 從舊版升級 | V4 自動偵測並重建 |

---

## 9. 相關檔案總覽

| 用途 | 路徑 |
|------|------|
| DB 初始化 | `client/src/storage/database.ts` |
| 儲存介面 | `client/src/storage/adapter.ts` |
| 首次啟動精靈 | `client/src/modules/onboarding/` |
| 業務模組 | `client/src/modules/*` |
| 統一 API 契約 | `client/src/api/*.ts` |
| React hooks | `client/src/hooks/*.ts` |
| Zustand stores | `client/src/stores/*.ts` |
| Server routes | `server/src/routes/*.ts` |
| Server entry | `server/src/index.ts` |
| PowerShell launcher | `client/dist/launcher.ps1` |
| PowerShell server | `client/dist/start-server.ps1` |
| 雲端安裝腳本 | `client/dist/setup-cloud.bat` |
| 使用說明 | `client/dist/使用說明.txt` |

---

## 10. 版本資訊

- V4 v1.0：V1 完整功能移植
- V4 v1.1：Server smoke test + 雲端同步 API + License 系統
- V4 v1.2：排除雲端 + PWA，純 PC Windows 桌面版
- V4 v1.3：Server backend + V4 業務擴充（floors / facilities / status / parking）
- V4 v1.4：純 API 架構（前端不再用 sql.js / IndexedDB 直接 query）
- V4 v1.5：模組重組 + 子資源補齊（parking-binding / decoration-records 等）

最後更新：2026-06-25