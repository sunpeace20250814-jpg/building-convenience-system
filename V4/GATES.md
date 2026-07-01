# GATES.md — V4 驗收標準（Acceptance Gates）

> **目的**：每一次 phase 完成後，用同一把尺量一次。通過 → 進下一 phase；失敗 → 回到對應 phase 修。
>
> **AI 友善**：本檔是「**Single Source of Truth**」，所有 worker / agent 接到 task 時都對照本檔確認自己的 scope。
>
> **對應入口**：見 [AGENTS.md](./AGENTS.md)「跑驗收」一節 / [STATUS.md](./STATUS.md) 進度。
>
> **最後更新**：2026-06-25（Attempt 3 — 修正 Gate 4 health response schema、Gate 7 indexedDB.deleteDatabase 白名單、curl timeout）

---

## 0. 怎麼跑驗收？

### Git Bash / WSL（推薦）

```bash
# 全部跑（7 個 gate）
cd C:\Users\sunpe\dev\v4-resident-system
bash V4/check.sh

# 只跑特定 gate（debug 用）
bash V4/check.sh --gate=1      # 只跑 server build
bash V4/check.sh --gate=5      # 只跑完整 API 測試
bash V4/check.sh --skip=6,7    # 跳過 6 (queryAll) + 7 (dead code)
bash V4/check.sh --skip-build  # 跳過 1+2（已 build 過時省時間）
bash V4/check.sh --no-cleanup  # 不自動 kill 背景 process（debug 用）
bash V4/check.sh --help        # 列出所有選項
```

### 退出碼

| 代碼 | 意義 |
|------|------|
| `0` | 全部 P0 PASS（含 P1 warnings OK） |
| `1` | 有 P0 FAIL（看最後總結） |
| `2` | 環境錯誤（pnpm / node / port 不在等） |

### 環境假設

- **Node.js** ≥ 20（pnpm 需）
- **pnpm** 已安裝（`pnpm --version` 跑得起來）
- **Server port**：3001
- **Client (vite preview) port**：9527
- **OS**：Windows（Git Bash）+ 任何有 bash 的 Unix-like

> **執行個體重用**：check.sh 啟動 server / vite preview 前會先 curl 探測，
> 若 port 已被佔用且 endpoint 200 → **reuse 不重建**（避免重 build）。

---

## 1. Gate 總覽

| # | Gate | 等級 | 驗收命令 | 失敗 → 回哪修 |
|---|------|------|----------|---------------|
| 1 | **Server build** | 🟥 P0 | `cd server && pnpm build` | Phase 1 — server typecheck / route / schema |
| 2 | **Client build** | 🟥 P0 | `cd client && pnpm build` | Phase 2 — client typecheck / apiClient / store |
| 3 | **Server smoke** | 🟥 P0 | 啟 server + 5 個關鍵 endpoint | Phase 1 — server route / Fastify |
| 4 | **Client proxy smoke** | 🟥 P0 | `vite preview` (port 9527) + 打 `/api/health` | Phase 3 — vite proxy / 整合 |
| 5 | **完整 API 測試** | 🟥 P0 | `node V4/test-all-endpoints.mjs` | Phase 1 — server route / body schema |
| 6 | **0 queryAll/execute 殘留** | 🟥 P0 | `grep stores/ 內 queryAll/execute 次數 = 0` | Phase 2 — store 重寫 |
| 7 | **死碼檢查** | 🟨 P1 | `grep sql.js / IndexedDB / FSA 在 api/ + modules/` | Phase 9 — 移除死碼 |

> **圖例**：🟥 P0 = 必過才准出貨；🟨 P1 = 應該過，例外要寫理由。
> **P1 失敗不阻擋出貨**，只 warn。

---

## 2. P0 標準（必過）

### Gate 1 — Server build

```bash
cd server && pnpm build        # = tsc
```

- **PASS 條件**：`tsc` exit 0，產出 `server/dist/index.js` + `server/dist/db/*.js` 等
- **FAIL 處理**：
  - Type error → 修對應的 route / schema / repository
  - Import error → 確認檔案存在 / 副檔名（`.js`）正確

### Gate 2 — Client build

```bash
cd client && pnpm build        # = pnpm build:font && tsc && vite build
```

- **PASS 條件**：
  - `tsc --noEmit` exit 0
  - `vite build` exit 0，產出 `client/dist/index.html` + assets
  - 字型 subset 產出完成（`scripts/build-font.ts`）
