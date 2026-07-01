# V4 大樓住戶管理系統 — 產品需求文件（PRD）

> 版本：v1.0 — 2026-06-25 起草
> 對象：自主開發者（單人全端）
> 對應程式庫：`C:\Users\sunpe\dev\v4-resident-system\`

---

## 1. 一句話定位

**V4 是專為台灣小型公寓 / 社區管理員設計的「PC Windows 桌面版」住戶與帳務管理系統，純前端 + 本地 Fastify 後端 + SQLite，零雲端依賴、零月費、可離線運作數年。**

---

## 2. 目標用戶與場景

### 2.1 核心用戶

| 角色 | 描述 | 主要痛點 |
|------|------|----------|
| **管理員本人**（主要） | 自主開發者就是用戶 — 住在一棟約 20-50 戶的小型社區，需要管理住戶 / 收費 / 排班 | Excel 雜亂、雲端 SaaS 月費、手機輸入慢、需要離線可用 |
| **管委會主委**（次要） | 偶爾幫忙看一下報表或新增住戶 | 不熟雲端、桌機為主、不想記密碼 |
| **住戶**（極少） | 未來若開放可能查看自己的繳費紀錄 | — |

### 2.2 三大使用場景

1. **每日管理**：進系統 → 看 DatabaseStatus 確認存檔 → 新增 / 編輯住戶 → 記一筆支出 → 看本月圖表
2. **每週排班**：切到「班表」tab → 月曆拖拉指派員工 → 國定假日自動標紅
3. **月底結算**：記帳 → 分攤 → 匯出 PDF 報表 → 雲端硬碟鏡像資料夾自動備份

---

## 3. 範圍定義（P0 / P1 / 不做）

### 3.1 P0（必做，V4 主線）

| 模組 | 功能 | 對應檔案 |
|------|------|----------|
| **住戶管理** | 樓層表視圖、房號自動生成、車位雙向綁定、CSV 匯入匯出、區權人 / 租客 / 成員多筆 | `client/src/modules/residents/` |
| **記帳** | 帳戶 / 零用金 / 預算 / 圖表分析 / 快速輸入語法 / 分攤 | `client/src/modules/expenses/` |
| **班表** | 月曆、員工 / 班別管理、培訓記錄、國定假日 | `client/src/modules/schedule/` |
| **公告（首頁 tabs）** | 多 tab 圖文管理、釘選、圖片放大預覽 | `client/src/modules/home-tabs/` |
| **公設預約** | 公設清單 + 借用紀錄 + 收費狀態 | `client/src/modules/facility-booking/` |
| **設定** | 建築 / 樓層 / 公設 / 車位 / 狀態 五大子頁、樓層面積自動計算房數、儲存位置切換 | `client/src/modules/settings/` |
| **資料備份** | 三格式（`.db` / `.json` / `.json.gz`）、排程、歷史還原 | `client/src/modules/backup/` |
| **工具** | 標籤列印、PDF / Excel 匯出、AI SQL 助手 | `client/src/modules/tools/` |
| **行事曆** | 國定假日 + 自訂事件 + 顏色標記 | `client/src/modules/calendar/` |

### 3.2 P1（次要，未來規劃）

- V1 → V4 資料遷移工具（讀舊版 localStorage JSON → 寫新 SQLite）
- 報表 PDF / Excel 排版優化（中文楷體字型 subset）
- Email 格式驗證 + 零用金轉帳報表
- 帳號自訂支出比例 / 分攤
- Offline banner + PWA 安裝提示

### 3.3 不做（明確排除）

| 不做 | 原因 |
|------|------|
| ❌ 雲端同步 / 多裝置 | 用戶只有一台桌機；雲端 = 月費 + 資安風險 |
| ❌ 手機 / 平板響應式 | 不需要；唯一輸入裝置是 PC 鍵盤 + 滑鼠 |
| ❌ 多租戶 SaaS | 單人自用，無商業化壓力 |
| ❌ 多用戶登入 / 權限 | 單一用戶，省掉 auth 層 |
| ❌ 即時通訊 / 推播 | 公告功能已足夠；推播需要後端常駐 |
| ❌ 對外付款整合（LINE Pay / 信用卡） | 帳務為內部記錄用 |

---

## 4. 驗收標準（P0）

### 4.1 功能驗收

| 項目 | 標準 |
|------|------|
| 啟動 | PowerShell 一鍵（`start.ps1` 或 `v4.bat`）→ 30 秒內瀏覽器開啟首頁 |
| 離線 | 拔網路線 → 仍可新增住戶、記一筆帳、匯出備份 |
| 備份 | `.db` 檔可在另一台 PC 直接用 sqlite 工具開啟 |
| i18n | 切到 English → Sidebar、所有 modal、按鈕文字同步切換 |
| 效能 | 1000 筆住戶 + 5000 筆記帳 → 列表頁 < 1 秒載入 |
| 圖表 | 記帳圖表（圓餅、長條、折線）正確顯示本月彙總 |
| 車位綁定 | 一個車位可綁多戶（多對多）、一戶可擁多個車位 |
| 區權人 vs 租客 | ResidentModal 兩種身份分開欄位、可同時填寫 |

### 4.2 品質驗收

| 項目 | 標準 |
|------|------|
| TypeScript | `pnpm typecheck` 0 錯誤（strict mode） |
| 單元測試 | `pnpm test` 全綠（vitest） |
| 整合測試 | server `pnpm build` + `node dist/index.js` 啟動成功 |
| OpenAPI | `GET /api/openapi.json` 回傳 200，列所有 endpoints |
| AI 友善 | 每個 .ts / .tsx 檔頭有 JSDoc 說明用途 + 對應資料表 |
| 錯誤處理 | Fastify 全域 error handler 不洩漏 stack trace |

### 4.3 可部署驗收

| 項目 | 標準 |
|------|------|
| Docker | `docker compose up -d` 成功啟動 web + api，volume 命名 `v4-data` |
| PC Windows | `client\dist\index.html` 雙擊直接開啟（method A） |
| HTTP server | `npx vite preview --port 4173` 啟動成功（method B） |
| 雲端硬碟鏡像 | `.db` 放在 OneDrive / Google Drive 鏡像資料夾 → 自動備份 |

---

## 5. 演進歷程（V1 → V4）

### 5.1 V1（Big5 + localStorage，廢棄）

- 純 HTML + Vanilla JS + localStorage
- 5 大模組：住戶、記帳、班表、公告、設定
- **問題**：localStorage 容量 5MB 上限、Excel 匯出亂碼、響應式差、無雲端備份
- 存放：原 V1 倉庫（已不再維護）

### 5.2 V2（IndexedDB + Dexie.js，過渡）

- 加入 Dexie.js，突破容量限制
- 加入 PWA、響應式設計
- **問題**：響應式對桌面用戶是過度設計、雲端同步複雜度爆增

### 5.3 V3（sql.js WASM + 模組化，實驗）

- 純前端 sql.js WASM + IndexedDB 雙層
- 模組化 + Zustand + TanStack Table
- **問題**：UI 元件庫過度膨脹、開發期太長

### 5.4 V4（Go-style 三層 + Fastify + SQLite，本版 ✅）

- 純前端 React + TypeScript + Vite + Tailwind
- 後端 Fastify + better-sqlite3 + Zod
- Go-style 三層架構：route → repository → schema
- **34 表完整 SQLite schema**（`server/src/db/schema.ts` 的 `ALL_TABLES` 為準；`client/src/storage/schema.ts` 額外有 2 表 `app_logs` / `app_settings` 用於前端應用層）
- 32 個 RESTful routes（每個資源一份）
- 25 個 client-side hooks（API + 狀態管理）
- 30 個 client-side API modules
- 42 個 UI 元件 / 模組
- 共享型別 + Zod validation 在 `shared/` workspace

### 5.5 V4 為什麼是終點

| 需求 | V4 滿足方式 |
|------|-------------|
| AI agent 友善 | 純 Web + 標準後端、原始碼全在 repo、無打包黑箱 |
| 可商用 | 單機使用，無月費、無用戶資料外洩 |
| 穩定運行數年 | SQLite（無外部依賴）、TypeScript strict、單元測試 |
| 配置要求低 | 任何 Windows + Chrome / Edge 即可；Docker 可選 |
| 耗能低 | 純網頁 + 本地後端，無背景程序 |
| 隱私 | 資料完全本地，無上傳 |

---

## 6. 目標用戶驗證（Use Case 範例）

### Use Case A：新增一位租客

1. 用戶進首頁 → Sidebar 點「住戶」 → 看到樓層表
2. 點某樓層的「新增」 → Modal 開啟
3. 選「區權人」分頁：填樓層 + 戶號 + 姓名
4. 切到「成員」分頁：填租客姓名、電話、入住日期、押金、月租
5. 切到「車位」分頁：選一個空車位 → 自動寫入 `resident_parking` 表
6. 切到「裝潢」分頁：留空（之後可補圖片）
7. 按「儲存」 → Repository 寫 SQLite → Modal 關閉 → 列表即時刷新

### Use Case B：月底結算

1. Sidebar 點「記帳」 → 切到「圖表」
2. 看到本月收入 / 支出圓餅圖 + 長條圖
3. 點「分攤」tab → 選月份 + 分攤項目 → 自動計算每戶應分攤金額
4. 點「匯出 PDF」 → 自動 subset 中文字型 → 輸出到雲端硬碟鏡像資料夾
5. 雲端硬碟自動 sync → 用戶換電腦也能看到最新 PDF

### Use Case C：員工排班

1. Sidebar 點「班表」 → 切到月曆視圖
2. 看到當月班表（員工 + 班別 + 國定假日自動標紅）
3. 拖拉員工到某天某班別 → 寫入 `schedule_entries`
4. 切到「員工」tab → 新增員工（含電話、Line ID）
5. 切到「培訓」tab → 為該員工新增訓練紀錄

---

## 7. 風險與緩解

| 風險 | 機率 | 影響 | 緩解 |
|------|------|------|------|
| SQLite 檔損毀 | 極低 | 高（全資料丟失） | 每日自動備份到雲端硬碟鏡像 + 排程 7 天保留 |
| better-sqlite3 native binding 在新 Node 版壞掉 | 中 | 中 | pin Node 版本到 20 LTS、用 `npm rebuild` 修復 |
| IndexedDB 瀏覽器清空 → 前端資料丟失 | 低 | 中 | 提醒用戶用 server 持久化（不要只靠 IndexedDB） |
| WASM sql.js 載入慢 | 低 | 低 | Vite lazy import + 顯示 Spinner |
| PWA service worker 卡住舊版 | 中 | 中 | 強制 autoUpdate + UI 提示「有新版本，請重新整理」 |

---

## 8. 非功能性需求

| 類別 | 需求 |
|------|------|
| 效能 | 列表頁 < 1 秒、寫入 < 200ms、啟動 < 5 秒 |
| 可用性 | 桌機 1920×1080 為主、支援 1366×768 最小 |
| 維護性 | 每檔 < 500 行、JSDoc 覆蓋率 100%、無 dead code |
| 安全性 | 欄位加密（電話、身份證）、無 SQL injection（用 prepared statement） |
| 可移植性 | macOS / Linux 改 `start.sh` 即可（核心邏輯跨平台） |
| 國際化 | zh-TW（主）、en、zh-CN |
| 授權 | MIT |

---

## 9. 成功指標

| 指標 | 目標 |
|------|------|
| 部署時間 | 從 git clone 到能跑 < 5 分鐘 |
| 學習成本 | 用戶（自主開發者）看完 README 30 秒能啟動 |
| 維護時間 | 每月 < 2 小時（修 bug + 小改） |
| 程式碼品質 | 0 type error、test pass、無 unused code |
| 文件完整性 | README + PRD + PROJECT_FRAME + CHANGELOG 齊全 |

---

## 10. 開放問題（給未來決策）

1. **是否要支援多人協作？** — 目前否，未來若用戶換到大社區可能要
2. **是否要 web 部署？** — 目前否（只有 Docker 本地），未來可加 Render / Fly.io
3. **是否要加記帳的發票 OCR？** — 依需求決定，目前手動輸入
4. **是否要加 Line 推播公告？** — 目前用戶偏好離線

---

## 附錄：對應程式檔案清單

| 模組 | 主要檔案 |
|------|----------|
| PRD（本檔） | `V4/PRD.md` |
| 技術架構 | `V4/PROJECT_FRAME.md` |
| 程式碼 | `client/src/` + `server/src/` + `shared/src/` + `cli/src/` |
| 入口 | `start.ps1` / `v4.bat` / `docker-compose.yml` |
| 文件 | `README.md` / `CHANGELOG.md` / `docs/` |