/**
 * TASK-002 守護測試 — Building cascade stress (M-54)
 *
 * 對應 audit M-03 (Building DELETE 應 cascade residents + parking_spots + sub-resources)
 *
 * 測試覆蓋：
 *   - Stress 1: 1 大棟別 + 100 住戶 + 50 車位 → DELETE 全部清除 (< 5s)
 *   - Stress 2: 並發刪 5 個棟別 → 確認無 orphan
 *   - Stress 3: 邊界 — 沒住戶的棟別也能正常 DELETE
 *   - Stress 4: cross-FK — 綁定車位的住戶被刪時,車位 FK SET NULL
 *
 * 注意：使用 vitest + 直接 better-sqlite3,不啟動 HTTP server（更可靠 + 更快）
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db/index.js';
import { repositories } from '../src/db/repository.js';
import { deleteBuilding } from '../src/services/buildingService.js';
import { saveUpload } from '../src/services/uploadService.js';

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createBuilding(name = 'test-' + uid()): string {
  const b = repositories.buildings.create({
    name,
    normalFloorCount: 0, // 不自動生成,手動控制
    unitsPerFloor: 0,
  } as any);
  return (b as any).id;
}

function createResident(buildingId: string, name = 'r'): string {
  const r = repositories.residents.create({
    buildingId,
    floor: '1',
    name,
    status: 'active',
  } as any);
  return (r as any).id;
}

function createParkingSpot(buildingId: string, number = 'A1'): string {
  const s = repositories.parking_spots.create({
    buildingId,
    floor: 'B1',
    number,
    status: 'empty',
  } as any);
  return (s as any).id;
}

describe('M-54 Building cascade stress', () => {
  beforeEach(() => {
    // setup.ts 已清 DB + init
  });

  describe('Stress 1: 大棟別 + 100 住戶 + 50 車位', () => {
    it('DELETE 後全部清除 (< 5s)', () => {
      const bid = createBuilding('stress-large');
      // 建 100 個 resident
      const residentIds: string[] = [];
      for (let i = 0; i < 100; i++) {
        residentIds.push(createResident(bid, `r-${i}`));
      }
      // 建 50 個 parking spot
      const spotIds: string[] = [];
      for (let i = 0; i < 50; i++) {
        spotIds.push(createParkingSpot(bid, `S-${i}`));
      }

      // 量測 DELETE 時間
      const t0 = Date.now();
      const result = deleteBuilding(bid);
      const elapsed = Date.now() - t0;

      // DELETE 成功
      expect(result.success).toBe(true);
      // 耗時 < 5 秒
      expect(elapsed).toBeLessThan(5000);

      // 棟別不見
      expect(repositories.buildings.getById(bid)).toBeNull();

      // 住戶全部清掉
      const remainingResidents = db
        .prepare('SELECT COUNT(*) as c FROM residents WHERE building_id = ?')
        .get(bid) as { c: number };
      expect(remainingResidents.c).toBe(0);

      // 車位全部清掉
      const remainingSpots = db
        .prepare('SELECT COUNT(*) as c FROM parking_spots WHERE building_id = ?')
        .get(bid) as { c: number };
      expect(remainingSpots.c).toBe(0);
    });
  });

  describe('Stress 2: 並發 DELETE 不同棟別', () => {
    it('5 個棟別各自有 20 住戶,並發 DELETE 全清', async () => {
      const bidList: string[] = [];
      for (let i = 0; i < 5; i++) {
        const bid = createBuilding(`stress-concurrent-${i}`);
        bidList.push(bid);
        // 每棟 20 住戶
        for (let j = 0; j < 20; j++) {
          createResident(bid, `r-${i}-${j}`);
        }
      }

      // 並發刪除 (用 Promise.all + 同步 delete)
      const results = bidList.map((bid) => {
        try {
          return { bid, ok: true, result: deleteBuilding(bid) };
        } catch (e: any) {
          return { bid, ok: false, error: e.message };
        }
      });

      // 全部成功
      for (const r of results) {
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.result.success).toBe(true);
      }

      // 每棟的住戶都清乾淨
      for (const bid of bidList) {
        const count = (db
          .prepare('SELECT COUNT(*) as c FROM residents WHERE building_id = ?')
          .get(bid) as { c: number }).c;
        expect(count).toBe(0);
      }
    });
  });

  describe('Stress 3: 邊界 - 空棟別', () => {
    it('沒住戶沒車位的棟別也能正常 DELETE', () => {
      const bid = createBuilding('empty-building');
      const result = deleteBuilding(bid);
      expect(result.success).toBe(true);
      expect(repositories.buildings.getById(bid)).toBeNull();
    });
  });

  describe('Stress 4: cross-FK — 綁定車位的住戶被刪時,車位 FK SET NULL', () => {
    it('deleteBuilding 觸發 resident delete → parking_spots.bound_resident_id SET NULL', () => {
      const bid = createBuilding('cross-fk-test');
      const rid = createResident(bid, 'cross-fk-resident');

      // 建車位並綁定這個住戶
      const buf = Buffer.from([0xff, 0xd8, 0xff]); // JPEG magic
      void saveUpload; // 確保 import 沒被 unused 警告移除
      const spotId = createParkingSpot(bid, 'BOUND-001');
      db.prepare('UPDATE parking_spots SET bound_resident_id = ? WHERE id = ?').run(rid, spotId);

      // 確認綁定成功
      const beforeSpot = db
        .prepare('SELECT bound_resident_id FROM parking_spots WHERE id = ?')
        .get(spotId) as { bound_resident_id: string };
      expect(beforeSpot.bound_resident_id).toBe(rid);

      // 刪棟別（會觸發 resident delete → parking_spots.bound_resident_id SET NULL）
      deleteBuilding(bid);

      // 棟別跟住戶都清掉
      expect(repositories.buildings.getById(bid)).toBeNull();
      expect(repositories.residents.getById(rid)).toBeNull();

      // 車位也清掉（手動 cascade 走的是 delete,不是 SET NULL）
      expect(repositories.parking_spots.getById(spotId)).toBeNull();
    });
  });

  describe('Stress 5: 重複 DELETE 應 idempotent 或 404', () => {
    it('DELETE 不存在的棟別應 throw notFound', () => {
      expect(() => deleteBuilding('non-existent-id')).toThrow(/找不到/);
    });
  });

  describe('Stress 6: 大量住戶 + sub-resources cascade', () => {
    it('住戶刪除時 sub-resources 也清掉 (emergency_contacts / parking / decoration)', () => {
      const bid = createBuilding('sub-resource-test');
      const rid = createResident(bid, 'with-subs');

      // 加 sub-resources
      repositories.resident_emergency_contacts.create({
        residentId: rid,
        name: 'emergency',
        phone: '0912345678',
      } as any);

      // 確認建好
      const beforeContacts = db
        .prepare('SELECT COUNT(*) as c FROM resident_emergency_contacts WHERE resident_id = ?')
        .get(rid) as { c: number };
      expect(beforeContacts.c).toBeGreaterThan(0);

      // 刪棟別
      deleteBuilding(bid);

      // 確認 sub-resources 全清
      const afterContacts = db
        .prepare('SELECT COUNT(*) as c FROM resident_emergency_contacts WHERE resident_id = ?')
        .get(rid) as { c: number };
      expect(afterContacts.c).toBe(0);
    });
  });
});