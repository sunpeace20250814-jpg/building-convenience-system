/**
 * Floor Settings - V1 樓層細部設定
 * 樓層面積 + 單位面積 → 自動計算房數 (Math.ceil)
 * 樓層顯示名 (B1/1F/RF) + 排序 + 屋突/地下標記
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { useSettingsStore, useV1Store } from '@/stores';
import { Plus, Trash2, Layers, Calculator } from 'lucide-react';

export function FloorSettings() {
  const { buildings } = useSettingsStore();
  const { floors, loadFloors, createFloor, updateFloor, deleteFloor } = useV1Store();
  const [buildingId, setBuildingId] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    floorLabel: '',
    floorIndex: 1,
    floorArea: '',
    unitArea: '',
    isBasement: false,
    isRooftop: false,
    notes: '',
  });

  useEffect(() => {
    if (buildings.length && !buildingId) setBuildingId(buildings[0].id);
  }, [buildings]);

  useEffect(() => {
    if (buildingId) loadFloors(buildingId);
  }, [buildingId]);

  const open = (f?: any) => {
    if (f) {
      setEditing(f);
      setForm({
        floorLabel: f.floorLabel,
        floorIndex: f.floorIndex,
        floorArea: f.floorArea ?? '',
        unitArea: f.unitArea ?? '',
        isBasement: !!f.isBasement,
        isRooftop: !!f.isRooftop,
        notes: f.notes || '',
      });
    } else {
      const nextIdx = floors.length > 0 ? Math.max(...floors.map((f) => f.floorIndex)) + 1 : 1;
      setEditing(null);
      setForm({ floorLabel: '', floorIndex: nextIdx, floorArea: '', unitArea: '', isBasement: false, isRooftop: false, notes: '' });
    }
    setModalOpen(true);
  };

  const submit = () => {
    setSubmitting(true);
    try {
      const payload = {
        buildingId,
        floorLabel: form.floorLabel,
        floorIndex: form.floorIndex,
        floorArea: form.floorArea ? Number(form.floorArea) : null,
        unitArea: form.unitArea ? Number(form.unitArea) : null,
        isBasement: form.isBasement ? 1 : 0,
        isRooftop: form.isRooftop ? 1 : 0,
        notes: form.notes,
      };
      if (editing) updateFloor(editing.id, payload);
      else createFloor(payload);
      setModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const remove = (f: any) => {
    if (confirm(`刪除樓層「${f.floorLabel}」？`)) deleteFloor(f.id);
  };

  const sortedFloors = [...floors].sort((a, b) => a.floorIndex - b.floorIndex);
  const calculatedUnitCount = form.floorArea && form.unitArea
    ? Math.ceil(Number(form.floorArea) / Number(form.unitArea))
    : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">樓層設定</h3>
        <div className="flex items-center gap-3">
          <Select
            value={buildingId}
            onChange={(e) => setBuildingId(e.target.value)}
            options={buildings.map((b) => ({ value: b.id, label: b.name }))}
            className="w-40"
          />
          <Button onClick={() => open()} disabled={!buildingId}>
            <Plus className="w-4 h-4 mr-2" />新增樓層
          </Button>
        </div>
      </div>

      {sortedFloors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <Layers className="w-12 h-12 mb-3" />
          <p className="text-lg font-medium">尚無樓層資料</p>
          <p className="text-sm mt-1">選擇建築後新增樓層，設定面積可自動計算房數</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">顯示名</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">排序</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">樓層面積 (m²)</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">單位面積 (m²)</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">計算房數</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">類型</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">備註</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sortedFloors.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{f.floorLabel}</td>
                  <td className="px-4 py-3 text-gray-600">{f.floorIndex}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{f.floorArea ?? '-'}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{f.unitArea ?? '-'}</td>
                  <td className="px-4 py-3 text-right font-medium text-blue-600">{f.unitCount ?? 0}</td>
                  <td className="px-4 py-3 text-center">
                    {f.isBasement && <span className="px-2 py-0.5 rounded text-xs bg-orange-100 text-orange-700">地下</span>}
                    {f.isRooftop && <span className="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700 ml-1">屋突</span>}
                    {!f.isBasement && !f.isRooftop && <span className="text-gray-400">-</span>}
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
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <Modal
          isOpen
          onClose={() => setModalOpen(false)}
          title={editing ? '編輯樓層' : '新增樓層'}
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>取消</Button>
              <Button onClick={submit} disabled={submitting || !form.floorLabel}>
                {submitting ? '儲存中...' : '儲存'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="顯示名" value={form.floorLabel} onChange={(e) => setForm({ ...form, floorLabel: e.target.value })} placeholder="e.g., 1F / B1 / RF" required />
              <Input label="排序" type="number" value={form.floorIndex} onChange={(e) => setForm({ ...form, floorIndex: Number(e.target.value) })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="樓層面積 (m²)" type="number" step="0.1" value={form.floorArea} onChange={(e) => setForm({ ...form, floorArea: e.target.value })} placeholder="選填" />
              <Input label="單位面積 (m²)" type="number" step="0.1" value={form.unitArea} onChange={(e) => setForm({ ...form, unitArea: e.target.value })} placeholder="選填" />
            </div>
            {calculatedUnitCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                <Calculator className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-blue-700">
                  自動計算房數：<span className="font-bold">{calculatedUnitCount}</span> 房 (⌈{form.floorArea}/{form.unitArea}⌉)
                </span>
              </div>
            )}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isBasement} onChange={(e) => setForm({ ...form, isBasement: e.target.checked })} />
                地下樓
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isRooftop} onChange={(e) => setForm({ ...form, isRooftop: e.target.checked })} />
                屋突
              </label>
            </div>
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