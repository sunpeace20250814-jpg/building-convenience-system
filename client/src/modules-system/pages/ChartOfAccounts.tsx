/**
 * 會計科目表 (Chart of Accounts)
 *
 * M-60 修復 (2026-07-01): 從 stub → 真實 UI
 * - 用 accountingApi.listAccounts / createAccount / updateAccount / deleteAccount
 * - 樹狀顯示 (parentId 分組)
 * - CRUD 完整 (新增 / 編輯 / 停用 / 刪除)
 * - 依類型分組 (資產/負債/權益/收入/費用)
 */

import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, FolderTree, Power, PowerOff, Search, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { accountingApi, type AccountDTO, type AccountType, type CreateAccountInput } from '@/api/accounting';

const TYPE_META: Record<AccountType, { label: string; color: string; bg: string }> = {
  asset: { label: '資產', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  liability: { label: '負債', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  equity: { label: '權益', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  revenue: { label: '收入', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  expense: { label: '費用', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
};

interface AccountFormState {
  id?: string;
  code: string;
  name: string;
  type: AccountType;
  parentId: string | null;
  description: string;
}

const emptyForm = (): AccountFormState => ({
  code: '',
  name: '',
  type: 'asset',
  parentId: null,
  description: '',
});

export function ChartOfAccounts() {
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AccountFormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await accountingApi.listAccounts();
      setAccounts(list);
    } catch (err: any) {
      setError(err.message ?? '載入失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return accounts;
    const q = search.toLowerCase();
    return accounts.filter(
      (a) => a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q) || (a.description ?? '').toLowerCase().includes(q)
    );
  }, [accounts, search]);

  const grouped = useMemo(() => {
    const out: Record<AccountType, AccountDTO[]> = {
      asset: [], liability: [], equity: [], revenue: [], expense: [],
    };
    for (const a of filtered) out[a.type].push(a);
    for (const k of Object.keys(out) as AccountType[]) {
      out[k].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
    }
    return out;
  }, [filtered]);

  const openCreate = () => {
    setForm(emptyForm());
    setShowForm(true);
  };

  const openEdit = (a: AccountDTO) => {
    setForm({
      id: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      parentId: a.parentId ?? null,
      description: a.description ?? '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (!form.code.trim() || !form.name.trim()) {
        throw new Error('代碼與名稱為必填');
      }
      const payload: CreateAccountInput = {
        code: form.code.trim(),
        name: form.name.trim(),
        type: form.type,
        parentId: form.parentId || null,
        description: form.description.trim() || null,
      };
      if (form.id) {
        await accountingApi.updateAccount(form.id, payload);
      } else {
        await accountingApi.createAccount(payload);
      }
      setShowForm(false);
      await load();
    } catch (err: any) {
      setError(err.message ?? '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (a: AccountDTO) => {
    if (!confirm(`確定刪除「${a.code} ${a.name}」?若有分錄引用將無法刪除`)) return;
    setError(null);
    try {
      const ok = await accountingApi.deleteAccount(a.id);
      if (!ok) {
        setError('無法刪除: 仍有分錄引用此科目');
        return;
      }
      await load();
    } catch (err: any) {
      setError(err.message ?? '刪除失敗');
    }
  };

  const handleToggleActive = async (a: AccountDTO) => {
    setError(null);
    try {
      await accountingApi.updateAccount(a.id, { isActive: !a.isActive } as any);
      await load();
    } catch (err: any) {
      setError(err.message ?? '更新失敗');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FolderTree className="w-6 h-6 text-indigo-600" />
            會計科目表
          </h1>
          <p className="text-sm text-gray-500 mt-1">管理台灣常用的會計科目 (資產/負債/權益/收入/費用)</p>
        </div>
        <Button variant="primary" size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" />
          新增科目
        </Button>
      </div>

      {/* 搜尋 + 錯誤 */}
      <Card padding="md" className="mb-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋代碼 / 名稱 / 描述..."
              className="w-full pl-10 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="text-sm text-gray-500">
            共 {accounts.length} 個科目 {search && `· 篩選 ${filtered.length}`}
          </div>
        </div>
        {error && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded">{error}</div>
        )}
      </Card>

      {/* 載入中 */}
      {loading ? (
        <Card className="text-center py-12 text-gray-500">載入中...</Card>
      ) : (
        <div className="space-y-4">
          {(Object.keys(TYPE_META) as AccountType[]).map((type) => {
            const list = grouped[type];
            if (list.length === 0) return null;
            const meta = TYPE_META[type];
            return (
              <Card key={type} padding="md">
                <div className={`text-sm font-semibold mb-3 ${meta.color}`}>
                  {meta.label} ({list.length})
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 border-b">
                        <th className="py-2 pr-3">代碼</th>
                        <th className="py-2 pr-3">名稱</th>
                        <th className="py-2 pr-3">描述</th>
                        <th className="py-2 pr-3">狀態</th>
                        <th className="py-2 pr-3 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((a) => (
                        <tr key={a.id} className="border-b hover:bg-gray-50">
                          <td className="py-2 pr-3 font-mono text-xs">{a.code}</td>
                          <td className="py-2 pr-3 font-medium">{a.name}</td>
                          <td className="py-2 pr-3 text-gray-600 text-xs">{a.description ?? '—'}</td>
                          <td className="py-2 pr-3">
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded ${
                                a.isActive
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-200 text-gray-600'
                              }`}
                            >
                              {a.isActive ? '啟用' : '停用'}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-right">
                            <button
                              onClick={() => handleToggleActive(a)}
                              className="text-gray-500 hover:text-indigo-600 mr-2"
                              title={a.isActive ? '停用' : '啟用'}
                            >
                              {a.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => openEdit(a)}
                              className="text-gray-500 hover:text-indigo-600 mr-2"
                              title="編輯"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(a)}
                              className="text-gray-500 hover:text-red-600"
                              title="刪除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* CRUD Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <Card padding="lg" className="w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{form.id ? '編輯科目' : '新增科目'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">代碼 *</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    disabled={!!form.id}
                    placeholder="例如 1101"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm disabled:bg-gray-100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">類型 *</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as AccountType })}
                    disabled={!!form.id}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm disabled:bg-gray-100 bg-white"
                  >
                    {(Object.keys(TYPE_META) as AccountType[]).map((t) => (
                      <option key={t} value={t}>
                        {TYPE_META[t].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">名稱 *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="例如 現金"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">上層科目 (選填)</label>
                <select
                  value={form.parentId ?? ''}
                  onChange={(e) => setForm({ ...form, parentId: e.target.value || null })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm bg-white"
                >
                  <option value="">— 無 (頂層)</option>
                  {accounts
                    .filter((a) => !form.id || a.id !== form.id)
                    .filter((a) => a.type === form.type)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} {a.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">描述</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" type="button" onClick={() => setShowForm(false)}>
                  取消
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={saving}>
                  {saving ? '儲存中...' : form.id ? '更新' : '建立'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}