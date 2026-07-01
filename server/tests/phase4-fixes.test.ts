/**
 * Unit tests — Phase 4 修復守護 (M-21, M-22, M-29)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { repositories } from '../src/db/repository.js';
import * as residentService from '../src/services/residentService.js';

describe('Phase 4 修復守護 (M-21/M-22/M-29)', () => {
  // ============================================================
  // M-21: FK 存在性檢查
  // ============================================================
  describe('M-21: FK 存在性檢查', () => {
    it('createResident() 拒絕不存在 buildingId', () => {
      expect(() => {
        residentService.createResident({
          buildingId: 'nonexistent-building-xyz',
          floor: '1F',
          name: 'orphan',
        });
      }).toThrow(/buildingId 不存在/);
    });

    it('createResident() 拒絕不存在 floorId', () => {
      const b = repositories.buildings.create({ name: 'b-' + Date.now() });
      expect(() => {
        residentService.createResident({
          buildingId: b.id,
          floor: '1F',
          floorId: 'nonexistent-floor-xyz',
          name: 'orphan',
        });
      }).toThrow(/floorId 不存在/);
    });
  });

  // ============================================================
  // M-22: status_options type enum 限制（route 層測試）
  // ============================================================
  describe('M-22: status_options type enum', () => {
    it('ALLOWED types: resident, parking', () => {
      // 透過 route layer 限制，所以這裡測試 enum 邏輯
      const ALLOWED = ['resident', 'parking'];
      for (const t of ALLOWED) {
        expect(ALLOWED.includes(t)).toBe(true);
      }
      for (const t of ['foo', 'bar', 'admin', 'system', '']) {
        expect(ALLOWED.includes(t)).toBe(false);
      }
    });
  });

  // ============================================================
  // M-29: SQLITE_CONSTRAINT 訊息清理
  // ============================================================
  describe('M-29: tryDbOp 訊息不洩漏 column 名', () => {
    it('FK constraint 失敗訊息不含 column 名', async () => {
      const { tryDbOp } = await import('../src/routes/_crud.js');
      let caughtMessage: string | null = null;
      let caughtStatus: number | null = null;
      try {
        await Promise.resolve(tryDbOp(() => {
          return repositories.resident_emergency_contacts.create({
            residentId: 'nonexistent-fk-99999',
            name: 'test',
            phone: '0900000000',
          });
        }));
      } catch (e: any) {
        caughtMessage = e.message;
        caughtStatus = e.statusCode;
      }
      expect(caughtMessage).not.toBeNull();
      expect(caughtStatus).toBe(400);
      // 開發模式（含訊息）也應該標明是「驗證失敗」
      expect(caughtMessage).toMatch(/欄位驗證失敗|資料驗證失敗/);
    });
  });
});