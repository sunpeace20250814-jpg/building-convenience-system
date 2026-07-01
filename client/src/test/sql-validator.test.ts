/**
 * SQL 安全驗證器測試
 * 確保 AI 不能透過 SQL 注入破壞資料
 */

import { describe, it, expect } from 'vitest';
import { validateSQL, executeSafeQuery } from '@/ai/sql-executor';

describe('SQL Validator', () => {
  describe('validateSQL - 基本 SELECT 查詢', () => {
    it('允許簡單 SELECT', () => {
      const r = validateSQL('SELECT * FROM residents');
      expect(r.valid).toBe(true);
      expect(r.normalizedSQL).toContain('LIMIT');
    });

    it('允許帶條件的 SELECT', () => {
      const r = validateSQL("SELECT * FROM residents WHERE floor = '3F'");
      expect(r.valid).toBe(true);
    });

    it('自動加 LIMIT 沒有的查詢', () => {
      const r = validateSQL('SELECT * FROM residents');
      expect(r.normalizedSQL).toMatch(/LIMIT\s+\d+/i);
    });

    it('保留已有的 LIMIT', () => {
      const r = validateSQL('SELECT * FROM residents LIMIT 50');
      expect(r.normalizedSQL).toMatch(/LIMIT\s+50/i);
    });

    it('支援 WITH 子句', () => {
      const r = validateSQL('WITH cte AS (SELECT * FROM residents) SELECT * FROM cte');
      expect(r.valid).toBe(true);
    });
  });

  describe('validateSQL - 拒絕危險操作', () => {
    it('拒絕 INSERT', () => {
      const r = validateSQL("INSERT INTO residents (id, name) VALUES ('x', 'y')");
      expect(r.valid).toBe(false);
      expect(r.error).toContain('SELECT');
    });

    it('拒絕 UPDATE', () => {
      const r = validateSQL("UPDATE residents SET name = 'hacked'");
      expect(r.valid).toBe(false);
    });

    it('拒絕 DELETE', () => {
      const r = validateSQL("DELETE FROM residents");
      expect(r.valid).toBe(false);
    });

    it('拒絕 DROP', () => {
      const r = validateSQL("DROP TABLE residents");
      expect(r.valid).toBe(false);
    });

    it('拒絕 PRAGMA（防止繞過安全限制）', () => {
      const r = validateSQL("PRAGMA foreign_keys = OFF");
      expect(r.valid).toBe(false);
    });

    it('拒絕 ATTACH（防止附加外部 DB）', () => {
      const r = validateSQL("ATTACH DATABASE 'evil.db' AS evil");
      expect(r.valid).toBe(false);
    });

    it('拒絕多語句（堆疊攻擊）', () => {
      const r = validateSQL("SELECT 1; DROP TABLE residents");
      expect(r.valid).toBe(false);
    });

    it('拒絕 SQL 註解藏指令', () => {
      const r = validateSQL(`
        SELECT * FROM residents; -- 假註解
        DROP TABLE residents
      `);
      expect(r.valid).toBe(false);
    });
  });

  describe('validateSQL - 白名單表', () => {
    it('允許存取 residents', () => {
      const r = validateSQL('SELECT * FROM residents');
      expect(r.valid).toBe(true);
    });

    it('拒絕未在白名單的表', () => {
      const r = validateSQL('SELECT * FROM sqlite_master');
      expect(r.valid).toBe(false);
    });

    it('拒絕 JOIN 到未授權的表', () => {
      const r = validateSQL('SELECT * FROM residents JOIN sqlite_master ON 1=1');
      expect(r.valid).toBe(false);
    });
  });

  describe('executeSafeQuery - 整合', () => {
    it('SQL 錯誤時不丟例外,回傳 ok: false', async () => {
      // M-62:executeSafeQuery 改成 async (server-side fetch)
      const r = await executeSafeQuery('DROP TABLE residents');
      expect(r.ok).toBe(false);
      expect(r.error).toBeDefined();
    });
  });
});
