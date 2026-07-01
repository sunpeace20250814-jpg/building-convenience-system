/**
 * ResidentModal - V4.1 整個改版
 *
 * - 拉寬到 max-w-5xl（透過 Modal 的 className prop override）
 * - 4 區 Tabs：基本資訊 / 同居住人 / 車位 / 裝潢記錄
 * - Modal body 背景按選定狀態顏色 15% 透明覆蓋
 * - 提交時：寫 residents 主表 + 5 個子表（emergency_contacts / members / parking / keycards / decoration_records）
 *
 * 新表（來自 db-schema-changes task）：
 *   - resident_emergency_contacts (id, resident_id, name, phone, address, relation, notes, created_at)
 *   - resident_parking (id, resident_id, parking_spot_id, etc_number, notes, created_at)
 *   - decoration_records (id, resident_id, name, start_date, end_date, removal_date, start_image, removal_image, notes, created_at, updated_at)
 *
 * 新欄位（db-schema-changes task）：
 *   - residents.delivery_date (TEXT)
 *   - residents.owner_address (TEXT)
 *   - parking_spots.etc_number (TEXT)
 */

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { useResidentStore, useV1Store, useSettingsStore } from '@/stores';
import { residentEmergencyContactsApi } from '@/api/resident-emergency-contacts';
import { residentParkingApi, type ResidentParkingWithSpotDTO } from '@/api/resident-parking';
import { residentMembersApi } from '@/api/residents';
import { residentKeycardsApi } from '@/api/residents';
import { decorationRecordsApi } from '@/api/decoration-records';

type Tab = 'basic' | 'members' | 'parking' | 'decoration';

// ----- 本地表單型別（_uiId 是 UI 用 React key；id 是 DB 主鍵，新列尚未存所以可為 undefined） -----

interface EmergencyContactRow {
  _uiId: string;
  id?: string;
  name: string;
  phone: string;
  address: string;
  relation: string;
  notes: string;
}

interface MemberRow {
  _uiId: string;
  id?: string;
  name: string;
  phone: string;
  relationship: string;
  notes: string;
}

interface ParkingRow {
  _uiId: string;
  id?: string;
  parkingSpotId: string;
  spotLabel: string;
  etcNumber: string;
  notes: string;
  /** UI 用：分區用（汽車 / 機車），DB 由 join parking_spots 拿 */
  type: 'car' | 'motorcycle';
}

interface KeycardRow {
  _uiId: string;
  id?: string;
  /** 顯示名稱（DB 沒這個欄位，純 UI label） */
  name: string;
  cardNumber: string;
  notes: string;
}

interface DecorationRow {
  _uiId: string;
  id?: string;
  name: string;
  startDate: string;
  endDate: string;
  removalDate: string;
  startImage: string | null;
  removalImage: string | null;
  notes: string;
}

interface ResidentModalProps {
  resident?: any | null;
  onClose: () => void;
}

