/**
 * Upload Service — 本地檔案系統（取代 M-15 base64 直存 DB）
 *
 * 設計：
 *   - 圖片存到 DATA_DIR/uploads/<table>/<id>.<ext>
 *   - DB 只存相對路徑
 *   - GET /api/uploads/* 用 stream 返回圖片
 *
 * 為什麼不上 CDN？
 *   - V4 設計目標是「個人使用、配置低、耗能低、穩定運行數年」
 *   - 上 CDN 需要第三方服務 + 網路依賴 → 違反目標
 *   - 本地檔案系統在 Windows/Linux 都穩定，無外部依賴
 */
import { v4 as uuidv4 } from 'uuid';
import { promises as fs, createReadStream } from 'fs';
import path from 'path';
import { DATA_DIR } from '../db/index.js';

const UPLOAD_ROOT = path.join(DATA_DIR, 'uploads');

/** 副檔名白名單（MIME → ext） */
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

/** 確保 uploads/<table>/ 目錄存在 */
async function ensureDir(table: string): Promise<string> {
  const dir = path.join(UPLOAD_ROOT, table);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * 儲存上傳檔案
 * @param table  哪個業務 table（home_records / residents / decoration_records）
 * @param buffer 檔案內容
 * @param mime   MIME type
 * @returns 存到 DB 的相對路徑，例如 "home_records/abc-123.jpg"
 */
export async function saveUpload(
  table: string,
  buffer: Buffer,
  mime: string,
): Promise<string> {
  const ext = EXT_BY_MIME[mime];
  if (!ext) {
    throw Object.assign(new Error(`不支援的檔案類型: ${mime}`), {
      statusCode: 400,
    });
  }
  const dir = await ensureDir(table);
  const filename = `${uuidv4()}.${ext}`;
  const fullPath = path.join(dir, filename);
  await fs.writeFile(fullPath, buffer);
  // 存到 DB 的路徑：相對於 UPLOAD_ROOT
  return `${table}/${filename}`;
}

/** 解析 DB 路徑 → 絕對檔案路徑 */
export function resolveUploadPath(relPath: string): string {
  // 安全檢查：禁止 ..
  if (relPath.includes('..')) {
    throw Object.assign(new Error('路徑無效'), { statusCode: 400 });
  }
  return path.join(UPLOAD_ROOT, relPath);
}

/** 讀取檔案（給 /api/uploads/:path 路由用） */
export function readUploadStream(relPath: string): NodeJS.ReadableStream {
  return createReadStream(resolveUploadPath(relPath));
}

/** 判斷 MIME from 副檔名 */
export function mimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
  };
  return map[ext.toLowerCase()] ?? 'application/octet-stream';
}

/** 取得檔案副檔名 from 相對路徑 */
export function extFromPath(relPath: string): string {
  const m = relPath.match(/\.([a-z0-9]+)$/i);
  return m ? m[1] : 'bin';
}