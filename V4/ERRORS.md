# ERRORS.md — V4 歷史報錯與處理記錄

最後更新：2026-06-25

**用途**：下次遇到類似的錯誤時，先查這裡。預防規則是新的硬門。

## 錯誤記錄格式

每條錯誤記錄包含：
- **症狀**：觀察到的現象
- **復現**：如何重現
- **根因**：真正的技術原因
- **處理**：如何修
- **預防規則**：未來必須遵守的規則

---

## ERR-001: better-sqlite3 11.10 沒有 Node 24 預編譯 binary

**症狀**：`npm install` 時 `better-sqlite3` 編譯失敗，error code 1，node-gyp 報錯。
**復現**：
```bash
# 在 Node 24.14 + Windows 環境
npm install better-sqlite3@11.10.0
# → gyp ERR! find Python
# → node-gyp rebuild fail
```
**根因**：`better-sqlite3@11.10.0` 沒有 Node 24 (node-v138) 的預編譯 binary。Better-sqlite3 11.x 系列只支援到 Node 22 (node-v137)。
**處理**：升級到 `better-sqlite3@12.11.1`（最新版，含 Node 24 預編譯 binary）。
**預防規則**：
- ✅ Node 24 必須用 `better-sqlite3@^12.0.0`
- ❌ 不要鎖定 `better-sqlite3@^11.0.0` 在 Node 24 環境

---

## ERR-002: sql.js 寫的 .db better-sqlite3 讀會 SQLITE_CORRUPT

**症狀**：
- `better-sqlite3` 開啟 V4 用戶雲端硬碟 .db 時拋 `SqliteError: database disk image is malformed`
- `PRAGMA journal_mode = WAL` 失敗
- 但 `sql.js`（舊 client 用）能正常讀寫

**根因**：`sql.js` 寫出的 SQLite 格式跟 `better-sqlite3`（native binding）有微妙差異。better-sqlite3 用原生 SQLite 編譯，比 sql.js（Emscripten WASM）嚴格，讀到 sql.js 的 .db 會認為 corruption。

**處理**：
1. 用 `sql.js` 讀損壞的 .db（sql.js 能讀，better-sqlite3 不能）
2. 用 `better-sqlite3` 重建乾淨的 .db
3. 從 sql.js 匯出所有 tables + 資料，逐表 INSERT 到 better-sqlite3
4. 取代原 .db 檔

救援腳本見 `workspace/repair-db.mjs`（執行後：138 rows preserved, 80 residents 還在）。

**預防規則**：
- ❌ **不要混用 sql.js 寫 + better-sqlite3 讀**（V4 已全面抽換成後端 better-sqlite3）
- ✅ V4 現狀：後端用 better-sqlite3，前端用 fetch API（不再 sql.js 寫 .db）
- ✅ 若發現 SQLITE_CORRUPT，**不要嘗試 better-sqlite3 修**，先 sql.js 讀 → better-sqlite3 重建

---

## ERR-003: Worker 並行寫 .db 造成 corruption

**症狀**：多個 worker 並行測試 API（每個 worker 都 POST/DELETE 寫 .db），結果 .db 損壞，server 啟動時 SQLITE_CORRUPT。
**根因**：better-sqlite3 不支援跨 process 並行寫入。每個 worker spawn 一個新 process 連同一個 .db 檔，WAL mode 無法協調跨 process 寫入順序。
**處理**：見 ERR-002 救援流程。
**預防規則**：
- ❌ **不要派多 worker 並行測試同一個 .db**
- ✅ 測試 worker 用隔離的 .db（每個 worker 用 temp 檔）
- ✅ 或所有 worker 串行測試（先做一個再做下一個）

---

## ERR-004: PowerShell 5.1 中文字符串環境變數傳給 child process 變亂碼

**症狀**：
```powershell
$env:DATA_DIR = 'G:\我的雲端硬碟\V4住戶管理'
cmd.exe /c 'echo %DATA_DIR%'
# → 顯示：G:\???\?��??\V4住戶管�?
```
**復現**：PowerShell 5.1 預設 codepage 是 CP950 (Big5)，`set` 環境變數給 cmd.exe 時中文字節丟失。
**根因**：PowerShell 5.1 對 Unicode 處理差。`set` 指令用 Big5 編碼中文路徑，cmd.exe 收到亂碼。
**處理**：
1. **不要從 PowerShell set 環境變數給 cmd**
2. 用 Node.js wrapper（`server/start-with-cloud.mjs`）：
   ```js
   process.env.DATA_DIR = 'G:\\我的雲端硬碟\\V4住戶管理';
   await import('./src/index.ts');
   ```
3. 或寫 .bat 檔（避免 PowerShell 介入）

