/**
 * 複式記帳模組 (Double-Entry Accounting)
 *
 * M-60 修復 (2026-07-01):
 *   - Server backend 已實作 (M-55 accounts / journal_entries, M-56 4 報表)
 *   - 重新啟用模組 + 進入 sidebar
 *   - 移除 client-side seedDefaultAccounts / createJournalEntry / 報表 generate 函式
 *     (這些都用 storage/database queryAll throw-stub,後端才是 source of truth)
 *   - UI 透過 @/api/accounting 與 @/api/accounting-reports 呼叫 server
 *
 * 會計資料流:
 *   server/src/routes/accounting.ts → accounts / journal_entries / periods CRUD
 *   server/src/routes/accounting-reports.ts → trial-balance / balance-sheet / income-statement / cash-flow
 *   client/src/api/accounting.ts → 13 methods + types (Sprint 5)
 *   client/src/api/accounting-reports.ts → 4 methods + types (Sprint 5)
 *
 * 預設科目表在 server-side (M-55 seedStandardAccounts, 與這裡 DEFAULT_ACCOUNTS 對齊)
 */

import type { ModuleManifest } from '../registry';

export const doubleEntryManifest: ModuleManifest = {
  id: 'double-entry',
  name: '複式記帳',
  category: 'accounting',
  description: '借貸分錄、會計科目表、試算表 / 損益表 / 資產負債表 / 現金流量表。適合需要正規帳的中小企業。',
  defaultEnabled: true, // M-60:server backend 已實作,重新啟用
  routes: [
    { path: '/accounting/chart', label: '會計科目', icon: 'ListTree' },
    { path: '/accounting/journal', label: '分錄', icon: 'BookOpen' },
    { path: '/accounting/reports', label: '財務報表', icon: 'BarChart3' },
    { path: '/accounting/periods', label: '會計期間', icon: 'CalendarRange' },
  ],
  sidebar: [
    { path: '/accounting/chart', label: '會計科目', icon: 'ListTree' },
    { path: '/accounting/journal', label: '分錄', icon: 'BookOpen' },
    { path: '/accounting/reports', label: '財務報表', icon: 'BarChart3' },
  ],
  aiCapabilities: [
    {
      name: '查詢損益',
      description: '查詢指定期間的損益表',
      examples: ['本季的淨利是多少？', '本月哪些費用超過預算？'],
    },
    {
      name: '查詢科目餘額',
      description: '查詢特定會計科目的當前餘額',
      examples: ['應收帳款總額', '現金帳戶餘額'],
    },
  ],
};

// ★ M-60 修復:以下函式都已移除 (server-side 取代):
//   - seedDefaultAccounts → server/src/routes/accounting.ts (M-55 seedStandardAccounts)
//   - createJournalEntry → server/src/routes/accounting.ts (POST /api/accounting/journal-entries)
//   - generateIncomeStatement / generateBalanceSheet / generateTrialBalance / generateCashFlow
//     → server/src/routes/accounting-reports.ts (M-56)
//
// DEFAULT_ACCOUNTS 列表保留供文件參考 (server seedStandardAccounts 是 single source of truth):
//   - 1101 現金, 1102 零用金, 1111 銀行存款, 1112 郵局存款
//   - 1121 應收帳款, 1122 應收票據, 1131 預付款項, 1141 存貨
//   - 1501 土地, 1502 建築物, 1503 累計折舊-建築物, 1504 辦公設備, 1505 累計折舊-辦公設備
//   - 2101 應付帳款, 2102 應付票據, 2111 短期借款, 2121 預收款項, 2131 代收款項
//   - 2201 長期借款, 2301 應付薪資, 2302 應付費用
//   - 3101 業主資本, 3102 資本公積, 3201 保留盈餘, 3202 本期損益
//   - 4101 營業收入, 4102 服務收入, 4201 租金收入, 4202 利息收入, 4299 其他收入
//   - 5101 營業成本
//   - 6101 薪資支出, 6102 租金支出, 6103 水電瓦斯費, 6104 管理費, 6105 修繕費
//   - 6106 保險費, 6107 稅捐, 6108 文具用品, 6109 郵電費, 6110 交通費
//   - 6111 伙食費, 6112 折舊, 6299 其他費用