function genUiId(): string {
  return `ui-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ResidentModal({ resident, onClose }: ResidentModalProps) {
  const { createResident, updateResident, loadMembers, loadKeycards } = useResidentStore();
  const { buildings, parkingSpots, loadParkingSpots } = useSettingsStore();
  const { floors, houseStatuses, loadHouseStatuses } = useV1Store();
  const isEditing = !!resident;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('basic');

  // ============ 表單狀態：主表欄位 ============
  const [form, setForm] = useState({
    buildingId: resident?.buildingId || buildings[0]?.id || '',
    floorId: resident?.floorId || '',
    floor: resident?.floor || '',
    floorIndex: resident?.floorIndex ?? 1,
    unitNumber: resident?.unitNumber || '',
    property: resident?.property || '',
    ownerName: resident?.ownerName || resident?.name || '',
    phone: resident?.phone || '',
    email: resident?.email || '',
    contactAddress: resident?.address || resident?.ownerAddress || '',
    ownerAddress: resident?.ownerAddress || '',
    deliveryDate: resident?.deliveryDate ? String(resident.deliveryDate).split('T')[0] : '',
    moveInDate: resident?.moveInDate ? String(resident.moveInDate).split('T')[0] : new Date().toISOString().split('T')[0],
    moveOutDate: resident?.moveOutDate ? String(resident.moveOutDate).split('T')[0] : '',
    deposit: resident?.deposit ?? '',
    monthlyRent: resident?.monthlyRent ?? '',
    statusId: resident?.statusId || houseStatuses[0]?.id || '',
    status: resident?.status || houseStatuses[0]?.label || '正常',
    renterName: resident?.renterName || '',
    notes: resident?.notes || resident?.note || '',
  });

  // ============ 子表狀態 ============
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContactRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [parkings, setParkings] = useState<ParkingRow[]>([]);
  const [keycards, setKeycards] = useState<KeycardRow[]>([]);
  const [decorations, setDecorations] = useState<DecorationRow[]>([]);

  // 進入 modal 時確保 houseStatuses 跟 parkingSpots 都有載入
  useEffect(() => {
    if (houseStatuses.length === 0) loadHouseStatuses();
    if (parkingSpots.length === 0) loadParkingSpots();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 編輯模式：載入既有子表資料
  useEffect(() => {
    if (!resident?.id) return;
    const id = resident.id;
    let cancelled = false;

    (async () => {
      // resident_emergency_contacts（server API）
      try {
        const rows = await residentEmergencyContactsApi.list(id);
        if (cancelled) return;
        setEmergencyContacts(
          rows.map((r) => ({
            _uiId: genUiId(),
            id: r.id,
            name: r.name || '',
            phone: r.phone || '',
            address: r.address || '',
            relation: r.relation || '',
            notes: r.notes || '',
          }))
        );
      } catch {
        if (!cancelled) setEmergencyContacts([]);
      }

      // resident_members（server api — async）
      try {
        const rows = await residentMembersApi.list(id);
        if (cancelled) return;
        setMembers(
          rows.map((r: any) => ({
            _uiId: genUiId(),
            id: r.id,
            name: r.name || '',
            phone: r.phone || '',
            relationship: r.relationship || r.relation || '',
            notes: r.notes || r.note || '',
          }))
        );
      } catch {
        if (!cancelled) setMembers([]);
      }

      // resident_parking（server API）
      try {
        const rows: ResidentParkingWithSpotDTO[] = await residentParkingApi.list(id);
        if (cancelled) return;
        setParkings(
          rows.map((r) => ({
            _uiId: genUiId(),
            id: r.id,
            parkingSpotId: r.parkingSpotId || '',
            spotLabel: r.spotSpace || `${r.spotFloor || ''}-${r.spotNumber || ''}`,
            etcNumber: r.etcNumber || '',
            notes: r.notes || '',
            type: r.spotType === 'motorcycle' ? 'motorcycle' : 'car',
          }))
        );
      } catch {
        if (!cancelled) setParkings([]);
      }

      // resident_keycards（server api — async）
      try {
        const rows = await residentKeycardsApi.list(id);
        if (cancelled) return;
        setKeycards(
          rows.map((r: any) => ({
            _uiId: genUiId(),
            id: r.id,
            name: r.cardNumber || '',
            cardNumber: r.cardNumber || '',
            notes: r.note || '',
          }))
        );
      } catch {
        if (!cancelled) setKeycards([]);
      }

      // decoration_records（server API）
      try {
        const rows = await decorationRecordsApi.listByResident(id);
        if (cancelled) return;
        setDecorations(
          rows.map((r) => ({
            _uiId: genUiId(),
            id: r.id,
            name: r.name || '',
            startDate: r.startDate || '',
            endDate: r.endDate || '',
            removalDate: r.removalDate || '',
            startImage: r.startImage || null,
            removalImage: r.removalImage || null,
            notes: r.notes || '',
          }))
        );
      } catch {
        if (!cancelled) setDecorations([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [resident?.id]);

  // ============ 衍生：狀態顏色 / 樓層 / 可選車位 ============

  const statusColor = useMemo(() => {
    const s = houseStatuses.find((s: any) => s.id === form.statusId);
    return s?.color || '#6b7280';
  }, [form.statusId, houseStatuses]);

  const buildingFloors = useMemo(
    () => floors.filter((f: any) => f.buildingId === form.buildingId),
    [floors, form.buildingId]
  );

  // ============ 主表欄位 handlers ============

  const handleFloorChange = (floorId: string) => {
    const f = floors.find((x: any) => x.id === floorId);
    if (f) {
      const property = `${form.buildingId.slice(0, 4)}-${f.floorIndex}-${String(form.unitNumber).padStart(2, '0')}`;
      setForm((p) => ({
        ...p,
        floorId,
        floor: f.floorLabel,
        floorIndex: f.floorIndex,
        property,
      }));
    } else {
      setForm((p) => ({ ...p, floorId }));
    }
  };

  const handleUnitChange = (unitNumber: string) => {
    const property = `${form.buildingId.slice(0, 4)}-${form.floorIndex}-${String(unitNumber).padStart(2, '0')}`;
    setForm((p) => ({ ...p, unitNumber, property }));
  };

  const handleStatusChange = (statusId: string) => {
    const s = houseStatuses.find((x: any) => x.id === statusId);
    setForm((p) => ({ ...p, statusId, status: s?.label || p.status }));
  };

  const handleBuildingChange = (buildingId: string) => {
    // 換棟別時清空 floorId/property 避免錯亂
    setForm((p) => ({ ...p, buildingId, floorId: '', floor: '', floorIndex: 1, property: '' }));
  };

  // ============ 子表 CRUD helpers ============

  const addEmergencyContact = () =>
    setEmergencyContacts((p) => [...p, { _uiId: genUiId(), name: '', phone: '', address: '', relation: '', notes: '' }]);
  const removeEmergencyContact = (uiId: string) =>
    setEmergencyContacts((p) => p.filter((x) => x._uiId !== uiId));
  const updateEmergencyContact = (uiId: string, patch: Partial<EmergencyContactRow>) =>
    setEmergencyContacts((p) => p.map((x) => (x._uiId === uiId ? { ...x, ...patch } : x)));

  const addMember = () =>
    setMembers((p) => [...p, { _uiId: genUiId(), name: '', phone: '', relationship: '', notes: '' }]);
  const removeMember = (uiId: string) =>
    setMembers((p) => p.filter((x) => x._uiId !== uiId));
  const updateMember = (uiId: string, patch: Partial<MemberRow>) =>
    setMembers((p) => p.map((x) => (x._uiId === uiId ? { ...x, ...patch } : x)));

  const addParking = (type: 'car' | 'motorcycle') =>
    setParkings((p) => [
      ...p,
      { _uiId: genUiId(), parkingSpotId: '', spotLabel: '', etcNumber: '', notes: '', type },
    ]);
  const removeParking = (uiId: string) =>
    setParkings((p) => p.filter((x) => x._uiId !== uiId));
  const updateParking = (uiId: string, patch: Partial<ParkingRow>) =>
    setParkings((p) => p.map((x) => (x._uiId === uiId ? { ...x, ...patch } : x)));

  const addKeycard = () =>
    setKeycards((p) => [...p, { _uiId: genUiId(), name: '', cardNumber: '', notes: '' }]);
  const removeKeycard = (uiId: string) =>
    setKeycards((p) => p.filter((x) => x._uiId !== uiId));
  const updateKeycard = (uiId: string, patch: Partial<KeycardRow>) =>
    setKeycards((p) => p.map((x) => (x._uiId === uiId ? { ...x, ...patch } : x)));

  const addDecoration = () =>
    setDecorations((p) => [
      ...p,
      { _uiId: genUiId(), name: '', startDate: '', endDate: '', removalDate: '', startImage: null, removalImage: null, notes: '' },
    ]);
  const removeDecoration = (uiId: string) =>
    setDecorations((p) => p.filter((x) => x._uiId !== uiId));
  const updateDecoration = (uiId: string, patch: Partial<DecorationRow>) =>
    setDecorations((p) => p.map((x) => (x._uiId === uiId ? { ...x, ...patch } : x)));

  // ============ 提交 ============

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.ownerName.trim()) {
      alert('請填寫區權人姓名');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload: any = {
        ...form,
        name: form.ownerName,
        ownerName: form.ownerName,
        deposit: form.deposit !== '' ? Number(form.deposit) : undefined,
        monthlyRent: form.monthlyRent !== '' ? Number(form.monthlyRent) : undefined,
        memberCount: members.length,
        address: form.contactAddress, // schema 舊欄位（向後相容）
        ownerAddress: form.ownerAddress, // schema 新欄位
      };

      let residentId: string;
      if (isEditing && resident) {
        await updateResident(resident.id, payload);
        residentId = resident.id;
      } else {
        const created = await createResident(payload);
        residentId = created.id;
      }

      // 子表：依序寫入（client-only wrapper 內部已處理 replace-all）
      // 注意：server route 已 FK CASCADE 處理 members / keycards 的刪除，
      //       但 emergency_contacts / resident_parking / decoration_records 沒有 server route，
      //       所以這些走 client-side api 的 replaceAll（內部先 delete all 再 insert new）。
      await residentEmergencyContactsApi.replaceAll(
        residentId,
        emergencyContacts.map((c) => ({
          name: c.name.trim(),
          phone: c.phone.trim() || null,
          address: c.address.trim() || null,
          relation: c.relation.trim() || null,
          notes: c.notes.trim() || null,
        }))
      );

      // members / keycards：server 有 route，用 store 既有的 bulk 邏輯
      //   - 先清後建（store 內 update 已能處理，這裡用 replace pattern）
      //   - 簡化：用 server api 直接 delete-all + create
      await syncServerSubResource(
        residentId,
        residentMembersApi,
        members.map((m) => ({
          name: m.name.trim(),
          phone: m.phone.trim() || null,
          relationship: m.relationship.trim() || null,
          notes: m.notes.trim() || null,
        })),
        // localExisting 由 store 提供，這裡不直接 query — 直接整批 replace：
        // 先刪掉 server 端的全部，再 create 新的
      );

      // resident_parking（client-only）
      await residentParkingApi.replaceAll(
        residentId,
        parkings
          .filter((p) => p.parkingSpotId)
          .map((p) => ({
            parkingSpotId: p.parkingSpotId,
            etcNumber: p.etcNumber.trim() || null,
            notes: p.notes.trim() || null,
          }))
      );

      // keycards（server）
      await syncServerSubResource(
        residentId,
        residentKeycardsApi,
        keycards
          .filter((k) => k.cardNumber.trim())
          .map((k) => ({
            cardNumber: k.cardNumber.trim(),
            note: k.notes.trim() || null,
          })),
      );

      // decoration_records（client-only）
      await decorationRecordsApi.replaceAll(
        residentId,
        decorations.map((d) => ({
          residentId,
          name: d.name.trim(),
          startDate: d.startDate || null,
          endDate: d.endDate || null,
          removalDate: d.removalDate || null,
          startImage: d.startImage,
          removalImage: d.removalImage,
          notes: d.notes.trim() || null,
        }))
      );

      // 刷新 store 緩存（讓 ResidentDetail 等看得到新資料）
      await loadMembers(residentId);
      await loadKeycards(residentId);

      onClose();
    } catch (err: any) {
      console.error('[ResidentModal] submit failed:', err);
      alert(`儲存失敗：${err?.message || String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * 整批替換 server-backed 子資源（members / keycards）：
   *   先列出現有 → 算 diff → 該刪的刪 / 該加的加 / 該改的改
   *
   * 因為 server 沒有 batch endpoint，所以這裡走 N 次單筆 API。
   * 數量級通常 1-10 筆，效能可接受。
   */
  async function syncServerSubResource<T extends { id: string }, C>(
    residentId: string,
    api: {
      list: (id: string) => Promise<T[]>;
      create: (id: string, data: C) => Promise<T>;
      update: (id: string, subId: string, data: Partial<C>) => Promise<T>;
      remove: (id: string, subId: string) => Promise<{ success: boolean }>;
    },
    desired: C[]
  ): Promise<void> {
    const existing = await api.list(residentId);
    const desiredIds = new Set<string>();

    // 簡化策略：用 _uiId 對齊（modal 內 row 已有 _uiId，但我們用順序對齊 new vs existing）
    // 因為 modal 沒保留 server id 對應 — 退而求其次：
    //   - desired 全部 create
    //   - existing 全部 remove
    // 犧牲：保留 id 變更（極少觸發），但保證語意正確
    await Promise.all(existing.map((e) => api.remove(residentId, e.id)));
    await Promise.all(desired.map((d) => api.create(residentId, d)));
    void desiredIds;
  }

  // ============ 渲染 ============

  // 過濾可用車位（已用過的不能再選，但保留自己目前那筆以支援原地編輯）
  const usedSpotIds = new Set(parkings.filter((p) => p.parkingSpotId).map((p) => p.parkingSpotId));
  const carSpots = parkingSpots.filter((s: any) => s.type === 'car');
  const motoSpots = parkingSpots.filter((s: any) => s.type === 'motorcycle');

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isEditing ? '編輯住戶' : '新增住戶'}
      size="lg"
      className="max-w-5xl"
      bodyClassName="p-0"
      footer={
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">
            {members.length} 同住人 · {parkings.length} 車位 · {keycards.length} 磁扣 · {decorations.length} 裝潢 · {emergencyContacts.length} 緊急聯絡人
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? '儲存中...' : '儲存'}
            </Button>
          </div>
        </div>
      }
    >
      {/* 狀態顏色覆蓋層（15% 透明） */}
      <div style={{ backgroundColor: statusColor + '15' }}>
        {/* Tabs */}
        <div className="flex border-b bg-white/40 backdrop-blur-sm">
          {([
            ['basic', `基本資訊`],
            ['members', `同居住人 (${members.length})`],
            ['parking', `車位 / 磁扣 (${parkings.length + keycards.length})`],
            ['decoration', `裝潢記錄 (${decorations.length})`],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === key
                  ? 'border-blue-600 text-blue-700 bg-white/60'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
            {activeTab === 'basic' && (
              <BasicTab
                form={form}
                setForm={setForm}
                buildings={buildings}
                buildingFloors={buildingFloors}
                houseStatuses={houseStatuses}
                statusColor={statusColor}
                handleBuildingChange={handleBuildingChange}
                handleFloorChange={handleFloorChange}
                handleUnitChange={handleUnitChange}
                handleStatusChange={handleStatusChange}
                emergencyContacts={emergencyContacts}
                addEmergencyContact={addEmergencyContact}
                removeEmergencyContact={removeEmergencyContact}
                updateEmergencyContact={updateEmergencyContact}
              />
            )}

            {activeTab === 'members' && (
              <MembersTab
                members={members}
                addMember={addMember}
                removeMember={removeMember}
                updateMember={updateMember}
              />
            )}

            {activeTab === 'parking' && (
              <ParkingTab
                parkings={parkings}
                keycards={keycards}
                carSpots={carSpots}
                motoSpots={motoSpots}
                usedSpotIds={usedSpotIds}
                addParking={addParking}
                removeParking={removeParking}
                updateParking={updateParking}
                addKeycard={addKeycard}
                removeKeycard={removeKeycard}
                updateKeycard={updateKeycard}
              />
            )}

            {activeTab === 'decoration' && (
              <DecorationTab
                decorations={decorations}
                addDecoration={addDecoration}
                removeDecoration={removeDecoration}
                updateDecoration={updateDecoration}
              />
            )}

            {/* 隱藏 submit 讓 Enter 鍵能觸發（雖說 footer 也有按鈕） */}
            <button type="submit" className="hidden" aria-hidden="true" />
          </form>
        </div>
      </div>
    </Modal>
  );
}

// =========================================================
// 子元件：每個 Tab 的內容（拆出去讓主檔更短）
// =========================================================

interface BasicTabProps {
  form: any;
  setForm: React.Dispatch<React.SetStateAction<any>>;
  buildings: any[];
  buildingFloors: any[];
  houseStatuses: any[];
  statusColor: string;
  handleBuildingChange: (v: string) => void;
  handleFloorChange: (v: string) => void;
  handleUnitChange: (v: string) => void;
  handleStatusChange: (v: string) => void;
  emergencyContacts: EmergencyContactRow[];
  addEmergencyContact: () => void;
  removeEmergencyContact: (uiId: string) => void;
  updateEmergencyContact: (uiId: string, patch: Partial<EmergencyContactRow>) => void;
}

function BasicTab({
  form,
  setForm,
  buildings,
  buildingFloors,
  houseStatuses,
  statusColor,
  handleBuildingChange,
  handleFloorChange,
  handleUnitChange,
  handleStatusChange,
  emergencyContacts,
  addEmergencyContact,
  removeEmergencyContact,
  updateEmergencyContact,
}: BasicTabProps) {
  return (
    <div className="space-y-4">
      {/* Row 1：棟別 / 交屋日期 / 入住日期 / 押金 / 月租 */}
      <div className="grid grid-cols-5 gap-3">
        <Select
          label="棟別"
          value={form.buildingId}
          onChange={(e) => handleBuildingChange(e.target.value)}
          options={buildings.map((b: any) => ({ value: b.id, label: b.name }))}
          required
        />
        <Input
          label="交屋日期"
          type="date"
          value={form.deliveryDate}
          onChange={(e) => setForm((p: any) => ({ ...p, deliveryDate: e.target.value }))}
        />
        <Input
          label="入住日期"
          type="date"
          value={form.moveInDate}
          onChange={(e) => setForm((p: any) => ({ ...p, moveInDate: e.target.value }))}
        />
        <Input
          label="押金"
          type="number"
          value={form.deposit}
          onChange={(e) => setForm((p: any) => ({ ...p, deposit: e.target.value }))}
          placeholder="0"
        />
        <Input
          label="月租"
          type="number"
          value={form.monthlyRent}
          onChange={(e) => setForm((p: any) => ({ ...p, monthlyRent: e.target.value }))}
          placeholder="0"
        />
      </div>

      {/* Row 2：戶號 / 樓層 / 狀態（含顏色 badge 預覽） */}
      <div className="grid grid-cols-4 gap-3">
        <Input
          label="戶號"
          value={form.unitNumber}
          onChange={(e) => handleUnitChange(e.target.value)}
          placeholder="e.g., 01"
        />
        <Select
          label="樓層"
          value={form.floorId}
          onChange={(e) => handleFloorChange(e.target.value)}
          options={buildingFloors.map((f: any) => ({ value: f.id, label: f.floorLabel }))}
        />
        <Select
          label="狀態"
          value={form.statusId}
          onChange={(e) => handleStatusChange(e.target.value)}
          options={houseStatuses.map((s: any) => ({ value: s.id, label: s.label }))}
        />
        <div className="flex flex-col">
          <label className="block text-sm font-medium text-gray-700 mb-1">狀態預覽</label>
          <div
            className="flex items-center justify-center px-3 py-2 rounded-lg border-2 font-medium text-sm"
            style={{
              backgroundColor: statusColor + '25',
              borderColor: statusColor,
              color: statusColor,
            }}
          >
            {form.status || '未設定'}
          </div>
        </div>
      </div>

      {form.property && (
        <div className="text-sm text-gray-600 bg-white/60 border border-gray-200 px-3 py-2 rounded">
          自動房號：<span className="font-mono font-medium text-blue-700">{form.property}</span>
        </div>
      )}

      {/* Row 3：區權人 / 電話 / 聯絡地址 / email */}
      <div className="grid grid-cols-4 gap-3">
        <Input
          label="區權人姓名"
          value={form.ownerName}
          onChange={(e) => setForm((p: any) => ({ ...p, ownerName: e.target.value }))}
          required
        />
        <Input
          label="區權人電話"
          type="tel"
          value={form.phone}
          onChange={(e) => setForm((p: any) => ({ ...p, phone: e.target.value }))}
        />
        <Input
          label="聯絡地址"
          value={form.contactAddress}
          onChange={(e) => setForm((p: any) => ({ ...p, contactAddress: e.target.value }))}
          placeholder="戶籍 / 通訊地址"
        />
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((p: any) => ({ ...p, email: e.target.value }))}
        />
      </div>

      {/* Row 4：區權人緊急聯絡人（多筆） */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">
            區權人緊急聯絡人（多筆）
          </label>
          <Button type="button" variant="secondary" size="sm" onClick={addEmergencyContact}>
            <Plus className="w-3.5 h-3.5 mr-1" /> 新增
          </Button>
        </div>
        <div className="space-y-2">
          {emergencyContacts.map((c) => (
            <div
              key={c._uiId}
              className="grid grid-cols-12 gap-2 bg-white/70 p-2 rounded items-end"
            >
              <Input
                className="col-span-2"
                label="姓名"
                value={c.name}
                onChange={(e) => updateEmergencyContact(c._uiId, { name: e.target.value })}
              />
              <Input
                className="col-span-2"
                label="電話"
                value={c.phone}
                onChange={(e) => updateEmergencyContact(c._uiId, { phone: e.target.value })}
              />
              <Input
                className="col-span-3"
                label="地址"
                value={c.address}
                onChange={(e) => updateEmergencyContact(c._uiId, { address: e.target.value })}
              />
              <Input
                className="col-span-2"
                label="關係"
                value={c.relation}
                onChange={(e) => updateEmergencyContact(c._uiId, { relation: e.target.value })}
              />
              <Input
                className="col-span-2"
                label="備註"
                value={c.notes}
                onChange={(e) => updateEmergencyContact(c._uiId, { notes: e.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="col-span-1 text-red-500 hover:bg-red-50"
                onClick={() => removeEmergencyContact(c._uiId)}
                aria-label="刪除緊急聯絡人"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          {emergencyContacts.length === 0 && (
            <div className="text-xs text-gray-400 text-center py-2 bg-white/40 rounded">
              尚未新增緊急聯絡人
            </div>
          )}
        </div>
      </div>

      {/* Row 5：租客 / 備註（手動加可選電話欄） */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="租客姓名"
          value={form.renterName}
          onChange={(e) => setForm((p: any) => ({ ...p, renterName: e.target.value }))}
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
          <textarea
            rows={1}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.notes}
            onChange={(e) => setForm((p: any) => ({ ...p, notes: e.target.value }))}
            placeholder="其他備註（含租客電話可寫在這）"
          />
        </div>
      </div>

      {/* 區權人地址（schema 新欄位） */}
      <div className="grid grid-cols-1 gap-3">
        <Input
          label="區權人戶籍地址（owner_address）"
          value={form.ownerAddress}
          onChange={(e) => setForm((p: any) => ({ ...p, ownerAddress: e.target.value }))}
          helperText="跟「聯絡地址」可不同；聯絡地址用於一般通訊，戶籍地址為法定地址"
        />
      </div>

      {/* 狀態 badge 預覽（裝飾） */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Badge style={{ backgroundColor: statusColor + '25', color: statusColor, borderColor: statusColor }}>
          當前狀態：{form.status}
        </Badge>
        <span>·</span>
        <span>背景色會跟著狀態變化</span>
      </div>
    </div>
  );
}

interface MembersTabProps {
  members: MemberRow[];
  addMember: () => void;
  removeMember: (uiId: string) => void;
  updateMember: (uiId: string, patch: Partial<MemberRow>) => void;
}

function MembersTab({ members, addMember, removeMember, updateMember }: MembersTabProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">
          同居住人列表（resident_members）
        </h3>
        <Button type="button" variant="secondary" size="sm" onClick={addMember}>
          <Plus className="w-3.5 h-3.5 mr-1" /> 新增
        </Button>
      </div>

      {members.length === 0 && (
        <div className="text-sm text-gray-400 text-center py-8 bg-white/40 rounded">
          尚無同居住人（點「新增」開始加入）
        </div>
      )}

      <div className="space-y-2">
        {members.map((m) => (
          <div key={m._uiId} className="grid grid-cols-12 gap-2 bg-white/70 p-3 rounded">
            <Input
              className="col-span-3"
              label="姓名"
              value={m.name}
              onChange={(e) => updateMember(m._uiId, { name: e.target.value })}
              required
            />
            <Input
              className="col-span-3"
              label="電話"
              type="tel"
              value={m.phone}
              onChange={(e) => updateMember(m._uiId, { phone: e.target.value })}
            />
            <Input
              className="col-span-2"
              label="關係"
              value={m.relationship}
              onChange={(e) => updateMember(m._uiId, { relationship: e.target.value })}
              placeholder="配偶/子女/..."
            />
            <Input
              className="col-span-3"
              label="備註"
              value={m.notes}
              onChange={(e) => updateMember(m._uiId, { notes: e.target.value })}
            />
            <div className="col-span-1 flex items-end justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-red-500 hover:bg-red-50"
                onClick={() => removeMember(m._uiId)}
                aria-label="刪除成員"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ParkingTabProps {
  parkings: ParkingRow[];
  keycards: KeycardRow[];
  carSpots: any[];
  motoSpots: any[];
  usedSpotIds: Set<string>;
  addParking: (type: 'car' | 'motorcycle') => void;
  removeParking: (uiId: string) => void;
  updateParking: (uiId: string, patch: Partial<ParkingRow>) => void;
  addKeycard: () => void;
  removeKeycard: (uiId: string) => void;
  updateKeycard: (uiId: string, patch: Partial<KeycardRow>) => void;
}

function ParkingTab({
  parkings,
  keycards,
  carSpots,
  motoSpots,
  usedSpotIds,
  addParking,
  removeParking,
  updateParking,
  addKeycard,
  removeKeycard,
  updateKeycard,
}: ParkingTabProps) {
  const renderParkingRows = (rows: ParkingRow[], spots: any[]) => (
    <div className="space-y-2">
      {rows.map((p) => {
        const opts = [
          { value: '', label: '選擇車位...' },
          ...spots
            .filter((s: any) => !usedSpotIds.has(s.id) || s.id === p.parkingSpotId)
            .map((s: any) => ({
              value: s.id,
              label: s.space || `${s.floor}-${s.number}` || s.id,
            })),
        ];
        return (
          <div
            key={p._uiId}
            className="grid grid-cols-12 gap-2 bg-white/70 p-2 rounded items-end"
          >
            <Select
              className="col-span-5"
              label="車位"
              value={p.parkingSpotId}
              onChange={(e) => {
                const spot = spots.find((s: any) => s.id === e.target.value);
                updateParking(p._uiId, {
                  parkingSpotId: e.target.value,
                  spotLabel: spot
                    ? spot.space || `${spot.floor || ''}-${spot.number || ''}`
                    : '',
                });
              }}
              options={opts}
            />
            <Input
              className="col-span-3"
              label="ETC 號碼"
              value={p.etcNumber}
              onChange={(e) => updateParking(p._uiId, { etcNumber: e.target.value })}
            />
            <Input
              className="col-span-3"
              label="備註"
              value={p.notes}
              onChange={(e) => updateParking(p._uiId, { notes: e.target.value })}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="col-span-1 text-red-500 hover:bg-red-50"
              onClick={() => removeParking(p._uiId)}
              aria-label="刪除車位綁定"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );

  const carRows = parkings.filter((p) => p.type === 'car');
  const motoRows = parkings.filter((p) => p.type === 'motorcycle');

  return (
    <div className="space-y-5">
      {/* 汽車位 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700">
            汽車位（resident_parking + parking_spots.type='car'）
          </h3>
          <Button type="button" variant="secondary" size="sm" onClick={() => addParking('car')}>
            <Plus className="w-3.5 h-3.5 mr-1" /> 新增汽車位
          </Button>
        </div>
        {carRows.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-4 bg-white/40 rounded">
            尚無汽車位
          </div>
        ) : (
          renderParkingRows(carRows, carSpots)
        )}
      </div>

      {/* 機車位 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700">
            機車位（resident_parking + parking_spots.type='motorcycle'）
          </h3>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => addParking('motorcycle')}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> 新增機車位
          </Button>
        </div>
        {motoRows.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-4 bg-white/40 rounded">
            尚無機車位
          </div>
        ) : (
          renderParkingRows(motoRows, motoSpots)
        )}
      </div>

      {/* 磁扣 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700">
            磁扣（resident_keycards）
          </h3>
          <Button type="button" variant="secondary" size="sm" onClick={addKeycard}>
            <Plus className="w-3.5 h-3.5 mr-1" /> 新增磁扣
          </Button>
        </div>
        {keycards.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-4 bg-white/40 rounded">
            尚無磁扣
          </div>
        ) : (
          <div className="space-y-2">
            {keycards.map((k) => (
              <div
                key={k._uiId}
                className="grid grid-cols-12 gap-2 bg-white/70 p-2 rounded items-end"
              >
                <Input
                  className="col-span-4"
                  label="名稱"
                  value={k.name}
                  onChange={(e) => updateKeycard(k._uiId, { name: e.target.value })}
                  placeholder="大門 / 信箱 / ..."
                />
                <Input
                  className="col-span-4"
                  label="卡號"
                  value={k.cardNumber}
                  onChange={(e) => updateKeycard(k._uiId, { cardNumber: e.target.value })}
                  required
                />
                <Input
                  className="col-span-3"
                  label="備註"
                  value={k.notes}
                  onChange={(e) => updateKeycard(k._uiId, { notes: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="col-span-1 text-red-500 hover:bg-red-50"
                  onClick={() => removeKeycard(k._uiId)}
                  aria-label="刪除磁扣"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <p className="mt-1 text-xs text-gray-400">
          註：resident_keycards 表沒有 name 欄位，「名稱」只作 UI 顯示用，不會寫入 DB
        </p>
      </div>
    </div>
  );
}

interface DecorationTabProps {
  decorations: DecorationRow[];
  addDecoration: () => void;
  removeDecoration: (uiId: string) => void;
  updateDecoration: (uiId: string, patch: Partial<DecorationRow>) => void;
}

function DecorationTab({
  decorations,
  addDecoration,
  removeDecoration,
  updateDecoration,
}: DecorationTabProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">
          裝潢記錄（decoration_records）
        </h3>
        <Button type="button" variant="secondary" size="sm" onClick={addDecoration}>
          <Plus className="w-3.5 h-3.5 mr-1" /> 新增裝潢記錄
        </Button>
      </div>

      {decorations.length === 0 && (
        <div className="text-sm text-gray-400 text-center py-8 bg-white/40 rounded">
          尚無裝潢記錄（點「新增裝潢記錄」開始記錄）
        </div>
      )}

      <div className="space-y-3">
        {decorations.map((d) => (
          <div key={d._uiId} className="bg-white/70 p-4 rounded space-y-3">
            <div className="grid grid-cols-12 gap-3">
              <Input
                className="col-span-3"
                label="裝潢名稱"
                value={d.name}
                onChange={(e) => updateDecoration(d._uiId, { name: e.target.value })}
                required
                placeholder="e.g., 客廳整修"
              />
              <Input
                className="col-span-3"
                label="開始日期"
                type="date"
                value={d.startDate}
                onChange={(e) => updateDecoration(d._uiId, { startDate: e.target.value })}
              />
              <Input
                className="col-span-3"
                label="結束日期"
                type="date"
                value={d.endDate}
                onChange={(e) => updateDecoration(d._uiId, { endDate: e.target.value })}
              />
              <Input
                className="col-span-3"
                label="退裝潢日期"
                type="date"
                value={d.removalDate}
                onChange={(e) => updateDecoration(d._uiId, { removalDate: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  開始圖片
                </label>
                <ImageUpload
                  value={d.startImage}
                  onChange={(v) => updateDecoration(d._uiId, { startImage: v })}
                  uploadTable="decoration_records"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  退裝潢圖片
                </label>
                <ImageUpload
                  value={d.removalImage}
                  onChange={(v) => updateDecoration(d._uiId, { removalImage: v })}
                  uploadTable="decoration_records"
                />
              </div>
            </div>

            <div className="flex gap-2 items-end">
              <Input
                className="flex-1"
                label="備註"
                value={d.notes}
                onChange={(e) => updateDecoration(d._uiId, { notes: e.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-red-500 hover:bg-red-50"
                onClick={() => removeDecoration(d._uiId)}
                aria-label="刪除裝潢記錄"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
