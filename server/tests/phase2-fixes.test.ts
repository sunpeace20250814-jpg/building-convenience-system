/**
 * Unit tests — Phase 2 修復守護 (M-10, M-15, M-17)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db/index.js';
import { repositories } from '../src/db/repository.js';
import {
  saveUpload,
  resolveUploadPath,
  readUploadStream,
  mimeFromExt,
  extFromPath,
} from '../src/services/uploadService.js';
import { promises as fs } from 'fs';
import path from 'path';

describe('Phase 2 修復守護 (M-10/M-15/M-17)', () => {
  beforeEach(() => {
    // setup.ts 已經清 DB + initDatabase
  });

  // ============================================================
  // M-15: Upload service (取代 base64 直存 DB)
  // ============================================================
  describe('M-15: Upload service — 本地檔案系統', () => {
    it('saveUpload 接受 JPEG 寫入 uploads/<table>/<uuid>.jpg', async () => {
      const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0]); // JPEG magic bytes
      const url = await saveUpload('home_records', buf, 'image/jpeg');
      expect(url).toMatch(/^home_records\/.+\.jpg$/);

      const absPath = resolveUploadPath(url);
      const onDisk = await fs.readFile(absPath);
      expect(onDisk).toEqual(buf);
    });

    it('saveUpload 接受 PNG', async () => {
      const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      const url = await saveUpload('home_records', buf, 'image/png');
      expect(url).toMatch(/^home_records\/.+\.png$/);
    });

    it('saveUpload 拒絕不支援的 MIME type', async () => {
      const buf = Buffer.from('not-an-image');
      await expect(
        saveUpload('home_records', buf, 'application/x-exe'),
      ).rejects.toThrow(/不支援的檔案類型/);
    });

    it('saveUpload 寫入到 uploads/<table>/<uuid>.<ext>（不論 table 名是什麼）', async () => {
      const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      const url = await saveUpload('residents', buf, 'image/jpeg');
      expect(url.startsWith('residents/')).toBe(true);
      expect(url.endsWith('.jpg')).toBe(true);
    });

    it('resolveUploadPath 阻擋 .. 路徑穿越攻擊', () => {
      expect(() => resolveUploadPath('../../../etc/passwd')).toThrow(/路徑無效/);
    });

    it('readUploadStream 返回可讀流', async () => {
      const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      const url = await saveUpload('residents', buf, 'image/jpeg');
      const stream = readUploadPath(url);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk as Buffer);
      }
      const result = Buffer.concat(chunks);
      expect(result).toEqual(buf);
    });

    it('mimeFromExt 正確對應', () => {
      expect(mimeFromExt('jpg')).toBe('image/jpeg');
      expect(mimeFromExt('jpeg')).toBe('image/jpeg');
      expect(mimeFromExt('png')).toBe('image/png');
      expect(mimeFromExt('webp')).toBe('image/webp');
      expect(mimeFromExt('svg')).toBe('image/svg+xml');
      expect(mimeFromExt('unknown')).toBe('application/octet-stream');
    });

    it('extFromPath 從 URL path 取副檔名', () => {
      expect(extFromPath('home_records/abc.jpg')).toBe('jpg');
      expect(extFromPath('foo/bar/baz.png')).toBe('png');
      expect(extFromPath('noext')).toBe('bin');
    });
  });

  // ============================================================
  // M-10: parking_spots FK CASCADE 守護（補在 round1-2-fixes.test.ts）
  // 確保 migration 不會被改壞
  // ============================================================
  describe('M-10: parking_spots FK 約束存在', () => {
    it('bound_resident_id FK 約束已建立', () => {
      const fkList = db
        .prepare(`SELECT * FROM pragma_foreign_key_list('parking_spots')`)
        .all() as Array<{ from: string; table: string }>;
      const boundFK = fkList.find((fk) => fk.from === 'bound_resident_id');
      expect(boundFK).toBeDefined();
      expect(boundFK!.table).toBe('residents');
    });
  });
});

// Helper for streaming test (avoid pulling in fs createReadStream types in test)
function readUploadPath(url: string) {
  return readUploadStream(url);
}