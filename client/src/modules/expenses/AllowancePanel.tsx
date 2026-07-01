/**
 * Allowance Panel - 零用金管理
 * V1 邏輯：每位持有人有獨立餘額，可加碼/扣款，記錄所有交易
 */

import { useEffect, useState } from 'react';
import { useExpenseStore } from '@/stores';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Card } from '@/components/ui/Card';
import { Plus, Trash2, ArrowUpRight, ArrowDownRight, Wallet, Users } from 'lucide-react';

export function AllowancePanel() {
  const {
    allowanceHolders, allowanceRecords,
    loadAllowanceHolders, createAllowanceHolder, updateAllowanceHolder, deleteAllowanceHolder,
    loadAllowanceRecords, addAllowanceRecord,
  } = useExpenseStore();

  const [selected, setSelected] = useState<string | null>(null);
  const [holderModalOpen, setHolderModalOpen] = useState(false);
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [editingHolder, setEditingHolder] = useState<any | null>(null);
  const [holderForm, setHolderForm] = useState({ name: '', balance: '0', notes: '' });
  const [recordForm, setRecordForm] = useState({
    type: 'add' as 'add' | 'deduct',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadAllowanceHolders();
  }, []);

  useEffect(() => {
    if (selected) loadAllowanceRecords(selected);
  }, [selected]);

  const openHolder = (h?: any) => {
    if (h) {
      setEditingHolder(h);
      setHolderForm({ name: h.name, balance: String(h.balance), notes: h.notes || '' });
    } else {
      setEditingHolder(null);
      setHolderForm({ name: '', balance: '0', notes: '' });
    }
    setHolderModalOpen(true);
  };

  const submitHolder = () => {
    setSubmitting(true);
    try {
      if (editingHolder) {
        updateAllowanceHolder(editingHolder.id, {
          name: holderForm.name,
          balance: Number(holderForm.balance) || 0,
          notes: holderForm.notes,
        });
      } else {
        createAllowanceHolder({
          name: holderForm.name,
          balance: Number(holderForm.balance) || 0,
          notes: holderForm.notes,
        });
      }
      setHolderModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const submitRecord = () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      addAllowanceRecord(selected, {
        type: recordForm.type,
        amount: Number(recordForm.amount) || 0,
        date: recordForm.date,
        notes: recordForm.notes,
      });
      setRecordModalOpen(false);
      setRecordForm({ ...recordForm, amount: '', notes: '' });
    } finally {
      setSubmitting(false);
    }
  };

  const totalBalance = allowanceHolders.reduce((sum, h) => sum + (h.balance || 0), 0);
  const currentRecords = selected ? (allowanceRecords[selected] || []) : [];
  const currentHolder = allowanceHolders.find((h) => h.id === selected);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 左：持有人列表 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-gray-900 flex items-center gap-2">
            <Users className="w-4 h-4" />零用金持有人
          </h3>
          <Button size="sm" onClick={() => openHolder()}>
            <Plus className="w-3.5 h-3.5 mr-1" />新增
          </Button>
        </div>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 mb-3">
          <p className="text-sm text-blue-700">總餘額</p>
          <p className="text-2xl font-bold text-blue-800">${totalBalance.toLocaleString()}</p>
        </Card>

        <div className="space-y-2">
          {allowanceHolders.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">尚無持有人</p>
          ) : (
            allowanceHolders.map((h) => (
              <div
                key={h.id}
                onClick={() => setSelected(h.id)}
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                  selected === h.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{h.name}</p>
                    <p className={`text-lg font-bold ${(h.balance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${(h.balance || 0).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); if (confirm(`刪除持有人「${h.name}」？`)) deleteAllowanceHolder(h.id); }}
                    className="text-red-500 opacity-50 hover:opacity-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 右：交易明細 */}
      <div className="lg:col-span-2">
        {!selected ? (
          <Card className="text-center py-12 text-gray-400">
            <Wallet className="w-12 h-12 mx-auto mb-3" />
            <p>選擇左側持有人查看交易明細</p>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900">
                {currentHolder?.name} - 交易明細
              </h3>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => openHolder(currentHolder)}>編輯持有人</Button>
                <Button size="sm" onClick={() => setRecordModalOpen(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" />記一筆
                </Button>
              </div>
            </div>

            <Card padding="none">
              {currentRecords.length === 0 ? (
                <p className="text-center py-8 text-gray-400">尚無交易記錄</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">日期</th>
                      <th className="px-4 py-2 text-center font-medium text-gray-500">類型</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">金額</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">餘額</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">備註</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {currentRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-700">{r.date}</td>
                        <td className="px-4 py-2 text-center">
                          {r.type === 'add' ? (
                            <span className="text-green-600 flex items-center justify-center gap-1">
                              <ArrowUpRight className="w-3.5 h-3.5" />加碼
                            </span>
                          ) : (
                            <span className="text-red-600 flex items-center justify-center gap-1">
                              <ArrowDownRight className="w-3.5 h-3.5" />支出
                            </span>
                          )}
                        </td>
                        <td className={`px-4 py-2 text-right font-medium ${r.type === 'add' ? 'text-green-600' : 'text-red-600'}`}>
                          {r.type === 'add' ? '+' : '-'}${r.amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-gray-900">
                          ${r.balanceAfter.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-gray-600">{r.description || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </>
        )}
      </div>

      {/* Holder Modal */}
      {holderModalOpen && (
        <Modal
          isOpen onClose={() => setHolderModalOpen(false)}
          title={editingHolder ? '編輯持有人' : '新增持有人'}
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setHolderModalOpen(false)}>取消</Button>
              <Button onClick={submitHolder} disabled={submitting || !holderForm.name}>
                {submitting ? '儲存中...' : '儲存'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <Input label="姓名" value={holderForm.name} onChange={(e) => setHolderForm({ ...holderForm, name: e.target.value })} required />
            <Input label="初始餘額" type="number" value={holderForm.balance} onChange={(e) => setHolderForm({ ...holderForm, balance: e.target.value })} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
              <textarea value={holderForm.notes} onChange={(e) => setHolderForm({ ...holderForm, notes: e.target.value })} rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </Modal>
      )}

      {/* Record Modal */}
      {recordModalOpen && (
        <Modal
          isOpen onClose={() => setRecordModalOpen(false)}
          title="新增交易"
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setRecordModalOpen(false)}>取消</Button>
              <Button onClick={submitRecord} disabled={submitting || !recordForm.amount}>
                {submitting ? '儲存中...' : '儲存'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">類型</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setRecordForm({ ...recordForm, type: 'add' })}
                  className={`flex-1 px-3 py-2 border rounded-lg ${recordForm.type === 'add' ? 'bg-green-100 border-green-500 text-green-700' : 'border-gray-300'}`}
                >
                  <ArrowUpRight className="w-4 h-4 inline mr-1" />加碼
                </button>
                <button
                  onClick={() => setRecordForm({ ...recordForm, type: 'deduct' })}
                  className={`flex-1 px-3 py-2 border rounded-lg ${recordForm.type === 'deduct' ? 'bg-red-100 border-red-500 text-red-700' : 'border-gray-300'}`}
                >
                  <ArrowDownRight className="w-4 h-4 inline mr-1" />支出
                </button>
              </div>
            </div>
            <Input label="日期" type="date" value={recordForm.date} onChange={(e) => setRecordForm({ ...recordForm, date: e.target.value })} />
            <Input label="金額" type="number" value={recordForm.amount} onChange={(e) => setRecordForm({ ...recordForm, amount: e.target.value })} required />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
              <textarea value={recordForm.notes} onChange={(e) => setRecordForm({ ...recordForm, notes: e.target.value })} rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}