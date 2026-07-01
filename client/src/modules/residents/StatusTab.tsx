/**
 * 狀態管理 Tab — Residents → Tabs[3]
 *
 * 搬自 client/src/modules/settings/StatusSettings.tsx
 * V1 分離版：house_statuses（住戶）+ parking_statuses（車位）
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useV1Store } from '@/stores';
import { Plus, Trash2 } from 'lucide-react';

type StatusKind = 'house' | 'parking';

export function StatusTab() {
  const { houseStatuses, parkingStatuses, loadHouseStatuses, loadParkingStatuses, createHouseStatus, createParkingStatus, deleteHouseStatus, deleteParkingStatus } = useV1Store();
  const [modalOpen, setModalOpen] = useState(false);
  const [kind, setKind] = useState<StatusKind>('house');
  const [form, setForm] = useState({ label: '', color: '#22c55e' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadHouseStatuses();
    loadParkingStatuses();
  }, []);

  const open = (k: StatusKind) => {
    setKind(k);
    setForm({ label: '', color: k === 'house' ? '#22c55e' : '#3b82f6' });
    setModalOpen(true);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      if (kind === 'house') {
        await createHouseStatus({ label: form.label, color: form.color, sortOrder: houseStatuses.length, isWorking: 1 });
      } else {
        await createParkingStatus({ label: form.label, color: form.color, sortOrder: parkingStatuses.length });
      }
      setModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const Block = ({ title, kind, items, onDelete }: any) => (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-gray-800">{title}</h4>
        <Button size="sm" variant="secondary" onClick={() => open(kind)}>
          <Plus className="w-3.5 h-3.5 mr-1" />新增
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">尚無{title}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((s: any) => (
            <div key={s.id} className="flex items-center gap-2 px-3 py-2 rounded-lg group"
              style={{ backgroundColor: s.color + '20' }}>
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="text-sm font-medium" style={{ color: s.color }}>{s.label}</span>
              <button onClick={() => onDelete(s.id)} className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 className="w-3 h-3 text-red-500" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-8">
      <Block title="住戶狀態" kind="house" items={houseStatuses} onDelete={deleteHouseStatus} />
      <div className="border-t pt-6" />
      <Block title="停車位狀態" kind="parking" items={parkingStatuses} onDelete={deleteParkingStatus} />

      {modalOpen && (
        <Modal
          isOpen onClose={() => setModalOpen(false)}
          title={`新增${kind === 'house' ? '住戶' : '停車位'}狀態`}
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>取消</Button>
              <Button onClick={submit} disabled={submitting || !form.label}>{submitting ? '新增中...' : '新增'}</Button>
            </div>
          }
        >
          <div className="space-y-4">
            <Input label="狀態名稱" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g., 正常、出租中" required />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">顏色</label>
              <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer" />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}