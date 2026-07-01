import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Plus, Save, Trash2, BookOpen, AlertCircle } from 'lucide-react';
import { queryAll, execute, transaction } from '@/storage/database';
import { createJournalEntry } from '@/modules-system/modules/double-entry';
import { monitor } from '@/monitoring/core';

interface JournalEntry {
  id: string;
  entry_date: string;
  description: string;
  reference: string | null;
  status: string;
  total_debit: number;
  total_credit: number;
}

export function JournalEntries() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({
    entryDate: new Date().toISOString().split('T')[0],
    description: '',
    reference: '',
    debitAccount: '',
    creditAccount: '',
    amount: '',
    memo: '',
  });

  useEffect(() => {
    loadEntries();
  }, []);

  function loadEntries() {
    const rows = queryAll<any>(
      `SELECT je.id, je.entry_date, je.description, je.reference, je.status,
              COALESCE(SUM(jl.debit), 0) as total_debit,
              COALESCE(SUM(jl.credit), 0) as total_credit
       FROM journal_entries je
       LEFT JOIN journal_lines jl ON jl.entry_id = je.id
       GROUP BY je.id
       ORDER BY je.entry_date DESC, je.created_at DESC
       LIMIT 200`
    );
    setEntries(rows);
  }

  function handleSubmit() {
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      alert('金額必須大於 0');
      return;
    }
    if (!form.debitAccount || !form.creditAccount) {
      alert('請選擇借方與貸方科目')
      return;
    }
    if (form.debitAccount === form.creditAccount) {
      alert('借方與貸方不能是同一科目')
      return;
    }

    try {
      createJournalEntry({
        entryDate: form.entryDate,
        description: form.description,
        reference: form.reference || undefined,
        lines: [
          { accountId: form.debitAccount, debit: amount, memo: form.memo },
          { accountId: form.creditAccount, credit: amount, memo: form.memo },
        ],
        autoPost: true,
      });
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
      loadEntries();
    } catch (err: any) {
      alert('建立失敗：' + err.message);
    }
  }

  function handleDelete(id: string) {
    if (!confirm('確定刪除此分錄？')) return;
    transaction(() => {
      execute('DELETE FROM journal_lines WHERE entry_id = ?', [id]);
      execute('DELETE FROM journal_entries WHERE id = ?', [id]);
    });
    monitor.recordMetric('accounting.journalDeleted', 1);
    loadEntries();
  }

  // 載入所有會計科目供選擇
  const accounts = queryAll<any>(
    `SELECT id, code, name, type FROM accounts WHERE is_active = 1 ORDER BY code`
  );

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="分錄管理"
        description="複式記帳分錄，借貸必平"
        actions={
          <Button onClick={() => setIsCreating(!isCreating)}>
            <Plus className="w-4 h-4 mr-2" />
            {isCreating ? '取消' : '新增分錄'}
          </Button>
        }
      />

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
              placeholder="如：發票號碼、合約編號"
            />
          </div>
          <Input
            label="摘要"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="例：收到管理費 1101→4101"
          />
          <div className="grid grid-cols-3 gap-3 mt-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">借方科目</label>
              <select
                value={form.debitAccount}
                onChange={(e) => setForm({ ...form, debitAccount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
            label="備註（選填）"
            value={form.memo}
            onChange={(e) => setForm({ ...form, memo: e.target.value })}
            className="mt-3"
          />
          <div className="flex justify-end mt-4 gap-2">
            <Button variant="secondary" onClick={() => setIsCreating(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit}>
              <Save className="w-4 h-4 mr-2" />
              建立並過帳
            </Button>
          </div>
        </Card>
      )}

      <Card>
        {entries.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <BookOpen className="w-12 h-12 mx-auto mb-3" />
            <p>尚無分錄</p>
            <p className="text-xs mt-2">點擊「新增分錄」開始記帳</p>
          </div>
        ) : (
          <div className="divide-y">
            {entries.map((e) => {
              const balanced = Math.abs(e.total_debit - e.total_credit) < 0.01;
              return (
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
                      {e.entry_date} ・ 借 {e.total_debit.toLocaleString()} ・ 貸 {e.total_credit.toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!balanced && (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(e.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
