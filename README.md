# 大樓便捷系統 (Building Convenience System)

> 純本地、零雲端、零外部依賴的大樓住戶與財務管理系統。
> 專為個人 / 小型管委會設計 — 個人 side project，可商用、穩定運行數年、配置低。

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-green.svg)](package.json)
[![pnpm](https://img.shields.io/badge/pnpm-9-orange.svg)](package.json)
[![Tests](https://img.shields.io/badge/tests-91%2F91%20PASS-brightgreen.svg)](server/tests/)

---

## 這個專案在做什麼？

整合 18 個業務模組的單租戶管理系統：

| 模組 | 功能 |
|---|---|
| 住戶管理 | 棟別 / 樓層 / 單位 / 住戶資料 + 子資源（緊急聯絡人 / 車位 / 裝潢 / 訓練）|
| 財務 | 費用登錄 / 分帳（支援 equal / none 兩種 splitMethod）/ 收據 / 預算 |
| 排班 | 員工 / 班別 / 排班表（含 UNIQUE 防重複 + 假日過濾）|
| 首頁公告 | 多分頁 + 圖片附件（server upload，不再 base64 直存 DB）|
| 設定 | 棟別 / 樓層 / 設施 / 車位 / 假期 / 狀態選項 |
| 報表 | 月結、年結、財務分析（內建 SVG / Chart）|
| AI 子系統 | 內建 SQL executor + 自動備份 + 系統監控 |

---

## 設計原則

1. **AI 友善技術棧** — 純 web + 後端（React 19 + Fastify v4 + SQLite），故意不包 Electron 桌面板
2. **資料絕對本地** — SQLite 檔案，無雲端同步、無外部依賴
3. **可商用、可維護** — 寫 regression test 守護每個 bug 修復
4. **零外部服務** — 不連 GitHub API / Firebase / Supabase / 任何 SaaS

---

## 技術棧

```
┌─────────────────┐    ┌─────────────────┐
│ React 19        │    │ Fastify v4      │
│ TypeScript      │    │ TypeScript      │
│ Vite            │    │ better-sqlite3  │
│ TanStack Query  │◄──►│ 33 routes       │
│ React Router    │    │ 34 tables       │
└─────────────────┘    └─────────────────┘
       │                      │
       ▼                      ▼
┌─────────────────┐    ┌─────────────────┐
│ 18 業務模組     │    │ SQLite          │
│ (modules/)      │    │ (本地檔案)      │
└─────────────────┘    └─────────────────┘
```

**為什麼不用這些？**

| 不採用 | 原因 |
|---|---|
| Electron | 包裝後 AI agent 看不到原始碼、除錯困難 |
| MongoDB / Postgres | 多進程複雜度、本機不需要 |
| Docker | 直接跑 Node 進程更簡潔 |
| 雲端同步 | 個資 + 網路依賴，違背「本地」原則 |
| TypeScript `any` | 已盡量明確型別，僅 134 處 legacy 暫存 |

---

## 30 秒快速啟動

### 前置
- Node.js 20 LTS
- pnpm 9+

### 安裝與啟動

```powershell
# 1. Clone
git clone <this-repo>
cd <this-repo>

# 2. 安裝依賴（5-10 分鐘）
pnpm install

# 3. Build 前端
cd client
pnpm run build
cd ..

# 4. 啟動 server
cd server
npx tsx src/index.ts
# → 預設跑在 http://127.0.0.1:4567
```

或使用根目錄的啟動腳本：

```powershell
.\start-v4.bat        # Windows
# 或
.\start-v4.mjs        # Node.js
```

### 健康檢查

```powershell
curl http://127.0.0.1:4567/api/health
# → {"status":"ok"}
```

---

## 專案結構

```
.
├── client/                       # React 19 前端
│   ├── src/
│   │   ├── modules/             # 18 個業務模組
│   │   ├── components/ui/       # 共用 UI 元件
│   │   ├── api/                 # HTTP client
│   │   ├── ai/                  # 內建 AI 子系統
│   │   └── ...
│   └── package.json
│
├── server/                       # Fastify v4 後端
│   ├── src/
│   │   ├── routes/              # 33 個 API 端點
│   │   ├── services/            # 業務邏輯層
│   │   ├── domain/              # 純函式（FSM、building domain）
│   │   ├── db/                  # schema + repository + migrations
│   │   └── jobs/                # 8 個排程工作
│   ├── tests/                   # 6 個 vitest 檔（守護測試）
│   └── data/                    # ⚠️ SQLite DB（個資，不會 push 到 GitHub）
│
├── shared/                       # Deprecated 共用 package（M-19, 後續移除）
├── cli/                          # CLI 工具
├── tools/                        # misc 工具
├── docs/                         # 設計文件
├── pnpm-workspace.yaml
└── .github/workflows/            # CI/CD
```

---

## 測試狀態

```
總測試: 91/91 PASS ✅
├─ Server unit tests (vitest):  59/59 PASS
├─ E2E HTTP integration:        14/14 PASS  (需重啟 server 才能跑)
└─ 真實業務流程演練:            18/18 PASS  (需重啟 server 才能跑)
```

### 跑測試

```powershell
# Server unit tests
cd server
pnpm vitest run

# E2E + acceptance（需 server 跑著）
# 見 docs/testing.md 或 v4-test-env/ 目錄（個人測試環境，不公開）
```

---

## 已知 Bug 修復歷史

詳見 `CHANGELOG.md` 或每個 vitest 守護檔的註解。

最近 18 個修復（節錄）：

| 代號 | 問題 |
|---|---|
| M-15 | 圖片不再 base64 直存 DB，改用 server upload |
| M-16 | home-tabs DELETE cascade 正確 SET NULL |
| M-20 | residents.status FSM 強制枚舉 |
| M-30 | 字串欄位全域長度上限 10000 chars |
| setup.ts | 修復測試 DB 隔離 bug（之前其實跑在 production DB 上）|

---

## 開發注意事項

### Server 沒 hot-reload

改 `.ts` 後必須重啟：
```powershell
$portPid = (Get-NetTCPConnection -LocalPort 4567).OwningProcess
taskkill /PID $portPid /F
# 然後重新 npx tsx src/index.ts
```

### SQLite FK 預設 OFF

每個 connection 都要 `PRAGMA foreign_keys = ON`。`server/tests/setup.ts` 每次測試都會驗證。

### 環境變數

```powershell
$env:DATA_DIR = "C:\path\to\data"   # SQLite 資料夾，預設 <repo>/server/data
$env:PORT     = "4567"
$env:HOST     = "127.0.0.1"
$env:LOG_LEVEL = "warn"              # debug / info / warn / error
```

---

## License

MIT © 2026 Sunpe

---

## 貢獻者

這是個人 side project — 主要由 [Sunpe](https://github.com/sunpe) 開發。
任何 issue / PR 歡迎，但 roadmap 由作者決定（個人使用需求優先）。

---

## 相關專案

- **v4-test-env**（個人測試環境，**未公開**）— e2e / acceptance 測試 driver
- **Mavis**（AI 助手）— 整個開發流程的對話夥伴