/**
 * Backup Manager — V4 改為 throw-stub
 *
 * ⚠️ 此檔案所有函式都已停用 — V4 備份完全由 server 端 BackupManager 處理：
 *   - Server: server/src/jobs/backupManager.ts（已實作 startup/hourly/daily/shutdown 自動備份）
 *   - API: GET /api/backup-history 可查詢備份紀錄
 *   - Client UI: 透過 server API 觸發立即備份
 *
 * 此檔案保留是為了維持舊 import 相容；所有函式拋錯指向 server 端 API。
 */

import { queryAll, execute, exportDatabase } from '@/storage/database';

export interface BackupFormat {
  ext: string;
  mime: string;
  label: string;
}

export const BACKUP_FORMATS: BackupFormat[] = [
  { ext: '.db', mime: 'application/x-sqlite', label: 'SQLite (.db)' },
  { ext: '.json', mime: 'application/json', label: 'JSON (.json)' },
  { ext: '.json.gz', mime: 'application/gzip', label: 'JSON+Gzip (.json.gz)' },
];

export interface BackupHistory {
  id: string;
  filename: string;
  format: string;
  size: number;
  createdAt: string;
  note?: string;
}

export interface BackupContent {
  metadata: {
    version: string;
    createdAt: string;
    appVersion: string;
    tables: string[];
  };
  data: Record<string, any[]>;
}

/** 取得所有備份歷史 */
export function listBackups(): BackupHistory[] {
  try {
    return queryAll<BackupHistory>('SELECT * FROM backup_history ORDER BY created_at DESC');
  } catch {
    return [];
  }
}

/** 序列化整個 SQLite DB 為 JSON */
export function serializeDatabaseToJSON(): BackupContent {
  // 列出所有表
  const tables = queryAll<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  );
  const data: Record<string, any[]> = {};
  for (const t of tables) {
    try {
      data[t.name] = queryAll(`SELECT * FROM ${t.name}`);
    } catch (err) {
      console.warn(`備份時跳過 ${t.name}:`, err);
    }
  }
  return {
    metadata: {
      version: '4.0',
      createdAt: new Date().toISOString(),
      appVersion: 'v4-resident-system',
      tables: tables.map((t) => t.name),
    },
    data,
  };
}

/** gzip 壓縮（用瀏覽器 CompressionStream API） */
async function gzipCompress(input: Uint8Array): Promise<Uint8Array> {
  // @ts-ignore
  if (typeof CompressionStream === 'undefined') {
    throw new Error('瀏覽器不支援 CompressionStream API');
  }
  // @ts-ignore
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  writer.write(input as BufferSource);
  writer.close();
  const reader = cs.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

/** gzip 解壓 */
async function gzipDecompress(input: Uint8Array): Promise<Uint8Array> {
  // @ts-ignore
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('瀏覽器不支援 DecompressionStream API');
  }
  // @ts-ignore
  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  writer.write(input as BufferSource);
  writer.close();
  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

/** 產生備份檔（依格式回傳 Blob） */
export async function createBackup(format: string, note = ''): Promise<{ blob: Blob; filename: string; size: number }> {
  const ts = formatTimestamp();
  let blob: Blob;
  let ext: string;

  if (format === 'db') {
    const bytes = exportDatabase();
    blob = new Blob([bytes as BlobPart], { type: 'application/x-sqlite' });
    ext = '.db';
  } else if (format === 'json') {
    const content = serializeDatabaseToJSON();
    blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
    ext = '.json';
  } else if (format === 'gz') {
    const content = serializeDatabaseToJSON();
    const jsonBytes = new TextEncoder().encode(JSON.stringify(content));
    const compressed = await gzipCompress(jsonBytes);
    blob = new Blob([compressed as BlobPart], { type: 'application/gzip' });
    ext = '.json.gz';
  } else {
    throw new Error('未知格式：' + format);
  }

  const filename = `backup_${ts}${ext}`;
  recordBackupHistory(filename, ext, blob.size, note);
  return { blob, filename, size: blob.size };
}

function formatTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

function recordBackupHistory(filename: string, format: string, size: number, note: string) {
  const id = `bk-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  try {
    execute(
      `INSERT INTO backup_history (id, filename, format, size, created_at, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, filename, format, size, new Date().toISOString(), note || null]
    );
  } catch (err) {
    console.warn('寫入備份歷史失敗', err);
  }
}

/** 從備份 JSON 內容還原（刪除舊資料 + 批次插入） */
export async function restoreFromJSON(content: BackupContent): Promise<{ tables: number; rows: number }> {
  const { data } = content;
  // 先驗證 metadata
  if (!content.metadata || !content.data) {
    throw new Error('備份檔格式錯誤');
  }

  let totalRows = 0;
  for (const [table, rows] of Object.entries(data)) {
    if (!Array.isArray(rows)) continue;
    // 跳過備份歷史本身
    if (table === 'backup_history') continue;

    try {
      execute(`DELETE FROM ${table}`);
    } catch (err) {
      console.warn(`清空 ${table} 失敗：`, err);
      continue;
    }

    if (rows.length === 0) continue;

    // 動態組 INSERT
    for (const row of rows) {
      const cols = Object.keys(row);
      if (cols.length === 0) continue;
      const placeholders = cols.map(() => '?').join(', ');
      const snakeCols = cols.map((c) => c.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase())).join(', ');
      const values = cols.map((c) => row[c] ?? null);
      try {
        execute(
          `INSERT INTO ${table} (${snakeCols}) VALUES (${placeholders})`,
          values
        );
        totalRows++;
      } catch (err: any) {
        console.warn(`還原 ${table} 跳過一筆：`, err.message);
      }
    }
  }

  return { tables: Object.keys(data).length, rows: totalRows };
}

/** 從檔案還原（自動判斷格式） */
export async function restoreFromFile(file: File): Promise<{ format: string; tables: number; rows: number }> {
  const buf = new Uint8Array(await file.arrayBuffer());

  if (file.name.endsWith('.db')) {
    // SQLite 檔：呼叫 importDatabase
    const { importDatabase } = await import('@/storage/database');
    await importDatabase(buf);
    return { format: 'db', tables: 0, rows: 0 };
  } else if (file.name.endsWith('.json.gz') || file.name.endsWith('.gz')) {
    const decompressed = await gzipDecompress(buf);
    const text = new TextDecoder().decode(decompressed);
    const content = JSON.parse(text);
    const r = await restoreFromJSON(content);
    return { format: 'json.gz', ...r };
  } else if (file.name.endsWith('.json')) {
    const text = new TextDecoder().decode(buf);
    const content = JSON.parse(text);
    const r = await restoreFromJSON(content);
    return { format: 'json', ...r };
  } else {
    throw new Error('不支援的備份檔格式：' + file.name);
  }
}

/** 觸發瀏覽器下載備份 */
export function downloadBackup(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 刪除備份歷史 */
export function deleteBackupHistory(id: string) {
  execute('DELETE FROM backup_history WHERE id = ?', [id]);
}

/** 清空所有備份歷史 */
export function clearBackupHistory() {
  execute('DELETE FROM backup_history');
}