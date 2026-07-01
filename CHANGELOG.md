# Changelog

所有 V4 版本的重要變更記錄。格式基於 [Keep a Changelog](https://keepachangelog.com/)。

## [1.2.0] - 2026-06-22

### Removed（依使用者決策）
- **雲端同步功能** — `/api/sync/*`、CloudSyncPanel、client/src/sync/、server sync route + db/sync.ts 全移除
- **PWA** — Service Worker、manifest.webmanifest、sw.js、registerServiceWorker 移除（PC Windows 桌面用不到）
- **License 系統** — 移除未接線的 LicensePanel + useLicense（dead code）

### Changed
- README 重寫為「PC Windows 桌面版」定位
  - 明確標示：只支援桌機 / 筆電
  - 強調「不需要網路」、「完全離線可用」
  - 30 秒啟動改為 3 種方式（雙擊 HTML / vite preview / docker）

### Verified
- ✅ Client typecheck 0 錯誤
- ✅ Server typecheck 0 錯誤
- ✅ 84 tests 全綠
- ✅ Client build 通過（35.97s）

## [1.1.0] - 2026-06-20

### Added
- **Server smoke test 通過** — 6/6 端點驗證（health / info / openapi / residents / settings/buildings / sync/list）
- **雲端同步 API** — `/api/sync/{upload,download,list,delete}` — 整包 SQLite 上傳/下載，可選備援
- **License 系統** — `/api/license/{activate,status,deactivate,list}` + 三層級（free/pro/enterprise）
- **LicensePanel UI** — 啟用狀態 + 30 天試用按鈕 + API base 設定
- **部署指南** — `docs/deploy.md` — 5 步驟從買 VPS 到上線 HTTPS（Caddy + nginx 兩版）

### Changed
- README 加入 v1.1 章節：雲端同步、License、部署指南連結

### Verified
- ✅ Server typecheck 0 錯誤
- ✅ Client typecheck 0 錯誤
- ✅ 6/6 API 端點 200 OK
- ✅ 29 個資料表初始化成功

### Known Limitations
- Playwright E2E 仍需手動跑（公司環境需 internet 安裝瀏覽器二進位）
- License in-memory Map，服務器重啟會清空（正式版應改 DB）

## [1.0.0] - 2026-06-20

### 🎉 首次商業可用版本

#### Added
- **完整 V1 功能移植** — 7 個業務模組（住戶、設定、記帳、班表、公告、零用金、備份）
- **28 個資料表** — 涵蓋 V1 完整功能（住戶/成員/車位/樓層/公設/狀態/班表/記帳/零用金/預算/培訓/公告/備份/假日/班別等）
- **生樓表視圖** — 樓層 × 戶別網格互動視覺化
- **快速輸入語法** — `支 500 餐飲` / `收 1000 房租` 一鍵記帳
- **Chart.js 圖表分析** — 圓餅圖、長條圖、30 天趨勢線
- **預算管理** — 月度類別預算 + 三色進度條 + 超支提示
- **共享分攤邏輯** — 多住戶分攤，自動計算每人金額
- **車位雙向綁定** — 設住戶自動更新車位，反之亦然
- **CSV 匯入匯出** — V1 規格格式，住戶 + 成員
- **備份管理** — `.db` / `.json` / `.json.gz` 三格式 + 排程 + 歷史還原
- **圖片附件 + Lightbox** — 公告圖文 + 點擊放大預覽
- **員工培訓記錄** — 培訓日期 + 內容 + 備註 CRUD

#### Engineering
- **A. 零設定啟動** — IndexedDB 預設儲存，無需選資料夾；可選升級到本地資料夾（FSA）
- **B. 後端骨架** — Fastify + better-sqlite3 + zod + OpenAPI spec + 健康檢查 + 優雅關機
- **B. 20 個 API 路由** — 完整 CRUD 對齊 V4 schema
- **C. ErrorBoundary + 全域錯誤處理** — 任何白屏都會被攔截並顯示友善錯誤頁
- **D. Vitest + 75+ 單元測試** — jsdom + Testing Library，覆蓋率門檻 50%
- **多語系 (i18n)** — 繁中 / 簡中 / 英文 + 語言切換器
- **PWA** — Service Worker + manifest + 可安裝到桌面捷徑 + 離線快取
- **Docker 化** — `docker-compose.yml` + 兩個 Dockerfile + nginx SPA fallback

#### Tooling
- `pnpm typecheck` — TypeScript 嚴格模式 0 錯誤
- `pnpm test` — 跑全部單元測試
- `pnpm test:cov` — 覆蓋率報告
- `pnpm ci` — typecheck + test + build 一條龍
- `pnpm --prefix server dev` — 啟動 Fastify API
- `pnpm --prefix client dev` — 啟動 Vite dev server

### Architecture
- **AI 友善設計原則**：
  - 每個檔頭都有 JSDoc「AI 友善說明」
  - 純 Web + 標準後端，無 Electron 桌面包裝
  - TypeScript strict 模式
  - 統一錯誤處理（不暴露 stack trace）
  - OpenAPI 3.0 規範可自動產生客戶端型別

### Performance
- sql.js WASM 啟動時間：< 200ms
- IndexedDB 寫入 debounce：500ms
- 23 表 schema 初始化：< 50ms
- 健康檢查端點：< 10ms

### Security
- CORS 在生產模式嚴格限制（ALLOWED_ORIGINS 環境變數）
- 不在錯誤訊息洩漏 stack trace
- 所有 SQL 使用 prepared statements
- Foreign keys 強制啟用

### Documentation
- README.md — 30 秒快速啟動 + 環境需求 + 開發者 setup
- OpenAPI spec — `/api/openapi.json`
- JSDoc — 每個檔頭的 AI 友善說明
- CHANGELOG.md — 本檔案

---

## [0.x] - 2026-04 ~ 2026-06

- 開發階段，從 V1 → V4 重構
- 不對外發布，僅內部迭代
- 詳細歷史見 git log

[1.0.0]: #100--2026-06-20
[0.x]: #0x--2026-04--2026-06