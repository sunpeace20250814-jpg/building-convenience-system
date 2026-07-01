/**
 * Service — Backup（備份排程）
 *
 * AI 友善說明：
 * - Phase 7 用：每日自動備份（node-cron in server）
 * - Phase 6 先建立 stub + API，讓 UI 可手動觸發備份並寫 backup_history
 *
 * 職責：
 * - 手動觸發備份（createManualBackup）
 * - 列出備份歷史
 * - 刪除備份歷史
 * - Phase 7 將擴充：每日 02:00 自動備份 + 上傳雲端
 */

import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import { repositories } from '../db/repository.js';
import { notFound } from '../db/repository.js';
import { db } from '../db/index.js';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'resident-system.db');
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(DATA_DIR, 'backups');

/** 確保 backup 目錄存在 */
function ensureBackupDir(): void {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

// ============================================================
// Backup History（備份歷史表）
// ============================================================

export interface BackupInput {
  filename: string;
  format: 'db' | 'json' | 'json.gz';
  size: number;
  note?: string;
}

export function listBackupHistory() {
  return repositories.backup_history.getAll('created_at DESC');
}

export function getBackupHistory(id: string) {
  const r = repositories.backup_history.getById(id);
  if (!r) throw notFound('找不到備份紀錄');
  return r;
}

export function recordBackupHistory(input: BackupInput) {
  return repositories.backup_history.create({
    filename: input.filename,
    format: input.format,
    size: input.size,
    note: input.note ?? null,
  });
}

export function deleteBackupHistory(id: string) {
  const ok = repositories.backup_history.delete(id);
  if (!ok) throw notFound('找不到備份紀錄');
  return { success: true };
}

// ============================================================
// 備份執行
// ============================================================

/**
 * 執行 .db 檔案的 SQLite backup（VACUUM INTO）
 * - 安全：使用 SQLite 內建的 VACUUM INTO，產生一致的 snapshot
 * - 不阻塞：better-sqlite3 同步 API
 *
 * @returns 備份檔案的完整路徑
 */
export async function performDbBackup(filename?: string): Promise<{
  filepath: string;
  filename: string;
  size: number;
}> {
  ensureBackupDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const finalFilename = filename ?? `v4-backup-${stamp}.db`;
  const filepath = path.join(BACKUP_DIR, finalFilename);

  // VACUUM INTO 是 SQLite 3.27+ 的官方 backup API
  // 比 backup() API 更簡單且保證一致性
  db.exec(`VACUUM INTO '${filepath.replace(/'/g, "''")}'`);

  const size = fs.statSync(filepath).size;
  return { filepath, filename: finalFilename, size };
}

/**
 * 將整個 .db 透過 better-sqlite3 backup API 備份（更進階，支援 streaming）
 * Phase 7 用：可串接 cloud upload
 */
export async function performStreamingBackup(filename?: string): Promise<{
  filename: string;
  size: number;
}> {
  ensureBackupDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const finalFilename = filename ?? `v4-backup-${stamp}.db`;
  const filepath = path.join(BACKUP_DIR, finalFilename);

  await db.backup(filepath);
  const size = fs.statSync(filepath).size;
  return { filename: finalFilename, size };
}

/**
 * 手動觸發備份（API 給使用者按鈕用）
 * - 備份 .db 檔
 * - 寫入 backup_history 表
 */
export async function createManualBackup(note?: string): Promise<{
  id: string;
  filename: string;
  size: number;
  format: string;
  createdAt: string;
}> {
  const result = await performDbBackup();
  const record = repositories.backup_history.create({
    filename: result.filename,
    format: 'db',
    size: result.size,
    note: note ?? 'manual backup',
  });
  const rec = record as Record<string, unknown>;
  return {
    id: String(rec.id ?? ''),
    filename: String(rec.filename ?? ''),
    size: Number(rec.size ?? 0),
    format: String(rec.format ?? 'db'),
    createdAt: String(rec.createdAt ?? ''),
  };
}

// ============================================================
// 匯出 JSON（給資料遷移 / 雲端上傳用）
// ============================================================

/**
 * 將整個 DB 匯出成 JSON（給跨裝置同步用）
 * - 輸出 zip 包含 .db + manifest.json
 */
export async function exportZipBackup(filename?: string): Promise<{
  filename: string;
  size: number;
}> {
  ensureBackupDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const finalFilename = filename ?? `v4-export-${stamp}.zip`;
  const filepath = path.join(BACKUP_DIR, finalFilename);

  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(filepath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', () => resolve());
    archive.on('error', reject);
    archive.pipe(output);
    archive.file(DB_PATH, { name: 'resident-system.db' });
    archive.file(path.join(DATA_DIR, 'manifest.json'), {
      name: 'manifest.json',
    });
    archive.finalize();
  });

  const size = fs.statSync(filepath).size;
  return { filename: finalFilename, size };
}

// ============================================================
// Phase 7 排程介面（預留）
// ============================================================

export interface BackupScheduleConfig {
  enabled: boolean;
  cron?: string;            // '0 2 * * *' = 每天 02:00
  retentionDays?: number;   // 保留幾天，預設 30
  cloudUpload?: boolean;
}

let currentSchedule: BackupScheduleConfig | null = null;

/** Phase 7 啟動時呼叫，註冊排程 */
export function configureBackupSchedule(config: BackupScheduleConfig): void {
  currentSchedule = config;
}

export function getBackupSchedule(): BackupScheduleConfig | null {
  return currentSchedule;
}
