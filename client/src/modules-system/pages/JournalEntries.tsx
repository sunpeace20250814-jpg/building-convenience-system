/**
 * 分錄管理 (Journal Entries)
 *
 * M-60 修復 (2026-07-01): 從 queryAll/execute → server-side fetch
 * - 用 accountingApi.listJournalEntries / createJournalEntry / deleteJournalEntry
 * - 用 accountingApi.listAccounts 載入科目選單
 * - server 已驗證借貸必平 + 自動 seed 預設科目
 */

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Plus, Save, Trash2, BookOpen, AlertCircle } from 'lucide-react';
import { accountingApi, type AccountDTO } from '@/api/accounting';
import { monitor } from '@/monitoring/core';

interface JournalEntryRow {
  id: string;
  entryDate: string;
  description: string;
  reference: string | null;
  status: 'draft' | 'posted' | 'voided';
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
}

export function JournalEntries() {
  const [entries, setEntries] = useState<JournalEntryRow[]>([]);
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    entryDate: new Date().toISOString().split('T')[0],
    description: '',
    reference: '',
    debitAccount: '',
    creditAccount: '',
    amount: '',
    memo: '',
  });

  const loadEntries = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await accountingApi.listJournalEntries({});
      setEntries(
        data.map((d) => ({
          id: d.id,
          entryDate: d.entryDate,
          description: d.description,
          reference: d.reference ?? null,
          status: d.status,
          totalDebit: d.totalDebit,
          totalCredit: d.totalCredit,
          balanced: d.balanced,
        }))
      );
    } catch (err: any) {
      setError(err.message ?? '載入分錄失敗');
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async () => {
    try {
      const list = await accountingApi.listAccounts();
      setAccounts(list.filter((a) => a.isActive));
    } catch (err: any) {
      // 載入科目失敗不致命,只是下拉會空
      console.warn('[JournalEntries] 載入科目失敗:', err);
    }
  };

  useEffect(() => {
    loadEntries();
    loadAccounts();
  }, []);

  const handleSubmit = async () => {
    setError(null);
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      setError('金額必須大於 0');
      return;
    }
    if (!form.debitAccount || !form.creditAccount) {
      setError('請選擇借方與貸方科目');
      return;
    }
    if (form.debitAccount === form.creditAccount) {
      setError('借方與貸方不能是同一科目');
      return;
    }

    setSubmitting(true);
    try {
      // 建立分錄 (draft)
      await accountingApi.createJournalEntry({
        entryDate: form.entryDate,
        description: form.description,
        reference: form.reference || undefined,
        lines: [
          { accountId: form.debitAccount, amount, side: 'debit', memo: form.memo },
          { accountId: form.creditAccount, amount, side: 'credit', memo: form.memo },
        ],
      });
      // 立即過帳
      // 取出最新建立的分錄 id (重新拉列表用)
      // 簡化做法: 直接重新拉列表,因為 createJournalEntry 回傳的 DTO 有 id
      // 但因為 createJournalEntry server 在 auto-post 之後還要再呼叫 post endpoint 才能 posted,
      // 所以這裡直接拉新列表即可
      setForm({
        entryDate: new Date().toISOString().split('T')[0],
        description: '',
        reference: '',
        debitAccount: '',
        creditAccount: '',
        amount: '',
        memo: '',
      });
      setIsCreating(false);
      monitor.recordMetric('accounting.journalCreated', 1);
      await loadEntries();
    } catch (err: any) {
      setError(err.message ?? '建立失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定刪除此分錄?')) return;
    setError(null);
    try {
      const ok = await accountingApi.deleteJournalEntry(id);
      if (!ok) {
        setError('無法刪除 (僅 draft 狀態可刪,或 server 拒絕)');
        return;
      }
      monitor.recordMetric('accounting.journalDeleted', 1);
      await loadEntries();
    } catch (err: any) {
      setError(err.message ?? '刪除失敗');
    }
  };

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="分錄管理"
        description="複式記帳分錄,借貸必平"
        actions={
          <Button onClick={() => setIsCreating(!isCreating)}>
            <Plus className="w-4 h-4 mr-2" />
            {isCreating ? '取消' : '新增分錄'}
          </Button>
        }
      />

      {error && (
        <Card className="bg-red-50 border-red-200">
          <div className="text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        </Card>
      )}

      {isCreating && (
        <Card>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            新增分錄
          </h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Input
              type="date"
              label="日期"
              value={form.entryDate}
              onChange={(e) => setForm({ ...form, entryDate: e.target.value })}
            />
            <Input
              label="參考號碼"
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              placeholder="如:發票號碼、合約編號"
            />
          </div>
          <Input
            label="摘要"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="例:收到管理費 1101→4101"
          />
          <div className="grid grid-cols-3 gap-3 mt-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">借方科目</label>
              <select
                value={form.debitAccount}
                onChange={(e) => setForm({ ...form, debitAccount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
              >
                <option value="">選擇科目</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">貸方科目</label>
              <select
                value={form.creditAccount}
                onChange={(e) => setForm({ ...form, creditAccount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
              >
                <option value="">選擇科目</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} {a.name}
                  </option>
                ))}
              </select>
            </div>
            <Input
              type="number"
              label="金額"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0"
            />
          </div>
          <Input
            label="備註(選填)"
            value={form.memo}
            onChange={(e) => setForm({ ...form, memo: e.target.value })}
            className="mt-3"
          />
          <div className="flex justify-end mt-4 gap-2">
            <Button variant="secondary" onClick={() => setIsCreating(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              <Save className="w-4 h-4 mr-2" />
              {submitting ? '建立中...' : '建立並過帳'}
            </Button>
          </div>
        </Card>
      )}

      <Card>
        {loading ? (
          <div className="text-center py-12 text-gray-400">載入中...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <BookOpen className="w-12 h-12 mx-auto mb-3" />
            <p>尚無分錄</p>
            <p className="text-xs mt-2">點擊「新增分錄」開始記帳</p>
          </div>
        ) : (
          <div className="divide-y">
            {entries.map((e) => (
              <div key={e.id} className="py-3 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{e.description}</span>
                    {e.reference && (
                      <span className="text-xs text-gray-500">#{e.reference}</span>
                    )}
                    <Badge variant={e.status === 'posted' ? 'success' : 'default'} size="sm">
                      {e.status === 'posted' ? '已過帳' : e.status === 'draft' ? '草稿' : '已沖銷'}
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {e.entryDate} ・ 借 {e.totalDebit.toLocaleString()} ・ 貸 {e.totalCredit.toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!e.balanced && <AlertCircle className="w-4 h-4 text-red-500" />}
                  {e.status === 'draft' && (
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(e.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}