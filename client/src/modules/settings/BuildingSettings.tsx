/**
 * Building Settings - 建築物管理
 * 完整版：棟別名稱 + 樓層數 + 每層幾戶 + 戶名模式 + 坪數 + 自動生成
 */

import { useState } from 'react';
import { Building2, Plus, Trash2, Wand2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useSettingsStore, useV1Store } from '@/stores';
import { useResidentStore } from '@/stores/residentStore';
import { floorsApi } from '@/api/floors';
import { residentsApi } from '@/api/residents';

interface BuildingForm {
  name: string;
  normalFloorCount: number;
  rooftopFloorCount: number;
  basementFloorCount: number;
  unitsPerFloor: number;
  unitArea: number;
  unitNamePattern: string;
  notes: string;
}

const DEFAULT_FORM: BuildingForm = {
  name: '',
  normalFloorCount: 1,
  rooftopFloorCount: 0,
  basementFloorCount: 0,
  unitsPerFloor: 4,
  unitArea: 30,
  unitNamePattern: '{building}-{floor}F-{unit}',
  notes: '',
};

export function BuildingSettings() {
  const { buildings, createBuilding, updateBuilding, deleteBuilding, isLoading } = useSettingsStore();
  const { floors, loadFloors } = useV1Store();
  const { loadResidents } = useResidentStore();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<BuildingForm>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);

  const open = (b?: any) => {
    if (b) {
      setEditing(b);
      setForm({
        name: b.name,
        normalFloorCount: b.normalFloorCount ?? 1,
        rooftopFloorCount: b.rooftopFloorCount ?? 0,
        basementFloorCount: b.basementFloorCount ?? 0,
        unitsPerFloor: b.unitsPerFloor ?? 4,
        unitArea: b.unitArea ?? 30,
        unitNamePattern: b.unitNamePattern || DEFAULT_FORM.unitNamePattern,
        notes: b.notes || '',
      });
    } else {
      setEditing(null);
      setForm(DEFAULT_FORM);
    }
    setModalOpen(true);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        normalFloorCount: Number(form.normalFloorCount) || 0,
        rooftopFloorCount: Number(form.rooftopFloorCount) || 0,
        basementFloorCount: Number(form.basementFloorCount) || 0,
        unitsPerFloor: Number(form.unitsPerFloor) || 4,
        unitArea: Number(form.unitArea) || 30,
        unitNamePattern: form.unitNamePattern,
        notes: form.notes,
      };
      if (editing) {
        updateBuilding(editing.id, payload);
      } else {
        createBuilding(payload);
      }
      setModalOpen(false);
      toast.addToast(editing ? '建築已更新' : '建築已新增', 'success');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = (id: string, name: string) => {
    if (confirm(`確定刪除建築「${name}」？將一併清除其樓層與住戶。`)) {
      deleteBuilding(id);
      toast.addToast(`已刪除 ${name}`, 'info');
    }
  };

  /**
   * 自動生成此棟所有樓層 + 住戶（V4 改寫：走 fetch API）
   */
  const generateResidents = async (building: any) => {
    if (!confirm(`將自動為「${building.name}」生成所有樓層與住戶資料卡？\n（已存在的會跳過）`)) {
      return;
    }
    setGenerating(building.id);
    try {
      const pattern = building.unitNamePattern || DEFAULT_FORM.unitNamePattern;

      // 先看現有樓層（API）
      const existingFloors = await floorsApi.listByBuilding(building.id);

      // 生成 floor_index 列表（地下從 -1 開始，一般 1+，頂樓接續）
      const floorIndexes: { index: number; label: string; isBasement: boolean; isRooftop: boolean }[] = [];

      // 地下層：B1, B2, B3...（淺到深，符合電梯按鈕順序）
      for (let i = 1; i <= building.basementFloorCount; i++) {
        floorIndexes.push({ index: -i, label: `B${i}`, isBasement: true, isRooftop: false });
      }
      // 一般樓層：1F, 2F, 3F...
      for (let i = 1; i <= building.normalFloorCount; i++) {
        floorIndexes.push({ index: i, label: `${i}F`, isBasement: false, isRooftop: false });
      }
      // 頂樓：RF 或 R1, R2...
      for (let i = 1; i <= building.rooftopFloorCount; i++) {
        floorIndexes.push({
          index: building.normalFloorCount + i,
          label: i === 1 ? 'RF' : `R${i}`,
          isBasement: false,
          isRooftop: true,
        });
      }
      const unitsPerFloor = building.unitsPerFloor || 4;
      const unitArea = building.unitArea || 30;
      let floorsAdded = 0;
      let residentsAdded = 0;

      // 一次拉此建築所有住戶（含 unitNumber + floorId），逐層比對
      const allBuildingResidents = await residentsApi.listByBuilding(building.id);

      for (const f of floorIndexes) {
        let floorRecord: any = existingFloors.find((ef: any) => ef.floorIndex === f.index);

        if (!floorRecord) {
          const floorId = `floor-${building.id}-${f.index}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const created = await floorsApi.create({
            id: floorId,
            buildingId: building.id,
            floorLabel: f.label,
            floorIndex: f.index,
            floorArea: unitArea * unitsPerFloor,
            unitArea,
            unitCount: unitsPerFloor,
            isBasement: f.isBasement ? 1 : 0,
            isRooftop: f.isRooftop ? 1 : 0,
          });
          floorRecord = { id: created.id, floorIndex: f.index, floorLabel: f.label };
          floorsAdded++;
        }

        // 此層現有住戶
        const existingResidents = allBuildingResidents.filter((r: any) => r.floorId === floorRecord.id);
        const existingUnits = new Set(existingResidents.map((r: any) => r.unitNumber));

        for (let u = 1; u <= unitsPerFloor; u++) {
          const unitNumber = String(u).padStart(2, '0');
          if (existingUnits.has(unitNumber)) continue;

          // 套用戶名模式
          const property = pattern
            .replace('{building}', building.name)
            .replace('{floor}', f.label)
            .replace('{unit}', unitNumber)
            .replace('{floorIndex}', String(f.index));

          const residentId = `res-${building.id}-${f.index}-${unitNumber}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          await residentsApi.create({
            id: residentId,
            property,
            buildingId: building.id,
            floorId: floorRecord.id,
            floor: f.label,
            floorIndex: f.index,
            unitNumber,
            unitType: 'normal',
            name: '', // 名稱留空，讓使用者填寫
            status: '空屋',
          });
          residentsAdded++;
        }
      }

      await loadFloors(building.id);
      await loadResidents();
      toast.addToast(
        `已為「${building.name}」生成 ${floorsAdded} 樓層 + ${residentsAdded} 住戶資料卡`,
        'success'
      );
    } catch (err: any) {
      toast.addToast('生成失敗：' + (err?.message || '未知錯誤'), 'error');
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900">棟別設定</h3>
          <p className="text-sm text-gray-500 mt-1">
            設定每棟樓的樓層結構，自動生成住戶資料卡
          </p>
        </div>
        <Button onClick={() => open()}>
          <Plus className="w-4 h-4 mr-2" />新增棟別
        </Button>
      </div>

      {isLoading && buildings.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
          <span className="ml-3 text-gray-500">載入中...</span>
        </div>
      ) : buildings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <Building2 className="w-12 h-12 mb-3" />
          <p className="text-lg font-medium">尚無棟別資料</p>
          <p className="text-sm mt-1">點擊「新增棟別」開始設定</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {buildings.map((b) => {
            const buildingFloors = floors.filter((f: any) => f.buildingId === b.id);
            const totalUnits = buildingFloors.reduce((sum, f) => sum + (f.unitCount || 0), 0);
            return (
              <div key={b.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Building2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{b.name}</h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {b.normalFloorCount} 一般 / {b.rooftopFloorCount} 屋突 / {b.basementFloorCount} 地下
                      </p>
                    </div>
                  </div>
                </div>

                {b.notes && <p className="text-xs text-gray-500 italic mb-3">{b.notes}</p>}

                <div className="grid grid-cols-4 gap-2 text-center text-xs mb-3 pt-3 border-t">
                  <div>
                    <p className="text-gray-500">樓層</p>
                    <p className="font-medium text-gray-900">{buildingFloors.length}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">總戶</p>
                    <p className="font-medium text-gray-900">{totalUnits}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">每層</p>
                    <p className="font-medium text-gray-900">{b.unitsPerFloor || 4}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">坪數</p>
                    <p className="font-medium text-gray-900">{b.unitArea || 30}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => open(b)} className="flex-1">
                    編輯
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => generateResidents(b)}
                    disabled={generating === b.id}
                    className="flex-1"
                  >
                    {generating === b.id ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    ) : (
                      <Wand2 className="w-3.5 h-3.5 mr-1" />
                    )}
                    生成住戶
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => remove(b.id, b.name)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <Modal
          isOpen
          onClose={() => setModalOpen(false)}
          title={editing ? '編輯棟別' : '新增棟別'}
          size="lg"
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>取消</Button>
              <Button onClick={submit} disabled={submitting || !form.name}>
                {submitting ? '儲存中...' : '儲存'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <Input
              label="棟別名稱"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="例如：A 棟、B 棟"
              required
            />

            <div className="grid grid-cols-3 gap-3">
              <Input
                label="一般樓層"
                type="number"
                min="0"
                value={String(form.normalFloorCount)}
                onChange={(e) => setForm({ ...form, normalFloorCount: Number(e.target.value) || 0 })}
              />
              <Input
                label="屋突層數"
                type="number"
                min="0"
                value={String(form.rooftopFloorCount)}
                onChange={(e) => setForm({ ...form, rooftopFloorCount: Number(e.target.value) || 0 })}
              />
              <Input
                label="地下層數"
                type="number"
                min="0"
                value={String(form.basementFloorCount)}
                onChange={(e) => setForm({ ...form, basementFloorCount: Number(e.target.value) || 0 })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="每層幾戶"
                type="number"
                min="1"
                value={String(form.unitsPerFloor)}
                onChange={(e) => setForm({ ...form, unitsPerFloor: Number(e.target.value) || 4 })}
                helperText="一般樓層每層的戶數（地下 / 屋突同樣）"
              />
              <Input
                label="每戶坪數"
                type="number"
                min="0"
                step="0.1"
                value={String(form.unitArea)}
                onChange={(e) => setForm({ ...form, unitArea: Number(e.target.value) || 30 })}
                helperText="單戶面積（平方公尺 / 坪）"
              />
            </div>

            <Input
              label="戶名模式"
              value={form.unitNamePattern}
              onChange={(e) => setForm({ ...form, unitNamePattern: e.target.value })}
              placeholder="{building}-{floor}F-{unit}"
              helperText="可用變數：{building}=棟名 {floor}=樓層 {unit}=戶號 {floorIndex}=樓層數字"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
              <strong>💡 儲存後</strong>，點擊卡片上的「生成住戶」按鈕會自動為此棟建立所有樓層與住戶資料卡（已存在的會跳過）。
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}