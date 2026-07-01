/**
 * Expense Charts - Chart.js 圖表分析
 * 圓餅圖：各類別支出比例
 * 長條圖：每月收支對比
 * 趨勢圖：近 30 天每日支出
 */

import { useMemo } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Pie, Bar, Line } from 'react-chartjs-2';
import { Card } from '@/components/ui/Card';

ChartJS.register(
  ArcElement, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip, Legend
);

interface Props {
  expenses: any[];
  categories: any[];
  budgets?: any[];
}

export function ExpenseCharts({ expenses, categories, budgets = [] }: Props) {
  // 圓餅圖：支出類別比例
  const expensePieData = useMemo(() => {
    const byCategory: Record<string, number> = {};
    expenses.filter((e) => e.type === 'expense').forEach((e) => {
      const catName = e.category || categories.find((c) => c.id === e.categoryId)?.name || '其他';
      byCategory[catName] = (byCategory[catName] || 0) + e.amount;
    });
    const labels = Object.keys(byCategory);
    const data = Object.values(byCategory);
    const colors = labels.map((label) =>
      categories.find((c) => c.name === label)?.color || '#9ca3af'
    );
    return {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor: '#fff',
        borderWidth: 2,
      }],
    };
  }, [expenses, categories]);

  // 長條圖：近 6 個月收支對比
  const monthlyBarData = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const incomeByMonth = months.map((m) =>
      expenses.filter((e) => e.type === 'income' && e.date.startsWith(m)).reduce((s, e) => s + e.amount, 0)
    );
    const expenseByMonth = months.map((m) =>
      expenses.filter((e) => e.type === 'expense' && e.date.startsWith(m)).reduce((s, e) => s + e.amount, 0)
    );
    return {
      labels: months,
      datasets: [
        {
          label: '收入',
          data: incomeByMonth,
          backgroundColor: '#22c55e',
        },
        {
          label: '支出',
          data: expenseByMonth,
          backgroundColor: '#ef4444',
        },
      ],
    };
  }, [expenses]);

  // 趨勢圖：近 30 天每日支出
  const trendData = useMemo(() => {
    const days: string[] = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split('T')[0]);
    }
    const dailyExpense = days.map((d) =>
      expenses.filter((e) => e.type === 'expense' && e.date === d).reduce((s, e) => s + e.amount, 0)
    );
    return {
      labels: days.map((d) => d.slice(5)), // MM-DD
      datasets: [{
        label: '每日支出',
        data: dailyExpense,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.3,
        fill: true,
      }],
    };
  }, [expenses]);

  // 預算 vs 實際長條圖
  const budgetVsActualData = useMemo(() => {
    if (budgets.length === 0) return null;
    const labels: string[] = [];
    const budgetVals: number[] = [];
    const actualVals: number[] = [];
    const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    budgets.filter((b) => b.month === currentMonth).forEach((b) => {
      const cat = categories.find((c) => c.id === b.categoryId);
      if (!cat) return;
      const actual = expenses
        .filter((e) => e.type === 'expense' && e.date.startsWith(currentMonth))
        .filter((e) => e.categoryId === cat.id || e.category === cat.name)
        .reduce((s, e) => s + e.amount, 0);
      labels.push(cat.name);
      budgetVals.push(b.amount);
      actualVals.push(actual);
    });

    if (labels.length === 0) return null;
    return {
      labels,
      datasets: [
        { label: '預算', data: budgetVals, backgroundColor: '#3b82f6' },
        { label: '實際', data: actualVals, backgroundColor: '#f97316' },
      ],
    };
  }, [budgets, expenses, categories]);

  const hasData = expenses.length > 0;

  if (!hasData) {
    return (
      <Card className="text-center py-16 text-gray-400">
        <p>尚無收支記錄，新增後即可看到圖表分析</p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 圓餅圖：支出類別 */}
      <Card>
        <h3 className="font-medium text-gray-900 mb-4">支出類別比例</h3>
        <div className="h-64">
          <Pie
            data={expensePieData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'right' as const },
              },
            }}
          />
        </div>
      </Card>

      {/* 長條圖：月度對比 */}
      <Card>
        <h3 className="font-medium text-gray-900 mb-4">近 6 個月收支</h3>
        <div className="h-64">
          <Bar
            data={monthlyBarData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: 'top' as const } },
              scales: { y: { beginAtZero: true } },
            }}
          />
        </div>
      </Card>

      {/* 趨勢圖：30 天支出 */}
      <Card className="lg:col-span-2">
        <h3 className="font-medium text-gray-900 mb-4">近 30 天支出趨勢</h3>
        <div className="h-64">
          <Line
            data={trendData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: { y: { beginAtZero: true } },
            }}
          />
        </div>
      </Card>

      {/* 預算 vs 實際 */}
      {budgetVsActualData && (
        <Card className="lg:col-span-2">
          <h3 className="font-medium text-gray-900 mb-4">
            本月預算 vs 實際 ({new Date().getFullYear()}-{String(new Date().getMonth() + 1).padStart(2, '0')})
          </h3>
          <div className="h-64">
            <Bar
              data={budgetVsActualData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top' as const } },
                scales: { y: { beginAtZero: true } },
              }}
            />
          </div>
        </Card>
      )}
    </div>
  );
}