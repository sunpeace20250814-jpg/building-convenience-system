/**
 * 會計期間 (Accounting Periods)
 *
 * M-61 修復 (2026-07-01): 從 StubPage → 真實 UI
 * - 用 accountingApi.listPeriods / createPeriod / closePeriod
 * - 期間建立 + 結帳 (close period)
 * - 結帳後不可再修改,確保會計期間完整性
 */

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CalendarRange, Plus, Lock, CheckCircle2, X } from 'lucide-react';
import { accountingApi, type AccountingPeriodDTO } from '@/api/accounting';

export function AccountingPeriods() {
  const [periods, setPeriods] = useState<AccountingPeriodDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    periodCode: '',
    startDate: '',
    endDate: '',
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await accountingApi.listPeriods();
      setPeriods(list);
    } catch (err: any) {
      setError(err.message ?? '載入失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    setForm({
      periodCode: `${yyyy}-${mm}`,
      startDate: `${yyyy}-${mm}-01`,
      endDate: new Date(yyyy, today.getMonth() + 1, 0).toISOString().split('T')[0],
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.periodCode.trim() || !form.startDate || !form.endDate) {
      setError('代碼 / 開始 / 結束日期皆為必填');
      return;
    }
    if (form.startDate >= form.endDate) {
      setError('結束日期必須晚於開始日期');
      return;
    }
    setSaving(true);
    try {
      await accountingApi.createPeriod({
        periodCode: form.periodCode.trim(),
        startDate: form.startDate,
        endDate: form.endDate,
      });
      setShowForm(false);
      await load();
    } catch (err: any) {
      setError(err.message ?? '建立失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async (p: AccountingPeriodDTO) => {
    if (!confirm(`確定結帳「${p.periodCode}」?結帳後無法再修改此期間的分錄`)) return;
    setError(null);
    try {
      await accountingApi.closePeriod(p.id);
      await load();
    } catch (err: any) {
      setError(err.message ?? '結帳失敗');
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarRange className="w-6 h-6 text-indigo-600" />
            會計期間
          </h1>
          <p className="text-sm text-gray-500 mt-1">管理月度 / 季度 / 年度會計期間,結帳後不可修改</p>
        </div>
        <Button variant="primary" size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" />
          新增期間
        </Button>
      </div>

      <Card padding="md" className="mb-4">
        {error && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded">{error}</div>
        )}
        {loading ? (
          <div className="text-center py-8 text-gray-500">載入中...</div>
        ) : periods.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <CalendarRange className="w-12 h-12 mx-auto mb-2" />
            <p>尚無會計期間</p>
            <p className="text-xs mt-1">點擊「新增期間」建立第一個會計期間</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="py-2 pr-3">代碼</th>
                <th className="py-2 pr-3">開始日期</th>
                <th className="py-2 pr-3">結束日期</th>
                <th className="py-2 pr-3">狀態</th>
                <th className="py-2 pr-3">結帳時間</th>
                <th className="py-2 pr-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 pr-3 font-mono">{p.periodCode}</td>
                  <td className="py-2 pr-3">{p.startDate}</td>
                  <td className="py-2 pr-3">{p.endDate}</td>
                  <td className="py-2 pr-3">
                    {p.isClosed ? (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-700 inline-flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        已結帳
                      </span>
                    ) : (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        開放中
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-xs text-gray-500">
                    {p.closedAt ? new Date(p.closedAt).toLocaleString('zh-TW') : '—'}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {!p.isClosed && (
                      <Button variant="ghost" size="sm" onClick={() => handleClose(p)}>
                        <Lock className="w-3.5 h-3.5 mr-1" />
                        結帳
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* 新增期間 modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <Card padding="lg" className="w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">新增會計期間</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">代碼 *</label>
                <input
                  type="text"
                  value={form.periodCode}
                  onChange={(e) => setForm({ ...form, periodCode: e.target.value })}
                  placeholder="例如 2026-Q1 / 2026-07"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">開始日期 *</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">結束日期 *</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" type="button" onClick={() => setShowForm(false)}>
                  取消
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={saving}>
                  {saving ? '建立中...' : '建立'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}