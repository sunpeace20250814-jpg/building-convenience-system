# AGENTS.md — V4 入口（唯一默認讀取）

本文件是 V4 大樓住戶管理系統的預設入口。AI 開 V4 session 第一個讀這個就夠。

目標：避免每次開 V4 session 都讀一堆檔，並且讓接續工作有完整上下文。

## 1. 當前狀態（持續更新）

| 欄位 | 當前值 |
|---|---|
| **當前階段** | `V4.0 完成（純前端 + Go-style 三層）` |
| **當前版本** | `V4.0`（2026-06-25） |
| **下一步** | 派 worker 補 V4/PRD.md 等文檔 + Phase 6-9 待做 |
| **V4 文檔系統** | 5/10 個檔完成（AGENTS / STATUS / ERRORS / PRD / PROJECT_FRAME / FLOWS / FRONTEND_HANDOFF / GATES / check.sh / CHANGELOG）— 由 plan_742ea08a worker 並行建 |
| **前端架構** | 純接口（apiClient + hooks + components 三層） |
| **後端架構** | Fastify Node.js + better-sqlite3 + Zod，33 個 routes |
| **資料庫** | SQLite（用戶雲端硬碟鏡像：`G:\我的雲端硬碟\V4住戶管理\resident-system.db`） |
| **歷史報錯** | 見 [ERRORS.md](./ERRORS.md) |
| **驗收閘門** | 見 [GATES.md](./GATES.md) + `bash V4/check.sh` |

## 2. V4 是什麼

一套**離線優先 + 雲端硬碟鏡像**的大樓住戶管理系統：
- **純前端**（React + Vite + TypeScript + Tailwind） + **Fastify Node.js 後端**
- 資料完全在用戶本地 SQLite（.db 檔在雲端硬碟鏡像資料夾，跟著 Google Drive 同步）
- 零後端費用（VPS 都不用），換電腦即同步
- 設計目標：AI 友善、配置低、可商用、穩定運行數年

## 3. 核心流程

```
1_PRD 規劃（已完成，見 PRD.md）
  → 2_項目框架（已完成，見 PROJECT_FRAME.md）
    → 3_交互邏輯（已完成，見 FLOWS.md）
      → 4_前端交接包（已完成，見 FRONTEND_HANDOFF.md）
        → 5_前端生成代碼（已完成 5 個 phase）
          → 6_項目記錄（見 STATUS.md / CHANGELOG.md）
            → 7_驗收閘門（見 GATES.md + check.sh）
```

當前進度：**Phase 1-5 完成**（V4.0 純前端 + Go-style 三層完整版）。
待做：Phase 6 後端 services 層 / Phase 7 每日自動備份 / Phase 8 PowerShell 啟動器 / Phase 9 移除死碼。

## 4. 文件路由表（AI 讀檔依此表）

| 當前任務 | 只讀這些檔 | 默認不讀 |
|---|---|---|
| **接續 V4 session（任何任務開頭）** | **本檔 (AGENTS.md)**、STATUS.md、`必要時 ERRORS.md` | 其他全部 |
| PRD 規劃 | PRD.md | 其他全部 |
| 技術架構 / 模組邊界 / API 契約 | PROJECT_FRAME.md | FLOWS / FRONTEND_HANDOFF / 歷史記錄 |
| 業務流程 / 頁面 / 狀態 | FLOWS.md | 歷史版本、報錯 |
| 給前端 AI 的交接包 | FRONTEND_HANDOFF.md | 完整 PRD / 完整歷史 |
| 前端改 store / 抽換模組 | FRONTEND_HANDOFF.md + `client/src/api/` + `client/src/hooks/` | 完整 PRD |
| 後端改 routes / 加新 API | PROJECT_FRAME.md 第 6 節（API/Mock） + `server/src/routes/` | 前端原始碼 |
| 寫版本記錄 | CHANGELOG.md + STATUS.md | 業務文檔 |
| **修 bug / debug** | **ERRORS.md + STATUS.md** | 完整 PRD |
| 跑驗收 | GATES.md + `bash V4/check.sh` | 規劃文檔 |
| 理解整套框架 | WORKFLOW.md（如有）+ 本檔 | 業務文檔 |
| **後端 / API 設計** | PROJECT_FRAME.md 第 6 節 + server/src/routes/ | FLOWS（除非 API 影響 UI） |

## 5. 各階段視角（已完成的階段不再切換）

| 階段 | 視角 | 核心判斷標準 |
|---|---|---|
| ✅ 1_PRD 規劃 | 資深產品經理 | P0 可交付、驗收可觀察 |
| ✅ 2_項目框架 | 技術架構師 | 技術選型有理由、模組邊界清楚 |
| ✅ 3_交互邏輯 | 交互設計師 | 每個動作的觸發/反饋/異常清楚 |
| ✅ 4_前端交接包 | 技術負責人 | 接收方 AI 無需問任何問題就能開工 |
| ✅ 5_前端生成代碼 | 前端工程師 | 嚴格按交接包實現，不自行擴展 |
| ✅ 6_項目記錄 | 項目經理 | 下次對話無需翻聊天記錄也能接續 |
| 🟡 7_驗收閘門 | QA 工程師 | 17/30 API 完整 PASS；13/30 測試資料欄位錯（待修） |

## 6. 硬門（不可違反）

- ❌ **不擅自改核心技術棧**（純前端 + Fastify 已鎖定）
- ❌ **不引入未經用戶確認的新依賴**
- ❌ **不硬編碼密鑰、密碼、token**
- ❌ **不繞過 vite proxy 直接打 server URL**
- ❌ **不刪除或覆蓋用戶資料**，除非用戶明確批准（歷史 .db 已備份到 `workspace/`)
- ❌ **不混用 backend/frontend 邏輯**（純接口架構）
- ❌ **不在 stores 直接 queryAll**（已全抽換成 fetch API）
- ❌ **不假裝完成**：必須 `bash V4/check.sh` 通過且滿足 P0 驗收標準

## 7. 文檔更新規則

| 發生什麼 | 更新哪裡 |
|---|---|
| 產品定位、用戶、範圍、驗收變化 | PRD.md |
| 技術棧、目錄結構、模組、API 變化 | PROJECT_FRAME.md |
| 頁面、流程、狀態、交互、異常變化 | FLOWS.md |
| 給前端 AI 的交接內容變化 | FRONTEND_HANDOFF.md |
| 當前版本、進度、下一步變化 | **本檔狀態塊 + STATUS.md** |
| 發布或完成版本 | CHANGELOG.md |
| 出現報錯、失敗、踩坑 | **ERRORS.md**（最重要，避免重複） |
| 驗收命令、質量標準變化 | GATES.md + check.sh |

## 8. 回覆結尾格式

每次較完整的回覆結尾都匯報：
1. 完成了什麼
2. 下一步是什麼
3. 有沒有卡點或需要用戶確認

---

**框架引用**：本文件結構源自 [vibecoding-linear-framework](https://github.com/liuethanyes-spec/vibecoding-linear-framework)，VibeCoding 線性框架（低 token、強執行的 AI 開發流程）。