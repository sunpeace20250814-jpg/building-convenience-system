/**
 * 車位管理 Tab — Residents → Tabs[2]
 *
 * 搬自 client/src/modules/settings/ParkingSettings.tsx
 * V1 邏輯：車位可雙向綁定住戶，設住戶會自動更新，反之亦然
 *
 * 差異：搬入 ResidentsModule 後，仍維持「跨建築」車位管理 + 雙向綁定邏輯。
 * 註：V4.1 新增 resident_parking 表，本 Tab 暫時不切換到新表
 *     （保持向後相容，舊 binding 仍透過 parking_spots.bound_resident_id 運作）。
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { useSettingsStore, useResidentStore, useV1Store } from '@/stores';
import { parkingBindingApi } from '@/api/parking-binding';
import { Plus, Trash2, Car, Link2, Unlink } from 'lucide-react';

const TYPE_LABELS = { car: '汽車', motorcycle: '機車', large: '大型車' };

export function ParkingTab() {
  const { buildings, parkingSpots, createParkingSpot, deleteParkingSpot, loadParkingSpots } = useSettingsStore();
  const { residents, loadResidents } = useResidentStore();
  const { parkingStatuses, loadParkingStatuses } = useV1Store();
  const [buildingId, setBuildingId] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    floor: 'B1',
    number: '',
    type: 'car' as 'car' | 'motorcycle' | 'large',
    status: 'empty',
    space: '', // V1 完整編號
  });

  useEffect(() => {
    if (buildings.length && !buildingId) setBuildingId(buildings[0].id);
    loadResidents();
    loadParkingStatuses();
  }, [buildings]);

  useEffect(() => {
    loadParkingSpots();
  }, []);

  const submit = () => {
    setSubmitting(true);
    try {
      const space = form.space || form.number;
      const statusId = parkingStatuses.find((s) => s.label.toLowerCase().includes(form.status))?.id
        || parkingStatuses[0]?.id;
      createParkingSpot({
        buildingId,
        floor: form.floor,
        number: form.number,
        space,
        type: form.type,
        status: form.status,
        statusId,
      });
      setModalOpen(false);
      setForm({ ...form, number: '', space: '' });
    } finally {
      setSubmitting(false);
    }
  };

  const remove = (s: any) => {
    if (s.boundResidentId) {
      alert('此車位已綁定住戶，請先解除綁定');
      return;
    }
    if (confirm(`刪除車位「${s.space || s.number}」？`)) deleteParkingSpot(s.id);
  };

  // 雙向綁定邏輯（透過 parkingBindingApi，跨表 transaction 集中）
  const bind = async (spotId: string, residentId: string | null) => {
    const spot = parkingSpots.find((p) => p.id === spotId);
    if (!spot) return;
    if (residentId) {
      await parkingBindingApi.bind({ spotId, residentId });
    } else {
      await parkingBindingApi.unbind(spotId);
    }
    loadParkingSpots();
    loadResidents();
  };

  const filteredSpots = buildingId
    ? parkingSpots.filter((p) => p.buildingId === buildingId)
    : parkingSpots;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">停車位管理</h3>
        <div className="flex items-center gap-3">
          <Select value={buildingId} onChange={(e) => setBuildingId(e.target.value)}
            options={[{ value: '', label: '全部' }, ...buildings.map((b) => ({ value: b.id, label: b.name }))]}
            className="w-40" />
          <Button onClick={() => setModalOpen(true)} disabled={!buildingId && buildings.length > 0}>
            <Plus className="w-4 h-4 mr-2" />新增車位
          </Button>
        </div>
      </div>

      {filteredSpots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <Car className="w-12 h-12 mb-3" />
          <p className="text-lg font-medium">尚無車位</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">編號</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">樓層</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">類型</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">狀態</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">綁定住戶</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredSpots.map((s) => {
                const resident = residents.find((r) => r.id === s.boundResidentId);
                const statusColor = parkingStatuses.find((ps) => ps.id === s.statusId)?.color || '#6b7280';
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{s.space || s.number}</td>
                    <td className="px-4 py-3 text-gray-600">{s.floor}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="default" size="sm">{TYPE_LABELS[s.type as keyof typeof TYPE_LABELS] || s.type}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded text-xs"
                        style={{ backgroundColor: statusColor + '20', color: statusColor }}>
                        {parkingStatuses.find((ps) => ps.id === s.statusId)?.label || s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {resident ? (
                        <div className="flex items-center gap-2">
                          <Link2 className="w-3.5 h-3.5 text-blue-600" />
                          <span className="text-sm">{resident.ownerName || resident.name} - {resident.floor}{resident.unitNumber}</span>
                          <Button size="sm" variant="ghost" onClick={() => bind(s.id, null)}>
                            <Unlink className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <select
                          value=""
                          onChange={(e) => e.target.value && bind(s.id, e.target.value)}
                          className="text-sm border rounded px-2 py-1"
                        >
                          <option value="">選擇住戶...</option>
                          {residents.filter((r) => !r.parkingId || r.parkingId === s.id).map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.ownerName || r.name} ({r.floor}{r.unitNumber})
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="danger" onClick={() => remove(s)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex gap-4 mt-4 text-sm text-gray-500">
        <span>總車位：{filteredSpots.length}</span>
        <span>|</span>
        <span>汽車：{filteredSpots.filter((s) => s.type === 'car').length}</span>
        <span>|</span>
        <span>機車：{filteredSpots.filter((s) => s.type === 'motorcycle').length}</span>
        <span>|</span>
        <span>已綁定：{filteredSpots.filter((s) => s.boundResidentId).length}</span>
      </div>

      {modalOpen && (
        <Modal
          isOpen onClose={() => setModalOpen(false)}
          title="新增停車位"
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>取消</Button>
              <Button onClick={submit} disabled={submitting || !form.number}>{submitting ? '新增中...' : '新增'}</Button>
            </div>
          }
        >
          <div className="space-y-4">
            <Select label="建築" value={buildingId} onChange={(e) => setBuildingId(e.target.value)}
              options={buildings.map((b) => ({ value: b.id, label: b.name }))} required />
            <div className="grid grid-cols-2 gap-3">
              <Input label="樓層" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} placeholder="e.g., B1、1F" />
              <Input label="車位編號" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value, space: e.target.value })} placeholder="e.g., A-001" required />
            </div>
            <Select label="類型" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })}
              options={[{ value: 'car', label: '汽車' }, { value: 'motorcycle', label: '機車' }, { value: 'large', label: '大型車' }]} />
          </div>
        </Modal>
      )}
    </div>
  );
}