**預防規則**：
- ❌ **不要在 PowerShell `set` 環境變數給 cmd/Node 子進程**
- ✅ 中文路徑一律用 Node.js 的 `process.env.X = '...'` 設定
- ✅ 或用 .bat 啟動器（檔案本體避免 PowerShell 編碼介入）

---

## ERR-005: vite preview HTTP cache 阻擋新 build（Edge App mode 卡舊版）

**症狀**：用戶改 code 後重 build，但 Edge App mode 視窗 reload 仍看到舊的 JS（hash 改了但 Edge 沒抓到新檔）。
**根因**：vite preview 預設送 `ETag`，Edge 送 `If-None-Match` → vite preview 回 `304 Not Modified` → Edge 用 cache。
**處理**：在 `vite.config.ts` 的 `preview.headers` 加：
```ts
'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
'Pragma': 'no-cache',
'Expires': '0',
```
**預防規則**：
- ✅ V4 的 `vite preview` 一律加 no-cache header
- ✅ 重 build 後**不用清瀏覽器 cache**（自動失效）

---

## ERR-006: schedule.ts 用 `ss.label` 但 schema 是 `shifts.name`

**症狀**：`GET /api/schedule` 拋 `SqliteError: no such column: ss.label`（500 Internal Server Error）。
**復現**：直接打 `curl http://localhost:3001/api/schedule`。
**根因**：`server/src/routes/schedule.ts` 的 SQL 用 `LEFT JOIN shifts ss` 但 SELECT 用 `ss.label` 當別名 — `shifts` 表實際欄位是 `name` 不是 `label`（見 `server/src/db/schema.ts` line 298-304）。
**處理**：把 `ss.label as shift_label` 改成 `ss.name as shift_label`。共 3 處（list / getById / 其他 routes）。
**預防規則**：
- ✅ **SQL JOIN 別名要對齊 schema 欄位名**
- ✅ 加 server 啟動時 `PRAGMA integrity_check` + 抽 1 個 endpoint 打 smoke test 早期發現

---

## ERR-007: PowerShell 啟動 Process 卡死（抓不到 child 結束）

**症狀**：`Start-Process -Wait` 永遠不返回，PowerShell hang。
**根因**：PowerShell 5.1 對某些 child process 的 stdin/stdout/stderr handle 處理有 bug，特別是 GUI 程式或長時間跑的程序。
**處理**：
- 用 `Start-Process -WindowStyle Hidden -RedirectStandardOutput "log"` 把輸出 redirect 到檔
- 用 `Get-Process` 檢查 process 狀態
- 不要 `-Wait`，改用輪詢
**預防規則**：
- ✅ 後台跑 server 一律用 `Start-Process -WindowStyle Hidden`
- ✅ 用 `Get-NetTCPConnection -LocalPort 3001` 確認 server 跑起來
- ❌ 不要在 PowerShell 內 -Wait

---

## ERR-008: Playwright MCP 安全錯誤（無 origin localStorage）

**症狀**：`mavis mcp call playwright browser_evaluate '{"function": ...}'` 拋 `SecurityError: Failed to read the 'localStorage' property from 'Window': Access is denied for this document.`。
**根因**：playwright 在 `about:blank` 頁面執行 evaluate，沒 origin 沒 localStorage。
**處理**：先 `browser_navigate` 到真實 origin URL 再 evaluate。
**預防規則**：
- ✅ playwright evaluate 一定要先 navigate 到 origin
- ❌ 不要在 about:blank 跑 evaluate

---

## ERR-009: pnpm install 卡 30 分鐘（husky + PowerShell 衝突）

**症狀**：`pnpm install` 跑超過 30 分鐘還沒完成。
**根因**：`husky install` 在子目錄（如 `uuid` package）跑 PowerShell 時路徑解析失敗，PowerShell 5.1 + 中文路徑問題。
**處理**：`npm install --ignore-scripts`（跳過 husky 安裝）。
**預防規則**：
- ✅ `pnpm/npm install --ignore-scripts` 預設使用（husky 在 V4 不必要）
- ❌ 不要用 `pnpm dev`（可能觸發 husky）

---

## ERR-010: curl + PowerShell 解析 HTTP error code 失敗

