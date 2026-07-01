/**
 * Budget Panel - 月度類別預算管理
 * V1 ExpenseModule 預算功能
 *
 * - 為每個類別設定每月預算上限
 * - 進度條即時顯示當月已花 / 預算
 * - 顏色：< 70% 綠、70-90% 黃、> 90% 紅、> 100% 深紅
 */

import { useEffect, useMemo, useState } from 'react';
import { useExpenseStore } from '@/stores';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Plus, Trash2, Edit, Target, AlertTriangle, TrendingUp, Wallet } from 'lucide-react';
import { formatCurrency } from '@/utils/format';

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthOptions(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = -3; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

function getProgressColor(percent: number): { bar: string; bg: string; text: string; label: string } {
  if (percent >= 100) return { bar: 'bg-red-600', bg: 'bg-red-100', text: 'text-red-700', label: '已超支' };
  if (percent >= 90) return { bar: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-600', label: '接近上限' };
  if (percent >= 70) return { bar: 'bg-yellow-500', bg: 'bg-yellow-50', text: 'text-yellow-700', label: '注意' };
  return { bar: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-700', label: '正常' };
}

export function BudgetPanel() {
  const {
    expenses, categories, budgets,
    loadExpenses, loadCategories, loadBudgets,
    createBudget, updateBudget, deleteBudget,
  } = useExpenseStore();

  const [month, setMonth] = useState(getCurrentMonth());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    categoryId: '',
    month: getCurrentMonth(),
    amount: '',
  });

  useEffect(() => {
    loadExpenses();
    loadCategories();
  }, []);

  useEffect(() => {
    loadBudgets(month);
  }, [month]);

  // 只顯示支出類別
  const expenseCategories = categories.filter((c) => c.type === 'expense');

  // 計算每個類別當月實際支出
  const actualByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    expenses
      .filter((e) => e.type === 'expense' && e.date.startsWith(month))
      .forEach((e) => {
        const catName = e.category || categories.find((c) => c.id === e.categoryId)?.name || '其他';
        map[catName] = (map[catName] || 0) + e.amount;
      });
    return map;
  }, [expenses, month, categories]);

  // 總體預算 vs 實際
  const totals = useMemo(() => {
    const totalBudget = budgets.reduce((sum, b) => sum + (b.amount || 0), 0);
    const totalActual = budgets.reduce((sum, b) => {
      const cat = categories.find((c) => c.id === b.categoryId);
      const catName = cat?.name || '';
      return sum + (actualByCategory[catName] || 0);
    }, 0);
    return {
      totalBudget,
      totalActual,
      totalPercent: totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0,
      remaining: totalBudget - totalActual,
    };
  }, [budgets, actualByCategory, categories]);

  // 未設預算但有支出的類別（提示建議）
  const unbudgetedCategories = expenseCategories.filter(
    (c) => !budgets.find((b) => b.categoryId === c.id) && (actualByCategory[c.name] || 0) > 0
  );

  const open = (b?: any) => {
    if (b) {
      setEditing(b);
      setForm({
        categoryId: b.categoryId,
        month: b.month,
        amount: String(b.amount),
      });
    } else {
      setEditing(null);
      setForm({
        categoryId: expenseCategories[0]?.id || '',
        month,
        amount: '',
      });
    }
    setModalOpen(true);
  };

  const submit = () => {
    setSubmitting(true);
    try {
      if (editing) {
        updateBudget(editing.id, { amount: Number(form.amount) });
      } else {
        createBudget({
          categoryId: form.categoryId,
          month: form.month,
          amount: Number(form.amount),
        });
      }
      setModalOpen(false);
      loadBudgets(month);
    } finally {
      setSubmitting(false);
    }
  };

  const remove = (b: any) => {
    if (confirm('刪除此預算？')) {
      deleteBudget(b.id);
      loadBudgets(month);
    }
  };

  return (
    <div>
      {/* 月份選擇 + 總體狀態 */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-600" />
            月度預算
          </h3>
          <Select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            options={getMonthOptions().map((m) => ({ value: m, label: m }))}
            className="w-36"
          />
        </div>
        <Button size="sm" onClick={() => open()} disabled={expenseCategories.length === 0}>
          <Plus className="w-4 h-4 mr-1" />新增預算
        </Button>
      </div>

      {/* 總體卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700">本月總預算</p>
              <p className="text-2xl font-bold text-blue-800 mt-1">
                {formatCurrency(totals.totalBudget)}
              </p>
            </div>
            <Wallet className="w-8 h-8 text-blue-500" />
          </div>
        </Card>
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-700">實際支出</p>
              <p className="text-2xl font-bold text-orange-800 mt-1">
                {formatCurrency(totals.totalActual)}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-orange-500" />
          </div>
        </Card>
        <Card className={`bg-gradient-to-br ${
          totals.remaining < 0
            ? 'from-red-50 to-red-100 border-red-200'
            : 'from-green-50 to-green-100 border-green-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${totals.remaining < 0 ? 'text-red-700' : 'text-green-700'}`}>
                {totals.remaining < 0 ? '超支' : '剩餘'}
              </p>
              <p className={`text-2xl font-bold mt-1 ${
                totals.remaining < 0 ? 'text-red-800' : 'text-green-800'
              }`}>
                {formatCurrency(Math.abs(totals.remaining))}
              </p>
            </div>
            {totals.remaining < 0 ? (
              <AlertTriangle className="w-8 h-8 text-red-500" />
            ) : (
              <Target className="w-8 h-8 text-green-500" />
            )}
          </div>
        </Card>
      </div>

      {/* 總體進度條 */}
      {totals.totalBudget > 0 && (
        <Card className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">整體預算執行率</span>
            <span className={`text-sm font-bold ${
              totals.totalPercent >= 100 ? 'text-red-600' :
              totals.totalPercent >= 90 ? 'text-orange-600' : 'text-green-600'
            }`}>
              {totals.totalPercent.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all ${
                totals.totalPercent >= 100 ? 'bg-red-600' :
                totals.totalPercent >= 90 ? 'bg-orange-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(100, totals.totalPercent)}%` }}
            />
          </div>
        </Card>
      )}

      {/* 類別預算明細 */}
      <Card padding="none">
        {budgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Target className="w-12 h-12 mb-3" />
            <p>{month} 尚無預算設定</p>
            <p className="text-sm mt-1">點擊「新增預算」開始為類別設定上限</p>
          </div>
        ) : (
          <div className="divide-y">
            {budgets.map((b) => {
              const cat = categories.find((c) => c.id === b.categoryId);
              const catName = cat?.name || '未分類';
              const actual = actualByCategory[catName] || 0;
              const percent = b.amount > 0 ? (actual / b.amount) * 100 : 0;
              const colors = getProgressColor(percent);
              const remaining = b.amount - actual;

              return (
                <div key={b.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {cat && (
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: cat.color || '#6b7280' }}
                        />
                      )}
                      <span className="font-medium text-gray-900">{catName}</span>
                      <Badge variant={percent >= 100 ? 'danger' : percent >= 70 ? 'warning' : 'success'} size="sm">
                        {colors.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => open(b)}>
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => remove(b)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-1.5 text-sm">
                    <span className="text-gray-600">
                      {formatCurrency(actual)} / {formatCurrency(b.amount)}
                    </span>
                    <span className={`font-bold ${colors.text}`}>
                      {percent.toFixed(0)}%
                    </span>
                  </div>

                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all ${colors.bar}`}
                      style={{ width: `${Math.min(100, percent)}%` }}
                    />
                  </div>

                  <div className="mt-1 text-xs text-gray-500">
                    {remaining >= 0
                      ? `剩餘 ${formatCurrency(remaining)}`
                      : `超支 ${formatCurrency(Math.abs(remaining))}`}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* 未設預算提示 */}
      {unbudgetedCategories.length > 0 && (
        <Card className="mt-4 bg-yellow-50 border-yellow-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-800">本月有支出的類別尚未設定預算</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {unbudgetedCategories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => open({ categoryId: c.id, month, amount: '' })}
                    className="px-2 py-1 text-xs bg-white border border-yellow-300 rounded hover:bg-yellow-100"
                  >
                    {c.name} {formatCurrency(actualByCategory[c.name] || 0)} → 設預算
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Modal */}
      {modalOpen && (
        <Modal
          isOpen
          onClose={() => setModalOpen(false)}
          title={editing ? '編輯預算' : '新增預算'}
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>取消</Button>
              <Button onClick={submit} disabled={submitting || !form.categoryId || !form.amount}>
                {submitting ? '儲存中...' : '儲存'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <Select
              label="類別"
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              options={expenseCategories.map((c) => ({ value: c.id, label: c.name }))}
              required
              disabled={!!editing}
            />
            <Input
              label="月份 (YYYY-MM)"
              value={form.month}
              onChange={(e) => setForm({ ...form, month: e.target.value })}
              placeholder="2026-06"
              required
              disabled={!!editing}
            />
            <Input
              label="預算金額"
              type="number"
              min="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0"
              required
            />
          </div>
        </Modal>
      )}
    </div>
  );
}