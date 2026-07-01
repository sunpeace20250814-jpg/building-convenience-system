import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useExpenseStore, useResidentStore } from '@/stores';
import type { ExpenseRecord } from '@/stores/expenseStore';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { ReportButton } from '@/components/ReportButton';
import { AllowancePanel } from './AllowancePanel';
import { ExpenseCharts } from './ExpenseCharts';
import { QuickExpenseInput } from './QuickExpenseInput';
import { BudgetPanel } from './BudgetPanel';
import {
  Plus,
  Search,
  TrendingUp,
  TrendingDown,
  Wallet,
  Trash2,
  Edit,
  Filter,
  Calendar,
  DollarSign,
  PiggyBank,
  BarChart3,
  ListChecks,
  Target,
} from 'lucide-react';

interface ExpenseFormData {
  type: 'income' | 'expense';
  date: string;
  amount: string;
  categoryId: string;
  description: string;
  splitMethod: 'none' | 'equal' | 'custom';
  sharedBy: string[];
}

interface CategoryFormData {
  name: string;
  type: 'income' | 'expense';
  color: string;
}

export function ExpensesModule() {
  const { t } = useTranslation();
  const {
    expenses,
    categories,
    budgets,
    loadExpenses,
    loadCategories,
    loadBudgets,
    createExpense,
    deleteExpense,
    createCategory,
    isLoading,
  } = useExpenseStore();
  const { residents, loadResidents } = useResidentStore();

  useEffect(() => {
    loadResidents();
  }, []);

  const [mode, setMode] = useState<'account' | 'allowance' | 'charts' | 'budget'>('account');

  useEffect(() => {
    if (mode === 'budget') loadBudgets();
  }, [mode]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<ExpenseFormData>({
    type: 'expense',
    date: new Date().toISOString().split('T')[0],
    amount: '',
    categoryId: '',
    description: '',
    splitMethod: 'none',
    sharedBy: [],
  });

  const [categoryForm, setCategoryForm] = useState<CategoryFormData>({
    name: '',
    type: 'expense',
    color: '#3B82F6',
  });

  useEffect(() => {
    loadExpenses();
    loadCategories();
  }, [mode]);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      // Month filter
      if (filterMonth && !expense.date.startsWith(filterMonth)) {
        return false;
      }
      // Type filter
      if (filterType !== 'all' && expense.type !== filterType) {
        return false;
      }
      // Category filter
      if (filterCategory !== 'all' && expense.categoryId !== filterCategory) {
        return false;
      }
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const category = categories.find((c) => c.id === expense.categoryId);
        return (
          expense.description?.toLowerCase().includes(query) ||
          category?.name.toLowerCase().includes(query) ||
          expense.amount.toString().includes(query)
        );
      }
      return true;
    });
  }, [expenses, filterMonth, filterType, filterCategory, searchQuery, categories]);

  // Stats calculation
  const stats = useMemo(() => {
    const totalIncome = expenses
      .filter((e) => e.type === 'income' && (!filterMonth || e.date.startsWith(filterMonth)))
      .reduce((sum, e) => sum + e.amount, 0);
    const totalExpense = expenses
      .filter((e) => e.type === 'expense' && (!filterMonth || e.date.startsWith(filterMonth)))
      .reduce((sum, e) => sum + e.amount, 0);
    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
    };
  }, [expenses, filterMonth]);

  // Available months for filter
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    expenses.forEach((e) => {
      months.add(e.date.substring(0, 7));
    });
    return Array.from(months).sort().reverse();
  }, [expenses]);

  const handleNew = () => {
    setEditingExpense(null);
    setFormData({
      type: 'expense',
      date: new Date().toISOString().split('T')[0],
      amount: '',
      categoryId: categories[0]?.id || '',
      description: '',
      splitMethod: 'none',
      sharedBy: [],
    });
    setIsModalOpen(true);
  };

  const handleEdit = (expense: ExpenseRecord) => {
    setEditingExpense(expense);
    const sharedBy = (expense as any).sharedBy ? (expense as any).sharedBy.split(',') : [];
    setFormData({
      type: expense.type,
      date: expense.date,
      amount: expense.amount.toString(),
      categoryId: expense.categoryId ?? '',
      description: expense.description || '',
      splitMethod: sharedBy.length > 0 ? 'equal' : 'none',
      sharedBy,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (expense: ExpenseRecord) => {
    if (window.confirm(t('expenses.deleteConfirm'))) {
      await deleteExpense(expense.id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        type: formData.type,
        date: formData.date,
        amount: Number(formData.amount),
        categoryId: formData.categoryId,
        description: formData.description || undefined,
        splitMethod: formData.splitMethod,
        sharedBy: formData.sharedBy.join(','),
      };

      if (editingExpense) {
        // For edit, we'd need an updateExpense function
        await deleteExpense(editingExpense.id);
      }
      await createExpense(payload);
      setIsModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        ...categoryForm,
        sortOrder: categories.length,
      };
      await createCategory(payload);
      await loadCategories();
      setIsCategoryModalOpen(false);
      setCategoryForm({ name: '', type: 'expense', color: '#3B82F6' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCategoryById = (id: string | null | undefined) => {
    if (!id) return undefined;
    return categories.find((c) => c.id === id);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('zh-TW', {
      style: 'currency',
      currency: 'TWD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="p-6">
      <PageHeader
        title={t('expenses.title')}
        description={t('expenses.description')}
        actions={
          <div className="flex gap-2">
            <ReportButton
              label={t('residents.exportReport')}
              generate={() => {
                const rows = filteredExpenses.map((e) => ({
                  ...e,
                  categoryName: getCategoryById(e.categoryId)?.name || '-',
                }));
                return {
                  title: t('expenses.title'),
                  subtitle: `${t('expenses.recordCount', { count: expenses.length })}`,
                  filename: `expenses_${new Date().toISOString().slice(0, 10)}`,
                  columns: [
                    { key: 'date', label: t('expenses.tableHeaders.date'), width: 12 },
                    { key: 'type', label: t('expenses.tableHeaders.actions'), width: 10, format: (v) => v === 'income' ? t('expenses.typeIncome') : t('expenses.typeExpense') },
                    { key: 'categoryName', label: t('expenses.tableHeaders.category'), width: 15 },
                    { key: 'amount', label: t('expenses.tableHeaders.amount'), width: 12, format: (v) => v ? `$${v}` : '-' },
                    { key: 'description', label: t('expenses.tableHeaders.description'), width: 30 },
                  ],
                  rows,
                };
              }}
            />
            <Button variant="secondary" onClick={() => setIsCategoryModalOpen(true)}>
              <Filter className="w-4 h-4 mr-2" />
              {t('expenses.categoryManage')}
            </Button>
            <Button onClick={handleNew}>
              <Plus className="w-4 h-4 mr-2" />
              {t('expenses.addExpense')}
            </Button>
          </div>
        }
      />

      {/* Mode Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        <button
          onClick={() => setMode('account')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            mode === 'account' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ListChecks className="w-4 h-4 inline mr-1.5" />{t('expenses.tabs.account')}
        </button>
        <button
          onClick={() => setMode('allowance')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            mode === 'allowance' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <PiggyBank className="w-4 h-4 inline mr-1.5" />{t('expenses.tabs.allowance')}
        </button>
        <button
          onClick={() => setMode('charts')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            mode === 'charts' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <BarChart3 className="w-4 h-4 inline mr-1.5" />{t('expenses.tabs.charts')}
        </button>
        <button
          onClick={() => setMode('budget')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            mode === 'budget' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Target className="w-4 h-4 inline mr-1.5" />{t('expenses.tabs.budget')}
        </button>
      </div>

      {mode === 'allowance' && <AllowancePanel />}
      {mode === 'charts' && <ExpenseCharts expenses={expenses} categories={categories} budgets={budgets} />}
      {mode === 'budget' && <BudgetPanel />}
      {mode === 'account' && (
        <>
      <QuickExpenseInput
        categories={categories}
        onSubmit={(data) => createExpense(data)}
      />
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-700">{t('expenses.stats.totalIncome')}</p>
              <p className="text-2xl font-bold text-green-800 mt-1">
                {formatCurrency(stats.totalIncome)}
              </p>
            </div>
            <div className="p-3 bg-green-200 rounded-full">
              <TrendingUp className="w-6 h-6 text-green-700" />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-700">{t('expenses.stats.totalExpense')}</p>
              <p className="text-2xl font-bold text-red-800 mt-1">
                {formatCurrency(stats.totalExpense)}
              </p>
            </div>
            <div className="p-3 bg-red-200 rounded-full">
              <TrendingDown className="w-6 h-6 text-red-700" />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-700">{t('expenses.stats.balance')}</p>
              <p className="text-2xl font-bold text-blue-800 mt-1">
                {formatCurrency(stats.balance)}
              </p>
            </div>
            <div className="p-3 bg-blue-200 rounded-full">
              <Wallet className="w-6 h-6 text-blue-700" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder={t('expenses.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            options={availableMonths.length > 0
              ? availableMonths.map((m) => ({
                  value: m,
                  label: m,
                }))
              : [{ value: filterMonth, label: filterMonth }]
            }
            className="w-36"
          />

          <Select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as 'all' | 'income' | 'expense')}
            options={[
              { value: 'all', label: t('expenses.filterAllTypes') },
              { value: 'income', label: t('expenses.typeIncome') },
              { value: 'expense', label: t('expenses.typeExpense') },
            ]}
            className="w-32"
          />

          <Select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            options={[
              { value: 'all', label: t('expenses.filterAllCategories') },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
            className="w-36"
          />
        </div>
      </Card>

      {/* Table */}
      <Card padding="none">
        {isLoading && expenses.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
            <span className="ml-3 text-gray-500">{t('common.loading')}</span>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <DollarSign className="w-12 h-12 mb-3" />
            <p className="text-lg font-medium">{t('expenses.noRecords')}</p>
            <p className="text-sm mt-1">{t('expenses.noRecordsHint')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('expenses.tableHeaders.date')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('expenses.tableHeaders.category')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('expenses.tableHeaders.description')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('expenses.tableHeaders.amount')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('expenses.tableHeaders.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredExpenses.map((expense) => {
                  const category = getCategoryById(expense.categoryId);
                  return (
                    <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-900">{expense.date}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant={expense.type === 'income' ? 'success' : 'danger'}
                          size="sm"
                          style={{ backgroundColor: category?.color || '#3B82F6' + '20', color: category?.color || '#3B82F6' }}
                        >
                          {category?.name || t('expenses.uncategorized')}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-700">
                          {expense.description || '-'}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span
                          className={`text-sm font-semibold ${
                            expense.type === 'income' ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {expense.type === 'income' ? '+' : '-'}
                          {formatCurrency(expense.amount)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(expense)}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleDelete(expense)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Summary */}
      <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
        <p>{t('expenses.recordCount', { count: filteredExpenses.length })}</p>
        {(filterType !== 'all' || filterCategory !== 'all' || searchQuery) && (
          <p>{t('expenses.filtered')}</p>
        )}
      </div>

      {/* Expense Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingExpense ? t('expenses.editTitle') : t('expenses.addTitle')}
          size="md"
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? t('common.saving') : t('common.save')}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Select
              label={t('expenses.form.type')}
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as 'income' | 'expense' })}
              options={[
                { value: 'expense', label: t('expenses.typeExpense') },
                { value: 'income', label: t('expenses.typeIncome') },
              ]}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label={t('expenses.form.date')}
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
              <Input
                label={t('expenses.form.amount')}
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder={t('expenses.form.amountPlaceholder')}
                required
                min="0"
              />
            </div>

            <Select
              label={t('expenses.form.category')}
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              required
            />

            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('expenses.form.description')}</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={t('expenses.form.descriptionPlaceholder')}
              />
            </div>

            {/* 分攤功能 */}
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('expenses.form.splitWithResidents')}
              </label>
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, splitMethod: 'none', sharedBy: [] })}
                  className={`px-3 py-1 text-xs border rounded ${
                    formData.splitMethod === 'none' ? 'bg-blue-100 border-blue-500 text-blue-700' : 'border-gray-300'
                  }`}
                >
                  {t('expenses.form.splitNone')}
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({
                    ...formData,
                    splitMethod: 'equal',
                    sharedBy: formData.sharedBy.length > 0 ? formData.sharedBy : residents.slice(0, 2).map((r) => r.id),
                  })}
                  className={`px-3 py-1 text-xs border rounded ${
                    formData.splitMethod === 'equal' ? 'bg-blue-100 border-blue-500 text-blue-700' : 'border-gray-300'
                  }`}
                >
                  {t('expenses.form.splitEqual')}
                </button>
              </div>

              {formData.splitMethod === 'equal' && formData.sharedBy.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-gray-500 mb-2">
                    {t('expenses.form.splitAmount')}
                    <span className="font-bold text-blue-600 ml-1">
                      ${(Number(formData.amount) / formData.sharedBy.length).toFixed(0)}
                    </span>
                    {t('expenses.form.splitPeople', { count: formData.sharedBy.length })}
                  </div>
                  <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
                    {residents.map((r) => (
                      <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-2 py-1 rounded">
                        <input
                          type="checkbox"
                          checked={formData.sharedBy.includes(r.id)}
                          onChange={(e) => {
                            const newSharedBy = e.target.checked
                              ? [...formData.sharedBy, r.id]
                              : formData.sharedBy.filter((id) => id !== r.id);
                            setFormData({ ...formData, sharedBy: newSharedBy });
                          }}
                          className="w-4 h-4"
                        />
                        <span>{r.name || r.ownerName} - {r.floor}{r.unitNumber}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </form>
        </Modal>
      )}

      {/* Category Modal */}
      {isCategoryModalOpen && (
        <Modal
          isOpen={isCategoryModalOpen}
          onClose={() => setIsCategoryModalOpen(false)}
          title={t('expenses.categoryModal.title')}
          size="sm"
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setIsCategoryModalOpen(false)} disabled={isSubmitting}>
                {t('common.close')}
              </Button>
              <Button onClick={handleCategorySubmit} disabled={isSubmitting}>
                {isSubmitting ? t('common.adding') : t('common.add')}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleCategorySubmit} className="space-y-4">
            <Input
              label={t('expenses.categoryModal.name')}
              value={categoryForm.name}
              onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
              placeholder={t('expenses.categoryModal.namePlaceholder')}
              required
            />

            <Select
              label={t('expenses.categoryModal.type')}
              value={categoryForm.type}
              onChange={(e) => setCategoryForm({ ...categoryForm, type: e.target.value as 'income' | 'expense' })}
              options={[
                { value: 'expense', label: t('expenses.typeExpense') },
                { value: 'income', label: t('expenses.typeIncome') },
              ]}
            />

            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('expenses.categoryModal.color')}</label>
              <input
                type="color"
                value={categoryForm.color}
                onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer"
              />
            </div>
          </form>
        </Modal>
      )}
        </>
      )}
    </div>
  );
}
