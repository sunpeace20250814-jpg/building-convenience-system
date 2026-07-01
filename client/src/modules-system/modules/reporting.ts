/**
 * 報表中心模組
 *
 * 啟用後提供統一的報表入口：
 * - 內建報表（收支趨勢、住戶分析...）
 * - 各專業模組提供的報表（複式記帳的損益表等）
 * - 自訂報表（SQL 查詢 + 圖表）
 */

import type { ModuleManifest } from '../registry';

export const reportingManifest: ModuleManifest = {
  id: 'reporting',
  name: '報表中心',
  category: 'reporting',
  description: '統一報表入口：收支趨勢、住戶分析、圖表儀表板。',
  defaultEnabled: false, // M-50 修復:backend 未實作,避免點到 crash;後續實作後改回 true
  routes: [
    { path: '/reports', label: '報表中心', icon: 'PieChart' },
    { path: '/reports/custom', label: '自訂報表', icon: 'Code' },
  ],
  sidebar: [
    { path: '/reports', label: '報表中心', icon: 'PieChart' },
  ],
  reports: [
    {
      id: 'expense-trend',
      name: '收支趨勢',
      category: 'custom',
      generate: async ({ startDate, endDate }) => {
        const { queryAll } = await import('@/storage/database');
        const rows = queryAll<any>(
          `SELECT substr(date, 1, 7) as month,
                  SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as income,
                  SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as expense
           FROM expense_records
           WHERE date BETWEEN ? AND ?
           GROUP BY substr(date, 1, 7)
           ORDER BY month`,
          [startDate, endDate]
        );
        return {
          title: `收支趨勢（${startDate} ~ ${endDate}）`,
          columns: [
            { key: 'month', label: '月份', type: 'string' },
            { key: 'income', label: '收入', type: 'currency' },
            { key: 'expense', label: '支出', type: 'currency' },
            { key: 'net', label: '淨額', type: 'currency' },
          ],
          rows: rows.map((r) => ({ ...r, net: r.income - r.expense })),
        };
      },
    },
    {
      id: 'expense-by-category',
      name: '支出分類彙總',
      category: 'custom',
      generate: async ({ startDate, endDate }) => {
        const { queryAll } = await import('@/storage/database');
        const rows = queryAll<any>(
          `SELECT c.name as category, COUNT(*) as count, SUM(e.amount) as total
           FROM expense_records e
           LEFT JOIN expense_categories c ON c.id = e.category_id
           WHERE e.type = 'expense' AND e.date BETWEEN ? AND ?
           GROUP BY c.name
           ORDER BY total DESC`,
          [startDate, endDate]
        );
        return {
          title: `支出分類彙總（${startDate} ~ ${endDate}）`,
          columns: [
            { key: 'category', label: '類別', type: 'string' },
            { key: 'count', label: '筆數', type: 'number' },
            { key: 'total', label: '金額', type: 'currency' },
          ],
          rows,
        };
      },
    },
  ],
};
