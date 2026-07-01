/**
 * Training Records - 員工培訓記錄
 * V1 培訓日/TrainingDay 功能
 *
 * V4 改寫：原本用 queryAll/execute 讀 sql.js；改用 useTraining / useEmployees hook。
 */

import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { useTraining, type TrainingRecordDTO } from '@/hooks/useTraining';
import { useEmployees } from '@/hooks/useEmployees';
import { Plus, Trash2, GraduationCap, Calendar, User } from 'lucide-react';

export function TrainingPanel() {
  const { records, create, update, remove } = useTraining(true);
  const { employees } = useEmployees(true, true); // includeInactive — 培訓可能是歷史員工

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TrainingRecordDTO | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    employeeId: '',
    date: new Date().toISOString().split('T')[0],
    content: '',
    notes: '',
  });

  const open = (rec?: TrainingRecordDTO) => {
    if (rec) {
      setEditing(rec);
      setForm({
        employeeId: rec.employeeId,
        date: rec.date,
        content: rec.content,
        notes: rec.notes || '',
      });
    } else {
      setEditing(null);
      setForm({
        employeeId: employees[0]?.id || '',
        date: new Date().toISOString().split('T')[0],
        content: '',
        notes: '',
      });
    }
    setModalOpen(true);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        employeeId: form.employeeId,
        date: form.date,
        content: form.content,
        notes: form.notes || null,
      };
      if (editing) {
        await update(editing.id, payload);
      } else {
        await create(payload);
      }
      setModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = (id: string) => {
    if (confirm('刪除此筆培訓記錄？')) {
      void remove(id);
    }
  };

  // 統計：每位員工的培訓天數
  const stats = employees.map((emp) => {
    const empRecs = records.filter((r) => r.employeeId === emp.id);
    return {
      employee: emp,
      count: empRecs.length,
      latest: empRecs[0]?.date,
    };
  }).sort((a, b) => b.count - a.count);

  return (
    <div className="p-6">
      <PageHeader
        title="員工培訓"
        description="記錄員工培訓日期、內容、備註"
        actions={
          <Button onClick={() => open()} disabled={employees.length === 0}>
            <Plus className="w-4 h-4 mr-2" />新增培訓
          </Button>
        }
      />

      {employees.length === 0 ? (
        <Card className="text-center py-12 text-gray-400">
          <GraduationCap className="w-12 h-12 mx-auto mb-3" />
          <p>請先到班表模組新增員工，才能記錄培訓</p>
        </Card>
      ) : (
        <>
          {/* 員工統計 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {stats.slice(0, 8).map(({ employee, count, latest }) => (
              <Card key={employee.id} className="text-center">
                <User className="w-6 h-6 mx-auto text-blue-500 mb-1" />
                <p className="text-sm font-medium">{employee.name}</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{count}</p>
                <p className="text-xs text-gray-500">次培訓</p>
                {latest && (
                  <p className="text-xs text-gray-400 mt-1">{latest}</p>
                )}
              </Card>
            ))}
          </div>

          {/* 記錄列表 */}
          <Card padding="none">
            {records.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Calendar className="w-12 h-12 mb-3" />
                <p>尚無培訓記錄</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">日期</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">員工</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">內容</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">備註</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {records.map((r) => {
                    const emp = employees.find((e) => e.id === r.employeeId);
                    return (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-700">{r.date}</td>
                        <td className="px-4 py-3">
                          <Badge variant="info" size="sm">{emp?.name || '-'}</Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-900">{r.content}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{r.notes || '-'}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => open(r)}>編輯</Button>
                            <Button size="sm" variant="danger" onClick={() => handleRemove(r.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}

      {modalOpen && (
        <Modal
          isOpen
          onClose={() => setModalOpen(false)}
          title={editing ? '編輯培訓' : '新增培訓'}
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>取消</Button>
              <Button onClick={submit} disabled={submitting || !form.content}>
                {submitting ? '儲存中...' : '儲存'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">員工</label>
              <select
                value={form.employeeId}
                onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              >
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
            <Input
              label="培訓日期"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">內容</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 消防安全訓練、急救培訓..."
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