- **FAIL 處理**：
  - TS error → 修 store / api / component 的型別
  - Vite build error → 通常是 dynamic import 缺檔或 alias 寫錯

### Gate 3 — Server smoke

啟 server (port 3001) 並打 5 個關鍵 endpoint：

| Endpoint | 期望 |
|----------|------|
| `GET /api/health` | `200`，body 包含 `"ok":true`（注意：是 `ok` 不是 `status`） |
| `GET /api/info` | `200`，body 包含 `"name":"v4-resident-system"` |
| `GET /api/residents` | `200`，回 `[]` 或住戶清單 |
| `GET /api/settings/buildings` | `200`，回 `[]` 或建築清單 |
| `GET /api/schedule` | `200`（雖然 schedule 底下有 6 個子資源） |

> **重試**：每個 endpoint 最多 3 次（間隔 1s），處理 server 剛啟動的 cold start。

- **FAIL 處理**：
  - `404` → route 沒 register，回 `server/src/index.ts` 補
  - `500` → 查 server log 修正 repository / SQL bug
  - `connection refused / 000` → server 沒起來，檢查 port 3001 有沒有被佔用

### Gate 4 — Client proxy smoke

`vite preview` 跑起來（port **9527**），打 `http://localhost:9527/api/health`：

- 預期 200（被 vite proxy 轉到 3001）
- 預期 60 秒內 cold start 完成
- body 包含 `"ok":true`（與 Gate 3 同一個 health endpoint schema）

- **FAIL 處理**：
  - 502 / proxy error → `client/vite.config.ts` 的 `preview.proxy` 沒設或 target 錯
  - timeout → vite preview 沒啟動成功，檢查 port 9527 有沒有被佔用

### Gate 5 — 完整 API 測試（30 個 endpoint）

```bash
node V4/test-all-endpoints.mjs
```

跑全部 **30 個 endpoint** 的完整 CRUD 流程（list → POST → GET id → DELETE → after）。

- **PASS 條件**：
  - 30/30 PASS
  - exit code = 0
- **FAIL 處理**：
  - `404` → 該 route 沒實作，去 Phase 1 補
  - `POST 4xx: ValidationError` → 修 server route 的 zod body schema
  - `POST 5xx` → 修 repository / DB constraint

> **已知 13 個 test data FAIL**（見 [STATUS.md](./STATUS.md) 驗收測試結果）：測試 body 的 FK / NOT NULL / validation 欄位不對，**不是 API bug**。修法是修 `test-all-endpoints.mjs` 的 body 欄位，不是修 server。

### Gate 6 — 0 queryAll/execute 殘留（stores）

```bash
# 排除註解（stores/*.ts 開頭通常有「V4 改寫：原本用 queryAll/execute」說明）
grep -rE "^[^/*]*\b(queryAll|execute)\(" client/src/stores/ --include="*.ts"
```

- **PASS 條件**：0 個匹配（除了註解裡的「不再 queryAll」說明）
- **FAIL 處理**：
  - store 還在用 `queryAll(...)` / `execute(...)` → 改成 fetch API（`@/api/xxx`）
  - 對應的 api 也要先實作好（去 Phase 1 補 server route，再 Phase 2 抽 store）

**備註**：

- 模組層（`client/src/modules/`、`client/src/api/`）目前還有 `execute(` 殘留（decoration-records / parking-binding / 等 6 個），這是 **Phase 9 / P1** 範圍。
- `client/src/storage/database.ts` 的 `execute` 是 v4 storage engine 本體，**不要刪**。
- `client/src/api/ai/sql-executor.ts` 的 `queryAll` 是 AI 模組的 SQL 執行（沙盒環境，**不要刪**）。

### Gate 7 — 死碼檢查（🟨 P1 — 失敗只 warn）

```bash
# 1. modules / api 不該直接 import sql.js / IndexedDB
grep -rE "from ['\"]sql\.js|from ['\"]sql\.js/dist|from 'fake-indexeddb|indexedDB" \
  client/src/api/ client/src/modules/ --include="*.ts*"

# 2. modules / api 不該直接用 File System Access API
grep -rE "showSaveFilePicker|showOpenFilePicker|FileSystemDirectoryHandle|FileSystemFileHandle" \
  client/src/api/ client/src/modules/ --include="*.ts*"
```

- **PASS 條件**：
  1. 0 個 sql.js / indexedDB match（在 `api/` / `modules/` 下）
  2. 0 個 FSA match（在 `api/` / `modules/` 下）
