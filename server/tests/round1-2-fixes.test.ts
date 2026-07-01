/**
 * Unit tests — Round 1+2 修復守護
 * 對應 master bug table：M-05, M-03, M-07, M-04, M-08, M-06, M-11, M-16
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db/index.js';
import { repositories } from '../src/db/repository.js';
import * as buildingService from '../src/services/buildingService.js';
import * as scheduleService from '../src/services/scheduleService.js';

describe('Round 1+2 P0/P1 修復守護', () => {
  beforeEach(() => {
    // setup.ts 已經清 DB + initDatabase + FK ON
  });

  // ============================================================
  // M-08: ORM silent drop (note → notes)
  // ============================================================
  describe('M-08: ORM silent drop note→notes alias', () => {
    it('expense_records: POST with note (singular) writes to notes (plural)', () => {
      const cat = repositories.expense_categories.create({
        name: '測試類別-' + Date.now(),
        type: 'expense',
        color: '#000',
      });
      const e = repositories.expense_records.create({
        date: '2026-12-01',
        type: 'expense',
        amount: 100,
        category: cat.name,
        categoryId: cat.id,
        note: 'singular-test',  // ← 故意送錯單複數
      });
      expect(e.notes).toBe('singular-test');
      expect((e as any).note).toBeUndefined();
      // Direct DB check
      const row = db.prepare('SELECT notes FROM expense_records WHERE id = ?').get(e.id) as any;
      expect(row.notes).toBe('singular-test');
    });

    it('expense_records: POST with notes (plural) still works', () => {
      const cat = repositories.expense_categories.create({
        name: '測試類別-' + Date.now() + 'b',
        type: 'expense',
        color: '#000',
      });
      const e = repositories.expense_records.create({
        date: '2026-12-01',
        type: 'expense',
        amount: 100,
        category: cat.name,
        categoryId: cat.id,
        notes: 'plural-test',
      });
      expect(e.notes).toBe('plural-test');
    });
  });

  // ============================================================
  // M-03: Building cascade (residents/parking_spots)
  // ============================================================
  describe('M-03: Building cascade residents/parking_spots', () => {
    it('deleteBuilding() removes all residents and parking_spots of that building', () => {
      const b = repositories.buildings.create({ name: 'cascade-test-' + Date.now() });
      const f = repositories.floors.create({
        buildingId: b.id, floorLabel: '1F', floorIndex: 1, unitCount: 4,
      });
      const r1 = repositories.residents.create({
        buildingId: b.id, floorId: f.id, floor: '1F', name: 'R1', status: 'normal',
      });
      const r2 = repositories.residents.create({
        buildingId: b.id, floorId: f.id, floor: '1F', name: 'R2', status: 'normal',
      });
      const p = repositories.parking_spots.create({
        buildingId: b.id, number: 'P1', type: 'normal', floor: 'B1',
      });

      buildingService.deleteBuilding(b.id);

      expect(repositories.residents.getById(r1.id)).toBeNull();
      expect(repositories.residents.getById(r2.id)).toBeNull();
      expect(repositories.parking_spots.getById(p.id)).toBeNull();
      expect(repositories.buildings.getById(b.id)).toBeNull();
    });

    it('deleteBuilding() does NOT touch other buildings', () => {
      const b1 = repositories.buildings.create({ name: 'b1-' + Date.now() });
      const b2 = repositories.buildings.create({ name: 'b2-' + Date.now() });
      const f2 = repositories.floors.create({
        buildingId: b2.id, floorLabel: '1F', floorIndex: 1, unitCount: 4,
      });
      const r = repositories.residents.create({
        buildingId: b2.id, floorId: f2.id, floor: '1F', name: 'survive', status: 'normal',
      });

      buildingService.deleteBuilding(b1.id);

      expect(repositories.residents.getById(r.id)).not.toBeNull();
      expect(repositories.buildings.getById(b2.id)).not.toBeNull();
    });
  });

  // ============================================================
  // M-07: Allowance holder.balance recompute on delete tx
  // ============================================================
  describe('M-07: Allowance balance recompute', () => {
    it('刪中間 tx 後 holder.balance 與剩餘 tx sum 一致', () => {
      const h = repositories.allowance_holders.create({ name: 'H-' + Date.now() });
      const t1 = repositories.allowance_transactions.create({
        allowanceId: h.id, date: '2026-11-01', amount: 1000, type: 'add',
        balanceAfter: 1000,
      });
      const t2 = repositories.allowance_transactions.create({
        allowanceId: h.id, date: '2026-11-02', amount: 500, type: 'add',
        balanceAfter: 1500,
      });
      const t3 = repositories.allowance_transactions.create({
        allowanceId: h.id, date: '2026-11-03', amount: 200, type: 'add',
        balanceAfter: 1700,
      });
      repositories.allowance_holders.update(h.id, { balance: 1700 });

      // Simulate the DELETE recompute logic from routes/expenses.ts
      repositories.allowance_transactions.delete(t2.id);
      const remaining = repositories.allowance_transactions.findBy('allowance_id = ?', [h.id], 'date');
      let running = 0;
      for (const tx of remaining) {
        const delta = tx.type === 'add' ? Number(tx.amount) : -Number(tx.amount);
        running += delta;
        repositories.allowance_transactions.update(tx.id as string, { balanceAfter: running });
      }
      repositories.allowance_holders.update(h.id, { balance: running });

      expect(running).toBe(1200);
      const holder = repositories.allowance_holders.getById(h.id);
      expect(holder!.balance).toBe(1200);

      const t1After = repositories.allowance_transactions.getById(t1.id);
      const t3After = repositories.allowance_transactions.getById(t3.id);
      expect(t1After!.balanceAfter).toBe(1000);
      expect(t3After!.balanceAfter).toBe(1200);
    });
  });

  // ============================================================
  // M-06: schedule_entries UNIQUE constraint
  // ============================================================
  describe('M-06: schedule_entries UNIQUE (date, shift, assignee)', () => {
    it('同一 (date, shift, assignee) 第二次 INSERT 應失敗', () => {
      const emp = repositories.employees.create({ name: 'emp-' + Date.now(), role: 'staff' });
      const shift = repositories.shifts.create({
        name: 's-' + Date.now(), color: '#3b82f6',
      });

      repositories.schedule_entries.create({
        date: '2026-12-01', shiftId: shift.id, assigneeId: emp.id,
      });

      expect(() => {
        repositories.schedule_entries.create({
          date: '2026-12-01', shiftId: shift.id, assigneeId: emp.id,
        });
      }).toThrow();
    });

    it('同 (date, shift) 不同 assignee 可以', () => {
      const e1 = repositories.employees.create({ name: 'e1-' + Date.now(), role: 'staff' });
      const e2 = repositories.employees.create({ name: 'e2-' + Date.now(), role: 'staff' });
      const shift = repositories.shifts.create({
        name: 's-' + Date.now(), color: '#3b82f6',
      });

      const s1 = repositories.schedule_entries.create({
        date: '2026-12-01', shiftId: shift.id, assigneeId: e1.id,
      });
      const s2 = repositories.schedule_entries.create({
        date: '2026-12-01', shiftId: shift.id, assigneeId: e2.id,
      });

      expect(s1.id).not.toBe(s2.id);
    });
  });

  // ============================================================
  // M-11: Resident ownerAddress/deliveryDate 持久化
  // ============================================================
  describe('M-11: ownerAddress/deliveryDate 持久化', () => {
    it('POST resident 含 ownerAddress/deliveryDate 應該被 DB 持久化', () => {
      // First ensure owner_address/delivery_date columns exist
      const cols = db.prepare("PRAGMA table_info(residents)").all() as any[];
      const colNames = cols.map(c => c.name);
      expect(colNames).toContain('owner_address');
      expect(colNames).toContain('delivery_date');

      const b = repositories.buildings.create({ name: 'b-' + Date.now() });
      const f = repositories.floors.create({
        buildingId: b.id, floorLabel: '1F', floorIndex: 1, unitCount: 4,
      });
      const r = repositories.residents.create({
        buildingId: b.id, floorId: f.id, floor: '1F', name: 'M11',
        ownerAddress: '台北市中正區測試路100號',
        deliveryDate: '2026-12-15',
        status: 'normal',
      });

      expect(r.ownerAddress).toBe('台北市中正區測試路100號');
      expect(r.deliveryDate).toBe('2026-12-15');

      const fetched = repositories.residents.getById(r.id);
      expect(fetched!.ownerAddress).toBe('台北市中正區測試路100號');
      expect(fetched!.deliveryDate).toBe('2026-12-15');
    });
  });

  // ============================================================
  // M-16: home-tabs DELETE → home_records.tabId SET NULL
  // ============================================================
  describe('M-16: home-tabs DELETE cascade (records.tabId SET NULL)', () => {
    it('刪 home-tab 後該 tab 下的 records 仍在但 tabId=null', () => {
      const tab = repositories.home_tabs.create({
        name: 'tab-' + Date.now(), sortOrder: 1,
      });
      const rec = repositories.home_records.create({
        tabId: tab.id, title: 'cascade-record', content: 'x', date: '2026-12-01',
      });

      expect(rec.tabId).toBe(tab.id);

      repositories.home_tabs.delete(tab.id);

      const after = repositories.home_records.getById(rec.id);
      expect(after).not.toBeNull();          // record 本身還在
      expect(after!.tabId).toBeNull();        // tabId 被 SET NULL
      expect(after!.title).toBe('cascade-record');
    });
  });

  // ============================================================
  // M-04: FK constraint 回 400 not 500
  // ============================================================
  describe('M-04: FK constraint 應 throw 而非 silent fail', () => {
    it('POST resident-emergency-contacts 帶 NONEXISTENT resident_id 應 throw SQLITE_CONSTRAINT', () => {
      expect(() => {
        repositories.resident_emergency_contacts.create({
          residentId: 'nonexistent-id-12345',
          name: 'test',
          phone: '0900000000',
        });
      }).toThrow();
    });

    it('POST resident-parking 帶 NONEXISTENT resident_id 應 throw', () => {
      expect(() => {
        repositories.resident_parking.create({
          residentId: 'nonexistent-id-67890',
          spotNumber: 'P1',
        });
      }).toThrow();
    });

    it('POST decoration-records 帶 NONEXISTENT resident_id 應 throw', () => {
      expect(() => {
        repositories.decoration_records.create({
          residentId: 'nonexistent-id-dec',
          startDate: '2026-12-01',
        });
      }).toThrow();
    });
  });

  // ============================================================
  // M-14: splitMethod='none' 持久化
  // ============================================================
  describe('M-14: splitMethod="none" enum support', () => {
    it('expense_records 應接受 splitMethod="none"', () => {
      const cat = repositories.expense_categories.create({
        name: 'cat-' + Date.now(), type: 'expense', color: '#000',
      });
      const e = repositories.expense_records.create({
        date: '2026-12-01', type: 'expense', amount: 500,
        category: cat.name, categoryId: cat.id,
        splitMethod: 'none',
      });
      expect(e.splitMethod).toBe('none');
    });

    it('expense_records 仍接受 splitMethod="equal"', () => {
      const cat = repositories.expense_categories.create({
        name: 'cat-' + Date.now() + 'b', type: 'expense', color: '#000',
      });
      const e = repositories.expense_records.create({
        date: '2026-12-01', type: 'expense', amount: 500,
        category: cat.name, categoryId: cat.id,
        splitMethod: 'equal',
      });
      expect(e.splitMethod).toBe('equal');
    });
  });

  // ============================================================
  // Employee DELETE cascade (Round 1+2 修的 schedule_entries FK)
  // ============================================================
  describe('scheduleService.deleteEmployee cascade schedule_entries', () => {
    it('刪員工後該員工的 schedule_entries 也被清掉', () => {
      const emp = repositories.employees.create({ name: 'emp-' + Date.now(), role: 'staff' });
      const shift = repositories.shifts.create({ name: 's', color: '#fff' });
      const entry = repositories.schedule_entries.create({
        date: '2026-12-01', shiftId: shift.id, assigneeId: emp.id,
      });

      scheduleService.deleteEmployee(emp.id);

      expect(repositories.employees.getById(emp.id)).toBeNull();
      expect(repositories.schedule_entries.getById(entry.id)).toBeNull();
    });
  });

  // ============================================================
  // M-10: parking_spots.bound_resident_id FK CASCADE (Phase 2 修)
  // ============================================================
  describe('M-10: parking_spots.bound_resident_id FK CASCADE', () => {
    it('刪 resident 後其綁定的 parking_spots.bound_resident_id 自動 SET NULL', () => {
      const b = repositories.buildings.create({ name: 'b-' + Date.now() });
      const f = repositories.floors.create({
        buildingId: b.id, floorLabel: '1F', floorIndex: 1, unitCount: 4,
      });
      const r = repositories.residents.create({
        buildingId: b.id, floorId: f.id, floor: '1F', name: 'R10', status: 'normal',
      });
      const p = repositories.parking_spots.create({
        buildingId: b.id, number: 'P10', type: 'normal', floor: 'B1',
        boundResidentId: r.id,
      });

      repositories.residents.delete(r.id);

      const after = repositories.parking_spots.getById(p.id);
      expect(after).not.toBeNull();
      expect(after!.boundResidentId).toBeNull();  // ← SET NULL by FK
    });
  });

  // ============================================================
  // M-17: home-tabs updateTab in-place (Phase 2 修 — 取代 client 的 delete+create)
  // ============================================================
  describe('M-17: home-tabs PUT in-place update (ID + createdAt preserved)', () => {
    it('updateTab 保留 ID 與 createdAt，不會破壞 FK', () => {
      const tab = repositories.home_tabs.create({
        name: 'orig-name', sortOrder: 1,
      });
      const rec = repositories.home_records.create({
        tabId: tab.id, title: 'child', content: 'x', date: '2026-12-01',
      });
      const originalId = tab.id;
      const originalCreatedAt = tab.createdAt;

      const updated = repositories.home_tabs.update(tab.id, { name: 'new-name' });

      expect(updated).not.toBeNull();
      expect(updated!.id).toBe(originalId);                  // ← ID 保留
      expect(updated!.name).toBe('new-name');
      expect(updated!.createdAt).toBe(originalCreatedAt);   // ← createdAt 保留

      // child record 仍在
      const child = repositories.home_records.getById(rec.id);
      expect(child).not.toBeNull();
      expect(child!.tabId).toBe(tab.id);                    // ← FK 沒被破壞
    });
  });
});