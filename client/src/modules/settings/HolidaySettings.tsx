/**
 * Holiday Settings — 統一假期管理
 * 兩欄式佈局：
 *   - 左欄：類型清單（CRUD：名稱、預設色 picker、排序、刪除）
 *   - 右欄：假期清單（依 date 排序，可加新假期、編輯、刪除）
 *
 * 假期欄位：日期 / 名稱 / 類型（select）/ 顏色 override（picker，預設用類型色）
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Calendar, Tag, Edit2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useHolidayStore } from '@/stores';

const COLOR_PRESETS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#6b7280', // gray
];

interface CategoryForm {
  name: string;
  color: string;
  sortOrder: number;
  notes: string;
}

interface HolidayForm {
  date: string;
  name: string;
  categoryId: string;
  color: string;       // '' 表示用 category 預設色（NULL）
  notes: string;
}

export function HolidaySettings() {
  const { t } = useTranslation();
  const toast = useToast();
  const {
    categories,
    holidays,
    loadAll,
    createCategory,
    updateCategory,
    deleteCategory,
    createHoliday,
    updateHoliday,
    deleteHoliday,
  } = useHolidayStore();

  // Category modal
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catForm, setCatForm] = useState<CategoryForm>({ name: '', color: '#3b82f6', sortOrder: 0, notes: '' });

  // Holiday modal
  const [holModalOpen, setHolModalOpen] = useState(false);
  const [editingHolId, setEditingHolId] = useState<string | null>(null);
  const [holForm, setHolForm] = useState<HolidayForm>({
    date: new Date().toISOString().slice(0, 10),
    name: '',
    categoryId: '',
    color: '',
    notes: '',
  });

  useEffect(() => {
    loadAll();
  }, []);

  // 依 date 排序的假期清單
  const sortedHolidays = useMemo(
    () => [...holidays].sort((a, b) => a.date.localeCompare(b.date)),
    [holidays]
  );

  // 計算 category 是否有 holidays 正在使用（給刪除警告用）
  const categoryUsage = useMemo(() => {
    const usage = new Map<string, number>();
    for (const h of holidays) {
      if (h.categoryId) {
        usage.set(h.categoryId, (usage.get(h.categoryId) || 0) + 1);
      }
    }
    return usage;
  }, [holidays]);

  // ============== Category handlers ==============

  const openCreateCat = () => {
    setEditingCatId(null);
    setCatForm({
      name: '',
      color: COLOR_PRESETS[(categories.length) % COLOR_PRESETS.length],
      sortOrder: categories.length,
      notes: '',
    });
    setCatModalOpen(true);
  };

  const openEditCat = (cat: any) => {
    setEditingCatId(cat.id);
    setCatForm({
      name: cat.name,
      color: cat.color,
      sortOrder: cat.sortOrder ?? 0,
      notes: cat.notes || '',
    });
    setCatModalOpen(true);
  };

  const submitCategory = () => {
    if (!catForm.name.trim()) {
      toast.addToast('請填寫類型名稱', 'error');
      return;
    }
    if (editingCatId) {
      updateCategory(editingCatId, {
        name: catForm.name.trim(),
        color: catForm.color,
        sortOrder: catForm.sortOrder,
        notes: catForm.notes,
      });
      toast.addToast('類型已更新', 'success');
    } else {
      createCategory({
        name: catForm.name.trim(),
        color: catForm.color,
        sortOrder: catForm.sortOrder,
        notes: catForm.notes,
      });
      toast.addToast('類型已新增', 'success');
    }
    setCatModalOpen(false);
  };

  const removeCategory = (id: string, name: string) => {
    const usage = categoryUsage.get(id) || 0;
    const msg = usage > 0
      ? `類型「${name}」目前被 ${usage} 個假期使用，刪除後這些假期的類型會變為「無」。\n確定刪除？`
      : `確定刪除類型「${name}」？`;
    if (confirm(msg)) {
      deleteCategory(id);
      toast.addToast(`已刪除 ${name}`, 'info');
    }
  };

  // ============== Holiday handlers ==============

  const openCreateHol = () => {
    setEditingHolId(null);
    const defaultCatId = categories[0]?.id || '';
    setHolForm({
      date: new Date().toISOString().slice(0, 10),
      name: '',
      categoryId: defaultCatId,
      color: '',
      notes: '',
    });
    setHolModalOpen(true);
  };

  const openEditHol = (h: any) => {
    setEditingHolId(h.id);
    setHolForm({
      date: h.date,
      name: h.name,
      categoryId: h.categoryId || '',
      color: h.color || '',
      notes: h.notes || '',
    });
    setHolModalOpen(true);
  };

  const submitHoliday = () => {
    if (!holForm.date || !holForm.name.trim()) {
      toast.addToast('請填寫日期與名稱', 'error');
      return;
    }
    const payload = {
      date: holForm.date,
      name: holForm.name.trim(),
      categoryId: holForm.categoryId || null,
      color: holForm.color || null,
      notes: holForm.notes,
    };
    if (editingHolId) {
      updateHoliday(editingHolId, payload);
      toast.addToast('假期已更新', 'success');
    } else {
      createHoliday(payload);
      toast.addToast('假期已新增', 'success');
    }
    setHolModalOpen(false);
  };

  const removeHoliday = (id: string, date: string, name: string) => {
    if (confirm(`確定刪除假期「${date} ${name}」？`)) {
      deleteHoliday(id);
      toast.addToast(`已刪除 ${date} ${name}`, 'info');
    }
  };

  // ============== 渲染 ==============

  // 取得某假期的實際顯示色：color override → category color → 預設灰
  const getDisplayColor = (h: any): string => {
    if (h.color) return h.color;
    const cat = categories.find((c) => c.id === h.categoryId);
    return cat?.color || '#6b7280';
  };

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ===== 左欄：類型 ===== */}
        <div className="lg:col-span-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-gray-500" />
              <h3 className="text-base font-medium text-gray-900">
                {t('holidays.categoryList', '假期類型')}
              </h3>
              <span className="text-xs text-gray-400">({categories.length})</span>
            </div>
            <Button size="sm" variant="secondary" onClick={openCreateCat}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              {t('holidays.addCategory', '新增類型')}
            </Button>
          </div>

          {categories.length === 0 ? (
            <div className="text-sm text-gray-400 py-8 text-center border border-dashed rounded-lg">
              尚無類型
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map((cat) => {
                const usage = categoryUsage.get(cat.id) || 0;
                return (
                  <div
                    key={cat.id}
                    className="group flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-white hover:shadow-sm transition-shadow"
                    style={{ borderLeftWidth: '4px', borderLeftColor: cat.color }}
                  >
                    <span
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900 truncate">{cat.name}</div>
                      <div className="text-xs text-gray-400">
                        {cat.color}
                        {usage > 0 && <span className="ml-2">• {usage} 個假期</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="sm" variant="ghost" onClick={() => openEditCat(cat)} title="編輯">
                        <Edit2 className="w-3.5 h-3.5 text-gray-600" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => removeCategory(cat.id, cat.name)} title="刪除">
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ===== 右欄：假期清單 ===== */}
        <div className="lg:col-span-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <h3 className="text-base font-medium text-gray-900">
                {t('holidays.title', '假期清單')}
              </h3>
              <span className="text-xs text-gray-400">({sortedHolidays.length})</span>
            </div>
            <Button size="sm" onClick={openCreateHol} disabled={categories.length === 0}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              {t('holidays.addHoliday', '新增假期')}
            </Button>
          </div>

          {categories.length === 0 ? (
            <div className="text-sm text-amber-600 py-4 px-4 bg-amber-50 border border-amber-200 rounded-lg">
              請先新增至少一個類型，才能建立假期。
            </div>
          ) : sortedHolidays.length === 0 ? (
            <div className="text-sm text-gray-400 py-12 text-center border border-dashed rounded-lg">
              尚無假期，點上方「新增假期」開始建立
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium text-gray-500 w-32">日期</th>
                    <th className="px-4 py-2.5 text-left font-medium text-gray-500">名稱</th>
                    <th className="px-4 py-2.5 text-left font-medium text-gray-500 w-32">類型</th>
                    <th className="px-4 py-2.5 text-center font-medium text-gray-500 w-20">顏色</th>
                    <th className="px-4 py-2.5 text-left font-medium text-gray-500">備註</th>
                    <th className="px-4 py-2.5 text-right font-medium text-gray-500 w-24">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sortedHolidays.map((h) => {
                    const cat = categories.find((c) => c.id === h.categoryId);
                    const displayColor = getDisplayColor(h);
                    return (
                      <tr key={h.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-mono text-gray-900">{h.date}</td>
                        <td className="px-4 py-2.5 text-gray-900">
                          <span
                            className="inline-block w-2 h-2 rounded-full mr-2"
                            style={{ backgroundColor: displayColor }}
                          />
                          {h.name}
                        </td>
                        <td className="px-4 py-2.5">
                          {cat ? (
                            <span
                              className="inline-block px-2 py-0.5 rounded text-xs"
                              style={{ backgroundColor: cat.color + '20', color: cat.color }}
                            >
                              {cat.name}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">無</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span
                            className="inline-block w-5 h-5 rounded border"
                            style={{ backgroundColor: displayColor }}
                            title={displayColor}
                          />
                          {h.color && <span className="ml-1 text-xs text-blue-500">override</span>}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 text-xs truncate max-w-xs">
                          {h.notes || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => openEditHol(h)} title="編輯">
                              <Edit2 className="w-3.5 h-3.5 text-gray-600" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => removeHoliday(h.id, h.date, h.name)} title="刪除">
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
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
        </div>
      </div>

      {/* ============== Category Modal ============== */}
      {catModalOpen && (
        <Modal
          isOpen
          onClose={() => setCatModalOpen(false)}
          title={editingCatId ? '編輯假期類型' : '新增假期類型'}
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setCatModalOpen(false)}>
                <X className="w-4 h-4 mr-1" />取消
              </Button>
              <Button onClick={submitCategory} disabled={!catForm.name.trim()}>
                <Check className="w-4 h-4 mr-1" />{editingCatId ? '儲存' : '新增'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <Input
              label="類型名稱"
              value={catForm.name}
              onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
              placeholder="e.g., 國定假日、補班日"
              required
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">預設顏色</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={catForm.color}
                  onChange={(e) => setCatForm({ ...catForm, color: e.target.value })}
                  className="w-12 h-10 border border-gray-300 rounded-lg cursor-pointer"
                />
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCatForm({ ...catForm, color: c })}
                      className={`w-6 h-6 rounded border-2 transition-all ${
                        catForm.color === c ? 'border-gray-900 scale-110' : 'border-gray-200'
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            </div>
            <Input
              label="排序"
              type="number"
              value={String(catForm.sortOrder)}
              onChange={(e) => setCatForm({ ...catForm, sortOrder: Number(e.target.value) || 0 })}
              helperText="數字越小越前面"
            />
            <Input
              label="備註"
              value={catForm.notes}
              onChange={(e) => setCatForm({ ...catForm, notes: e.target.value })}
              placeholder="（選填）"
            />
          </div>
        </Modal>
      )}

      {/* ============== Holiday Modal ============== */}
      {holModalOpen && (
        <Modal
          isOpen
          onClose={() => setHolModalOpen(false)}
          title={editingHolId ? '編輯假期' : '新增假期'}
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setHolModalOpen(false)}>
                <X className="w-4 h-4 mr-1" />取消
              </Button>
              <Button onClick={submitHoliday} disabled={!holForm.date || !holForm.name.trim()}>
                <Check className="w-4 h-4 mr-1" />{editingHolId ? '儲存' : '新增'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <Input
              label="日期"
              type="date"
              value={holForm.date}
              onChange={(e) => setHolForm({ ...holForm, date: e.target.value })}
              required
            />
            <Input
              label="名稱"
              value={holForm.name}
              onChange={(e) => setHolForm({ ...holForm, name: e.target.value })}
              placeholder="e.g., 雙十節、中秋節"
              required
            />
            <Select
              label="類型"
              value={holForm.categoryId}
              onChange={(e) => setHolForm({ ...holForm, categoryId: e.target.value })}
              options={[
                { value: '', label: '（無）' },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                顏色 override
                <span className="ml-2 text-xs text-gray-400 font-normal">
                  留空使用類型預設色
                </span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={holForm.color || (categories.find((c) => c.id === holForm.categoryId)?.color || '#6b7280')}
                  onChange={(e) => setHolForm({ ...holForm, color: e.target.value })}
                  className="w-12 h-10 border border-gray-300 rounded-lg cursor-pointer"
                />
                <Input
                  value={holForm.color}
                  onChange={(e) => setHolForm({ ...holForm, color: e.target.value })}
                  placeholder="留空 = 類型預設色"
                  className="flex-1"
                />
                {holForm.color && (
                  <Button size="sm" variant="ghost" onClick={() => setHolForm({ ...holForm, color: '' })}>
                    <X className="w-3.5 h-3.5" />清除
                  </Button>
                )}
              </div>
            </div>
            <Input
              label="備註"
              value={holForm.notes}
              onChange={(e) => setHolForm({ ...holForm, notes: e.target.value })}
              placeholder="（選填）"
            />
          </div>
        </Modal>
      )}
    </div>
  );
}