/**
 * 公設管理 Tab — FacilityBooking → Tabs[3]（新）
 *
 * 搬自 client/src/modules/settings/FacilitySettings.tsx
 * 用於管理「公設」（facility）資料，搭配公設借用的 Calendar / List / Manage Tab。
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { useSettingsStore, useV1Store } from '@/stores';
import { Plus, Trash2, Dumbbell } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'normal', label: '正常', color: 'bg-green-100 text-green-700' },
  { value: 'maintenance', label: '維護中', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'broken', label: '故障', color: 'bg-red-100 text-red-700' },
];

export function FacilityManagementTab() {
  const { buildings } = useSettingsStore();
  const { facilities, loadFacilities, createFacility, updateFacility, deleteFacility } = useV1Store();
  const [buildingId, setBuildingId] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    fee: '0',
    unit: '月',
    location: '',
    status: 'normal',
    notes: '',
  });

  useEffect(() => {
    if (buildings.length && !buildingId) setBuildingId(buildings[0].id);
  }, [buildings]);

  useEffect(() => {
    if (buildingId) loadFacilities(buildingId);
  }, [buildingId]);

  const open = (f?: any) => {
    if (f) {
      setEditing(f);
      setForm({
        name: f.name, fee: String(f.fee ?? 0), unit: f.unit || '月',
        location: f.location || '', status: f.status || 'normal', notes: f.notes || '',
      });
    } else {
      setEditing(null);
      setForm({ name: '', fee: '0', unit: '月', location: '', status: 'normal', notes: '' });
    }
    setModalOpen(true);
  };

  const submit = () => {
    setSubmitting(true);
    try {
      const payload = {
        buildingId,
        name: form.name,
        fee: Number(form.fee) || 0,
        unit: form.unit,
        location: form.location,
        status: form.status,
        notes: form.notes,
      };
      if (editing) updateFacility(editing.id, payload);
      else createFacility(payload);
      setModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const remove = (f: any) => {
    if (confirm(`刪除公設「${f.name}」？`)) deleteFacility(f.id);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">公設管理</h3>
        <div className="flex items-center gap-3">
          <Select value={buildingId} onChange={(e) => setBuildingId(e.target.value)} options={buildings.map((b) => ({ value: b.id, label: b.name }))} className="w-40" />
          <Button onClick={() => open()} disabled={!buildingId}>
            <Plus className="w-4 h-4 mr-2" />新增公設
          </Button>
        </div>
      </div>

      {facilities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <Dumbbell className="w-12 h-12 mb-3" />
          <p className="text-lg font-medium">尚無公設資料</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">名稱</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">費用</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">位置</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">狀態</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">備註</th>
                <th className="px-4 py-3 text-right font-medium font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {facilities.map((f) => {
                const status = STATUS_OPTIONS.find((s) => s.value === f.status);
                return (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{f.name}</td>
                    <td className="px-4 py-3 text-right text-gray-700">${f.fee ?? 0} / {f.unit}</td>
                    <td className="px-4 py-3 text-gray-600">{f.location || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs ${status?.color}`}>
                        {status?.label || f.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{f.notes || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => open(f)}>編輯</Button>
                        <Button size="sm" variant="danger" onClick={() => remove(f)}>
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

      {modalOpen && (
        <Modal
          isOpen onClose={() => setModalOpen(false)}
          title={editing ? '編輯公設' : '新增公設'}
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>取消</Button>
              <Button onClick={submit} disabled={submitting || !form.name}>{submitting ? '儲存中...' : '儲存'}</Button>
            </div>
          }
        >
          <div className="space-y-4">
            <Input label="公設名稱" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., 健身房、游泳池" required />
            <div className="grid grid-cols-2 gap-3">
              <Input label="費用" type="number" value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} />
              <Select label="計費單位" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
                options={[{ value: '月', label: '月' }, { value: '次', label: '次' }, { value: '年', label: '年' }]} />
            </div>
            <Input label="位置" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g., 1F、頂樓" />
            <Select label="狀態" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}