**症狀**：`curl.exe -w "%{http_code}"` 配合 PS5.1 `2>&1` 解析時，輸出格式混亂。
**復現**：
```powershell
curl.exe -s -w "`n%{http_code}" -X POST http://localhost:3001/api/buildings ...
# 4xx/5xx 時 curl exit code 非 0
# PowerShell 2>&1 把它當 stderr
# -w 的 %{http_code} 跟 body 混在一起
```
**處理**：用 Node.js `fetch` 取代 curl（完整控制 HTTP response）。
**預防規則**：
- ✅ **PowerShell 環境用 Node.js 寫 HTTP 測試**（`fetch` 是標準）
- ❌ 不要在 PS5.1 寫 curl-based HTTP 測試

---

## ERR-011: PowerShell Invoke-WebRequest 把 HTTP 4xx 當 exception

**症狀**：`Invoke-WebRequest` 在 4xx/5xx 時拋 `例外狀況: (404)` 中斷 script。
**根因**：PowerShell 5.1 預設 `ErrorAction=Continue` 但 4xx/5xx 拋 HttpRequestException。
**處理**：
- 用 `-ErrorAction SilentlyContinue` + 自己檢查 `$_.Exception.Response.StatusCode`
- 或用 Node.js `fetch`
**預防規則**：見 ERR-010 — Node.js 取代

---

## ERR-012: changeFolder() 缺 picker，前端按了沒反應

**症狀**：用戶在 DatabaseStatus 下拉選單按「更換資料夾」按鈕，picker 沒彈出。
**根因**：`database.ts` 的 `changeFolder()` 只做 `forgetLocation() + 切到 IndexedDB`，**完全沒呼叫 pickFolder()**。所以按了 picker 不會彈。
**處理**：重寫 `changeFolder()`：export 當前 DB bytes → forgetLocation → 開新 picker → 切到新 file-system → 讀新資料夾的 .db（或寫入舊資料）。
**預防規則**：
- ✅ 任何「切換/變更」storage 位置的函式必須包含 picker 互動
- ❌ 不要寫「只清空不彈 picker」的 changeFolder

---

## ERR-013: App.tsx 啟動時 queryOnboardingStatus() 在 db 沒 ready 時拋錯

**症狀**：每次進網站都跑完整 Onboarding 流程，即使之前已走過。
**根因**：`App.tsx:47` 在 `useState` 初始值就呼叫 `getOnboardingStatus()` — 此時 `db` 還沒初始化（useEffect 還沒跑），`queryAll()` 拋錯 → fallback localStorage → 永遠是「首次啟動」。
**處理**：
- `useState` 保守預設 `isFirstRun: true`
- `db.initDefault()` 完成後才呼叫 `getOnboardingStatus()` 設為正確狀態
**預防規則**：
- ✅ **任何同步呼叫 db 函式要確認 db 已 ready**
- ✅ `useState` 預設保守值，effect 完成後 setState 正確值

---

## ERR-014: W3C FSA handle 必須存 IndexedDB（無法完全禁用瀏覽器儲存）

**症狀**：純 web 架構下，「資料完全離開瀏覽器」無法達成，因為 FSA handle 必須序列化在 IDB。
**根因**：W3C FileSystemDirectoryHandle spec 規定只能用 `structuredClone` 序列化，實務上 Chrome/Edge 只支援 IndexedDB 序列化。
**處理**：V4 已轉向「完整 Go-style 三層」架構（純前端 React + Fastify 後端）— 用戶資料完全在 server-side SQLite，瀏覽器只存最少必要（FSA handle）。
**預防規則**：
- ❌ 純 web 架構下無法「完全禁用 IndexedDB / localStorage」
- ✅ 真要完全離開瀏覽器 → 用 Tauri / Electron 桌面應用
- ✅ V4 現狀：純接口前端 + Fastify 後端，99% 資料在 server-side SQLite

---

## ERR-015: Onboarding 狀態每次 reload 都跑（localStorage 死循環）

**症狀**：用戶走完 Onboarding 後，reload 還是出現 Onboarding 畫面。
**根因**：
1. `OnboardingModule.tsx:58` 寫 `localStorage.setItem('v4-storage-backend', data.storage)`，覆寫了用戶原本設的 `file-system` 為預設的 `indexeddb`
2. 下次 reload → App.tsx 看到 `indexeddb` 但條件 `backend !== 'file-system'` 為 true → 又觸發 StorageLocationPrompt
**處理**：
- `v4-storage-backend` 改存 .db 的 `app_settings.current_backend`（source of truth）
- localStorage 只做 cache
- `App.tsx` 條件改 `if (backend !== 'file-system' && backend !== 'indexeddb')` 才顯示 StorageLocationPrompt
**預防規則**：
- ✅ **任何「使用者已設定」狀態，接受所有合法值，不要只認單一值**
- ✅ Source of truth 統一放 .db，localStorage 只 cache

---

## ERR-016: schedule-holidays 用 `isWorkDay: false` 拋錯（SQLite binding 限制）

**症狀**：POST `/api/schedule-holidays` body `{ ..., isWorkDay: false }` 拋 `SQLite3 can only bind numbers, strings, bigints, buffers, and null`。
**根因**：better-sqlite3 不支援 boolean binding（需轉 0/1）。
**處理**：前端 payload 用 0/1 代替 boolean；或後端 route 加 boolean 轉換層。
**預防規則**：
- ✅ better-sqlite3 binding 一律用 number / string / bigint / Buffer / null
- ❌ 不要傳 boolean / object / array 直接 binding
- ✅ 前端 API client 統一轉 boolean → 0/1

---

## ERR-017: Phase 9 移除本地 SQLite 後 13 個模組仍呼叫 queryAll/execute（tech debt）

**症狀**：
- Phase 9 移除 sql.js WASM / IndexedDB / FSA 後，`@/storage/database` 改為 throw-stub
- 但仍有 13 個模組在 build 時 import `queryAll` / `execute` / `transaction` / `getDb`
- 執行時呼叫會拋錯：「`[storage] queryAll() 已棄用 — V4 已改用 @/lib/apiClient 走 server-side SQLite`」
- build 仍可通過（API 相容 stub），但功能在執行時 crash

**根因**：V4 Phase 2~9 期間，模組陸續從 sql.js 遷移到 fetch API，但遷移速度不一致。17/30 API 已完成遷移，剩餘 13 個模組尚未遷移。

**處理**：
- 短期：`@/storage/database` 保留所有 export 簽名，執行時拋出明確錯誤訊息指向 ERR-017
- 中期：逐一遷移每個模組到 `apiClient`：
  - 將 `queryAll<T>(sql, params)` 改為 `apiClient.get<T[]>(endpoint, { params })`
  - 將 `execute(sql, params)` 改為 `apiClient.post/put/delete(endpoint, body)`
  - 將 `transaction(fn)` 改為單一 server-side 路由呼叫（rollback 邏輯由 server 處理）
- 遷移完成後刪除 `@/storage/database` stub

**未遷移模組清單（13 個）**：
1. `client/src/api/decoration-records.ts` — queryAll/execute
2. `client/src/api/parking-binding.ts` — execute
3. `client/src/api/resident-parking.ts` — queryAll/execute
4. `client/src/api/resident-emergency-contacts.ts` — queryAll/execute
5. `client/src/modules/backup/index.tsx` — getLocationDescription（已改用 literal）
6. `client/src/modules/monitoring/index.tsx` — getDb（已 no-op stub）
7. `client/src/modules/tutorials/index.tsx` — queryAll/execute（已改為 placeholder）
8. `client/src/modules-system/index.ts` — execute/isReady（已 stub）
9. `client/src/modules-system/modules/double-entry.ts` — execute/queryAll/queryOne
10. `client/src/modules-system/modules/reporting.ts` — dynamic queryAll
11. `client/src/modules-system/modules/invoice.ts` — dynamic queryAll
12. `client/src/modules-system/pages/JournalEntries.tsx` — queryAll/execute/transaction
13. `client/src/security/field-encryption.ts` — queryAll/execute
14. `client/src/notifications/system.ts` — queryAll
15. `client/src/ai/sql-executor.ts` — queryAll（AI 模組）
16. `client/src/monitoring/stress-test.ts` — getDb（已 stub）
17. `client/src/storage/backupManager.ts` — queryAll/execute/exportDatabase/importDatabase
18. `client/src/storage/appLog.ts` — queryAll/execute

**預防規則**：
- ✅ 新模組**一律**用 `@/lib/apiClient`，禁止 import `@/storage/database`
- ✅ 看到 queryAll/execute → 必須遷移到 apiClient 才能 merge
- ✅ 優先順序：核心業務 API（residents / expenses / schedule）→ 監控 / 日誌 → AI / 報表
- ❌ 不要新增對 `@/storage/database` 的 import

---

## 預防規則總覽

| 編號 | 規則 | 影響 |
|---|---|---|
| ERR-001 | Node 24 + better-sqlite3@12+ | 環境 |
| ERR-002 | 不混 sql.js 寫 + better-sqlite3 讀 | 架構 |
| ERR-003 | 不並行 worker 寫 .db | 測試 |
| ERR-004 | PowerShell 不傳中文環境變數 | 部署 |
| ERR-005 | vite preview 加 no-cache header | dev |
| ERR-006 | SQL JOIN 別名對齊 schema | 後端 |
| ERR-007 | PowerShell 不要 -Wait | dev |
| ERR-008 | playwright evaluate 先 navigate | 測試 |
| ERR-009 | 安裝跳過 husky | env |
| ERR-010 | PS 用 Node 寫 HTTP 測試 | 測試 |
| ERR-011 | 同 ERR-010 | 測試 |
| ERR-012 | 切換 storage 要含 picker | UX |
| ERR-013 | 同步呼叫 db 要確認 ready | 前端 |
| ERR-014 | 真要零瀏覽器儲存用 Tauri | 架構 |
| ERR-015 | 設定狀態放 .db，localStorage 只 cache | 架構 |
| ERR-016 | better-sqlite3 不接受 boolean binding | 後端 |
| ERR-017 | 新模組一律用 apiClient，禁用 @/storage/database | 架構 |