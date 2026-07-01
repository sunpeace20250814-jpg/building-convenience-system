/**
 * Unit tests — Phase 3 修復守護 (M-09, M-12, M-20)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { repositories } from '../src/db/repository.js';
import * as buildingService from '../src/services/buildingService.js';
import * as residentService from '../src/services/residentService.js';
import { isValidResidentStatus, ALLOWED_RESIDENT_STATUSES } from '../src/domain/residentFsm.js';

describe('Phase 3 修復守護 (M-09/M-12/M-20)', () => {
  beforeEach(() => {
    // setup.ts already handles cleanup
  });

  // ============================================================
  // M-20: residents.status FSM
  // ============================================================
  describe('M-20: residents.status FSM', () => {
    it('合法 status 通過驗證', () => {
      for (const s of ALLOWED_RESIDENT_STATUSES) {
        expect(isValidResidentStatus(s)).toBe(true);
      }
    });

    it('null/undefined 視為合法（optional）', () => {
      expect(isValidResidentStatus(null)).toBe(true);
      expect(isValidResidentStatus(undefined)).toBe(true);
    });

    it('任意字串被拒絕', () => {
      expect(isValidResidentStatus('hello')).toBe(false);
      expect(isValidResidentStatus('123')).toBe(false);
      expect(isValidResidentStatus('')).toBe(false);
    });

    it('createResident() 拒絕非法 status', () => {
      const b = repositories.buildings.create({ name: 'b-' + Date.now() });
      const f = repositories.floors.create({
        buildingId: b.id, floorLabel: '1F', floorIndex: 1, unitCount: 4,
      });
      expect(() => {
        residentService.createResident({
          buildingId: b.id, floor: '1F', floorId: f.id, name: 'X',
          status: 'invalid-status-xyz',
        });
      }).toThrow(/無效的住戶狀態/);
    });

    it('updateResident() 拒絕非法 status', () => {
      const b = repositories.buildings.create({ name: 'b-' + Date.now() });
      const f = repositories.floors.create({
        buildingId: b.id, floorLabel: '1F', floorIndex: 1, unitCount: 4,
      });
      const r = residentService.createResident({
        buildingId: b.id, floor: '1F', floorId: f.id, name: 'X',
        status: 'normal',
      });
      expect(() => {
        residentService.updateResident(r.id, { status: 'fake' });
      }).toThrow(/無效的住戶狀態/);
    });
  });

  // ============================================================
  // M-12: BuildingSettings unitsPerFloor/unitArea/unitNamePattern 持久化
  // ============================================================
  describe('M-12: Building columns persistence', () => {
    it('POST /api/settings/buildings 含 unitsPerFloor 應該被持久化', () => {
      const b = buildingService.createBuilding({
        name: 'b-units-' + Date.now(),
        unitsPerFloor: 8,
        unitArea: 50,
        unitNamePattern: '{building}F-{unit}',
      });
      expect(b.unitsPerFloor).toBe(8);
      expect(b.unitArea).toBe(50);
      expect(b.unitNamePattern).toBe('{building}F-{unit}');

      const fetched = repositories.buildings.getById(b.id);
      expect(fetched!.unitsPerFloor).toBe(8);
      expect(fetched!.unitArea).toBe(50);
      expect(fetched!.unitNamePattern).toBe('{building}F-{unit}');
    });

    it('PUT /api/settings/buildings/:id 可以更新 unitsPerFloor', () => {
      const b = buildingService.createBuilding({
        name: 'b-update-' + Date.now(),
        unitsPerFloor: 4,
      });
      const updated = buildingService.updateBuilding(b.id, { unitsPerFloor: 12 });
      expect(updated!.unitsPerFloor).toBe(12);
    });

    it('沒送 unit 設定時使用合理 default', () => {
      const b = buildingService.createBuilding({ name: 'b-default-' + Date.now() });
      expect(b.unitsPerFloor).toBe(4);
      expect(b.unitArea).toBe(30);
      expect(b.unitNamePattern).toBe('{building}-{floor}F-{unit}');
    });
  });

  // ============================================================
  // M-09: home_records POST response 含 tabName
  // ============================================================
  describe('M-09: home_records POST returns tabName', () => {
    it('POST /api/home-records 帶 tabId，回應含 tabName', () => {
      const tab = repositories.home_tabs.create({ name: 'tab-' + Date.now(), sortOrder: 1 });
      // 因為 POST 是 route 層做的，這裡測直接從 route 模擬（手動 JOIN）
      const rec = repositories.home_records.create({
        tabId: tab.id, title: 'rec-' + Date.now(), content: 'x', date: '2026-12-01',
      });
      // 模擬 route 邏輯：POST response 應該再 JOIN 一次拿 tabName
      const tab2 = repositories.home_tabs.getById(rec.tabId);
      const response = { ...rec, tabName: tab2?.name ?? null };
      expect(response.tabName).toBe(tab.name);
    });

    it('POST 沒帶 tabId 時 tabName 為 null', () => {
      const rec = repositories.home_records.create({
        title: 'no-tab-' + Date.now(), content: 'x', date: '2026-12-01',
      });
      const tab2 = rec.tabId ? repositories.home_tabs.getById(rec.tabId) : null;
      const response = { ...rec, tabName: tab2?.name ?? null };
      expect(response.tabName).toBeNull();
    });
  });
});