- **FAIL 處理**：
  - 找到 sql.js import → 改成 `fetch` 走 server API
  - 找到 FSA import → 改走 server API 或 backend proxy
  - 找到 `indexedDB.deleteDatabase(...)` → 確認是「settings reset」用途（如 StorageSettings.tsx line 61），是**合法清理代碼**，不視為死碼

**合法例外**（允許出現的位置，**不要刪**）：

- `client/src/storage/database.ts` — sql.js 本體（V4 storage engine，Phase 9 才移）
- `client/src/storage/indexedDBAdapter.ts` — IndexedDB adapter（同上）
- `client/src/storage/adapter.ts` — FSA handle（同上）
- `client/src/lib/environment.ts` — 環境偵測
- `client/src/test/setup.ts` — 測試 mock
- `client/src/modules/settings/StorageSettings.tsx` — `indexedDB.deleteDatabase('v4-resident-system')` 是**用戶主動 reset 資料庫**的合法清理代碼，**不視為死碼**

---

## 3. P1 標準（應該過）

| # | 項目 | 標準 | 目前狀態 |
|---|------|------|----------|
| P1-1 | 0 queryAll/execute in **modules/api** | 6 個抽換（decoration / parking / status-options / resident-parking / resident-emergency / double-entry） | 🟡 部分（Phase 9 待做） |
| P1-2 | OpenAPI spec 完整 | `/api/openapi.json` 包含全部 33 routes | 🟢 |
| P1-3 | 所有 route 有 zod schema | grep `schema:` in `server/src/routes/*.ts` 都有 | 🟢 |
| P1-4 | i18n 全 locale 翻譯完整 | zh-TW / zh-CN / en 都對齊 | 🟡 |
| P1-5 | Unit test 通過 | `pnpm --prefix client test` exit 0 | 🟢 |
| P1-6 | E2E test 通過 | `pnpm --prefix client test:e2e` exit 0 | 🟡 |
| P1-7 | 0 sql.js / IndexedDB / FSA 在 client/src/ 內（非 storage） | 對應 Phase 9 移除 | 🟡 部分（storage/ 還在） |
| P1-8 | StorageSettings 內 `indexedDB.deleteDatabase` 為合法清理代碼 | 文件化白名單（見 Gate 7） | 🟢 |

---

## 4. 失敗的處理（回到哪個 phase 修）

```
Gate 1 FAIL ─┐
Gate 2 FAIL ─┤
            ├─→ Phase 2: Client (TypeScript / build / store / api)
Gate 3 FAIL ─┤
Gate 4 FAIL ─┤   或 Phase 1: Server (route / schema / repository)
Gate 5 FAIL ─┘

Gate 6 FAIL ──→ Phase 2: Store 抽換（fetch API）
Gate 7 FAIL ──→ Phase 9: 移除死碼（P1 — 不阻擋出貨）
```

### Phase 對照

- **Phase 1 — Server**：Fastify route + zod schema + repository
- **Phase 2 — Client**：
  - `client/src/api/<resource>.ts`（fetch 封裝）
  - `client/src/stores/<resource>Store.ts`（zustand state）
  - `client/src/modules/<module>/`（UI 元件）
  - `client/src/lib/apiClient.ts`（共用 fetch 工具）
- **Phase 3 — 整合**：vite.config 雙 proxy / client dist static serving
- **Phase 4-8**：見 [STATUS.md](./STATUS.md)
- **Phase 9 — 死碼移除**：刪 `client/src/storage/{database,indexedDBAdapter,adapter}.ts` 等已廢棄 storage 層

---

## 5. CI 整合（未來）

```yaml
# .github/workflows/v4-gates.yml
name: V4 Gates
on: [push, pull_request]
jobs:
  gates:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install
      - run: bash V4/check.sh
```

> 現階段不在 CI 跑（手動驗收為主），但 `check.sh` 的退出碼語意已經是 CI-friendly。

---

## 6. 變更歷史

| 日期 | 變更 |
|------|------|
| 2026-06-25 | 初版 — 7 gates（P0 × 6 + P1 dead code），對應 plan_742ea08a |
| 2026-06-25 (Attempt 3) | 修正 Gate 4 health response schema（`"ok":true` 而非 `"status":"ok"`）、Gate 3 加 retry + curl timeout、Gate 7 白名單 `indexedDB.deleteDatabase`（StorageSettings.tsx line 61）|
