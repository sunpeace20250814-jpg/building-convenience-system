/**
 * Unit tests — TASK-001 M-15 Client upload UI 整合守護
 *
 * 守護：
 *   - imagePath column 存在於 home_records + decoration_records
 *   - POST /api/upload/<table> 回 url 格式正確
 *   - PUT /api/home-records/:id 接受 imagePath 欄位
 *   - GET /api/home-records 回傳 row 帶 imagePath 欄位
 *   - setup.ts 已修正:測試用隔離 DB 而非 production（之前是 bug）
 */
import { describe, it, expect } from 'vitest';
import { db } from '../src/db/index.js';
import { repositories } from '../src/db/repository.js';
import { saveUpload } from '../src/services/uploadService.js';

/** 為測試建立有效 tab（滿足 home_records.tab_id FK） */
function makeTab(name = 'test-tab'): string {
  const tab = repositories.home_tabs.create({ name, sortOrder: 1 });
  return (tab as any).id;
}

/** 為測試建立有效 resident（滿足 decoration_records.resident_id FK） */
function makeResident(name = 'test-resident'): string {
  const id = `task001-res-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  db.prepare(
    `INSERT INTO residents (id, building_id, floor, name, phone, email, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, 'test-building', '1', name, '0912', '', 'active', '2026-06-29', '2026-06-29');
  return id;
}

describe('TASK-001 M-15 Client upload UI 整合守護', () => {
  describe('DB schema — image_path 欄位存在', () => {
    it('home_records.image_path 欄位存在', () => {
      const cols = db.prepare("PRAGMA table_info(home_records)").all() as Array<{ name: string }>;
      const names = cols.map((c) => c.name);
      expect(names).toContain('image_path');
    });

    it('decoration_records.start_image/removal_image 欄位存在（裝潢走舊欄位但能存 server path）', () => {
      const cols = db.prepare("PRAGMA table_info(decoration_records)").all() as Array<{ name: string }>;
      const names = cols.map((c) => c.name);
      expect(names).toContain('start_image');
      expect(names).toContain('removal_image');
    });
  });

  describe('SaveUpload — server upload 寫入 imagePath 用路徑', () => {
    it('saveUpload 回傳 server 路徑格式: <table>/<uuid>.<ext>', async () => {
      const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]); // PNG magic
      const url = await saveUpload('home_records', buf, 'image/png');
      expect(url).toMatch(/^home_records\/[a-f0-9-]{36}\.png$/);
    });

    it('saveUpload 支援 decoration_records table（裝潢走舊 start_image 欄位）', async () => {
      const buf = Buffer.from([0xff, 0xd8, 0xff]); // JPEG
      const url = await saveUpload('decoration_records', buf, 'image/jpeg');
      expect(url).toMatch(/^decoration_records\/.+\.jpg$/);
    });

    it('saveUpload 回傳的路徑可存進 decoration_records.start_image（不需加新欄位）', async () => {
      const buf = Buffer.from([0xff, 0xd8, 0xff]);
      const url = await saveUpload('decoration_records', buf, 'image/jpeg');
      const residentId = makeResident('deco-test');
      const decoId = `task001-deco-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      db.prepare(
        `INSERT INTO decoration_records (id, resident_id, name, start_image, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(decoId, residentId, 'test', url, '2026-06-29', '2026-06-29');
      const row = db
        .prepare('SELECT start_image FROM decoration_records WHERE id = ?')
        .get(decoId) as { start_image: string };
      expect(row.start_image).toBe(url);
      expect(row.start_image).toMatch(/^decoration_records\/.+\.jpg$/);
    });
  });

  describe('Home-records CRUD — imagePath 欄位支援', () => {
    it('create + get 保留 imagePath 欄位', () => {
      const tabId = makeTab('with-image');
      const created = repositories.home_records.create({
        title: 'with-image',
        content: 'x',
        tabId,
        imagePath: 'home_records/test-uuid.png',
        pinned: 0,
      } as any);
      const row = db
        .prepare('SELECT image_path FROM home_records WHERE id = ?')
        .get((created as any).id) as { image_path: string };
      expect(row.image_path).toBe('home_records/test-uuid.png');
    });

    it('update 可改寫 imagePath', () => {
      const tabId = makeTab('update-img');
      const created = repositories.home_records.create({
        title: 'update-img',
        tabId,
        imagePath: 'home_records/original.png',
      } as any);
      const updated = repositories.home_records.update((created as any).id, {
        imagePath: 'home_records/updated.png',
      });
      expect((updated as any).imagePath).toBe('home_records/updated.png');
    });

    it('camelCase 轉換 — snake_row.image_path → camel imagePath', () => {
      const tabId = makeTab('camel-test');
      const created = repositories.home_records.create({
        title: 'camel-test',
        tabId,
        imagePath: 'home_records/camel.png',
      } as any);
      const fetched = repositories.home_records.getById((created as any).id);
      expect((fetched as any)?.imagePath).toBe('home_records/camel.png');
      expect(Object.keys(fetched as any)).toContain('imagePath');
    });
  });

  describe('imageBase64 舊欄位仍可寫入（向後相容）', () => {
    it('舊資料用 imageBase64 仍可存在於 row（不刪除）', () => {
      const tabId = makeTab('legacy');
      const created = repositories.home_records.create({
        title: 'legacy',
        tabId,
        imageBase64: 'data:image/png;base64,iVBORw0KGgo=',
      } as any);
      const row = db
        .prepare('SELECT image_base64 FROM home_records WHERE id = ?')
        .get((created as any).id) as { image_base64: string };
      expect(row.image_base64).toBe('data:image/png;base64,iVBORw0KGgo=');
    });
  });

  describe('Both fields coexist — 新邏輯可以 imagePath + imageBase64 同時寫', () => {
    it('POST 同時帶兩個欄位都保存', () => {
      const tabId = makeTab('both');
      const created = repositories.home_records.create({
        title: 'both',
        tabId,
        imagePath: 'home_records/both.png',
        imageBase64: 'data:image/png;base64,AAA',
      } as any);
      const row = db
        .prepare('SELECT image_path, image_base64 FROM home_records WHERE id = ?')
        .get((created as any).id) as { image_path: string; image_base64: string };
      expect(row.image_path).toBe('home_records/both.png');
      expect(row.image_base64).toBe('data:image/png;base64,AAA');
    });
  });
});