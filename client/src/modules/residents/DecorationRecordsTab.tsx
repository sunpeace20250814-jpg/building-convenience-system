/**
 * 裝潢記錄 Tab — Residents → Tabs[1]
 *
 * 跨住戶列出所有 decoration_records（V4.1 新表）。
 * 可依住戶 / 開始日期區間篩選。
 * 支援新增 / 編輯 / 刪除單筆裝潢記錄。
 *
 * Schema (client/src/storage/schema.ts v4.1):
 *   decoration_records(id, resident_id, name, start_date, end_date,
 *                     removal_date, start_image, removal_image,
 *                     notes, created_at, updated_at)
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Edit, Hammer, Calendar, User } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useResidentStore } from '@/stores/residentStore';
import { decorationRecordsApi, type DecorationRecordDTO } from '@/api/decoration-records';

interface DecorationRecord extends DecorationRecordDTO {
  // 相容舊欄位命名（其他元件仍用 snake_case 讀）
  resident_id: string;
  start_date: string | null;
  end_date: string | null;
  removal_date: string | null;
  start_image: string | null;
  removal_image: string | null;
  created_at: string;
  updated_at: string;
}

interface FormState {
  residentId: string;
  name: string;
  startDate: string;
  endDate: string;
  removalDate: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  residentId: '',
  name: '',
  startDate: '',
  endDate: '',
  removalDate: '',
  notes: '',
};

function toSnake(rec: DecorationRecordDTO): DecorationRecord {
  return {
    ...rec,
    resident_id: rec.residentId,
    start_date: rec.startDate ?? null,
    end_date: rec.endDate ?? null,
    removal_date: rec.removalDate ?? null,
    start_image: rec.startImage ?? null,
    removal_image: rec.removalImage ?? null,
    created_at: rec.createdAt ?? '',
    updated_at: rec.updatedAt ?? '',
  };
}

export function DecorationRecordsTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const { residents, loadResidents } = useResidentStore();

  const [records, setRecords] = useState<DecorationRecord[]>([]);
  const [filterResident, setFilterResident] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DecorationRecord | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const loadAll = async () => {
    const rows = await decorationRecordsApi.listAll();
    setRecords(rows.map(toSnake));
  };

  useEffect(() => {
    loadResidents();
    loadAll();
  }, []);

  const residentName = (id: string) => {
    const r = residents.find((x) => x.id === id);
    if (!r) return '-';
    return `${r.property || `${r.floor}-${r.unitNumber}`} ${r.ownerName || r.name || ''}`.trim();
  };

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (filterResident && r.resident_id !== filterResident) return false;
      if (dateFrom && (r.start_date || '') < dateFrom) return false;
      if (dateTo && (r.start_date || '') > dateTo) return false;
      return true;
    });
  }, [records, filterResident, dateFrom, dateTo]);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (rec: DecorationRecord) => {
    setEditing(rec);
    setForm({
      residentId: rec.resident_id,
      name: rec.name,
      startDate: rec.start_date || '',
      endDate: rec.end_date || '',
      removalDate: rec.removal_date || '',
      notes: rec.notes || '',
    });
    setModalOpen(true);
  };

  const submit = () => {
    if (!form.residentId) {
      alert(t('residents.decorations.form.residentRequired'));
      return;
    }
    if (!form.name.trim()) {
      alert(t('residents.decorations.form.nameRequired'));
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        decorationRecordsApi.update(editing.id, {
          residentId: form.residentId,
          name: form.name,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
          removalDate: form.removalDate || null,
          notes: form.notes || null,
        });
        toast.addToast(t('residents.decorations.updated'), 'success');
      } else {
        decorationRecordsApi.create({
          residentId: form.residentId,
          name: form.name,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
          removalDate: form.removalDate || null,
          notes: form.notes || null,
        });
        toast.addToast(t('residents.decorations.created'), 'success');
      }
      setModalOpen(false);
      loadAll();
    } finally {
      setSubmitting(false);
    }
  };

  const remove = (rec: DecorationRecord) => {
    if (!window.confirm(t('residents.decorations.deleteConfirm', { name: rec.name }))) return;
    decorationRecordsApi.remove(rec.id);
    toast.addToast(t('residents.decorations.deleted'), 'info');
    loadAll();
  };

  const resetFilters = () => {
    setFilterResident('');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="space-y-4">
      {/* Header + Filter bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 rounded-lg p-4">
        <Hammer className="w-5 h-5 text-blue-600" />
        <h3 className="text-sm font-semibold text-gray-700 mr-auto">
          {t('residents.decorations.title', { count: filtered.length })}
        </h3>
        <Button onClick={openNew} disabled={residents.length === 0}>
          <Plus className="w-4 h-4 mr-2" />{t('residents.decorations.add')}
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">{t('residents.decorations.filterByResident')}</label>
            <select
              value={filterResident}
              onChange={(e) => setFilterResident(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('residents.decorations.allResidents')}</option>
              {residents.map((r: any) => (
                <option key={r.id} value={r.id}>
                  {r.property || `${r.floor}-${r.unitNumber}`} {r.ownerName || r.name || ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">{t('residents.decorations.dateFrom')}</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">{t('residents.decorations.dateTo')}</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              {t('residents.decorations.clearFilters')}
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Hammer className="w-10 h-10 mb-2" />
            <p className="text-sm">{t('residents.decorations.empty')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    {t('residents.decorations.headers.name')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('residents.decorations.headers.resident')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    {t('residents.decorations.headers.startDate')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    {t('residents.decorations.headers.endDate')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    {t('residents.decorations.headers.removalDate')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('residents.decorations.headers.notes')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    {t('residents.decorations.headers.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                    <td className="px-4 py-3 text-gray-700">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        {residentName(r.resident_id)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-mono text-xs whitespace-nowrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        {r.start_date || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-mono text-xs whitespace-nowrap">{r.end_date || '-'}</td>
                    <td className="px-4 py-3 text-gray-700 font-mono text-xs whitespace-nowrap">{r.removal_date || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs max-w-[200px] truncate" title={r.notes || ''}>
                      {r.notes || '-'}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => openEdit(r)}
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-600 inline-flex items-center"
                        title={t('common.edit')}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => remove(r)}
                        className="p-1.5 hover:bg-red-50 rounded text-red-500 inline-flex items-center ml-1"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form modal */}
      {modalOpen && (
        <Modal
          isOpen
          onClose={() => setModalOpen(false)}
          title={editing ? t('residents.decorations.editTitle') : t('residents.decorations.addTitle')}
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={submit} disabled={submitting || !form.name.trim() || !form.residentId}>
                {submitting ? t('common.saving') : t('common.save')}
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <Select
              label={t('residents.decorations.form.resident') + ' *'}
              value={form.residentId}
              onChange={(e) => setForm({ ...form, residentId: e.target.value })}
              options={[
                { value: '', label: t('residents.decorations.form.selectResident') },
                ...residents.map((r: any) => ({
                  value: r.id,
                  label: `${r.property || `${r.floor}-${r.unitNumber}`} ${r.ownerName || r.name || ''}`.trim(),
                })),
              ]}
            />
            <Input
              label={t('residents.decorations.form.name') + ' *'}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('residents.decorations.form.namePlaceholder')}
              required
            />
            <div className="grid grid-cols-3 gap-3">
              <Input
                type="date"
                label={t('residents.decorations.form.startDate')}
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
              <Input
                type="date"
                label={t('residents.decorations.form.endDate')}
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
              <Input
                type="date"
                label={t('residents.decorations.form.removalDate')}
                value={form.removalDate}
                onChange={(e) => setForm({ ...form, removalDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">{t('residents.decorations.form.notes')}</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}