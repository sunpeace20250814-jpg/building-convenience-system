/**
 * Server Database Initialization
 *
 * AI 友善說明：
 * - 啟動時自動建立所有表 + 索引
 * - 自動插入預設狀態（V4 + V1 兩套並存，向後相容）
 * - 預設費用類別（用 try/catch 處理 UNIQUE 衝突）
 *
 * 升級時的注意：
 * - 新增表：用 CREATE TABLE IF NOT EXISTS 確保冪等
 * - 新增欄位：用 ALTER TABLE（better-sqlite3 對 ALTER 支援完善）
 * - 降級：不支援自動降級，請手動備份 + 重灌
 */

import Database from 'better-sqlite3';
import type { Database as DBType } from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import {
  SCHEMA_SQL,
  DEFAULT_STATUSES,
  V1_DEFAULT_PARKING_STATUSES,
  V1_DEFAULT_HOUSE_STATUSES,
  V1_DEFAULT_EXPENSE_CATEGORIES,
  ALL_TABLES,
  TableName,
} from './schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// AI 友善：DATA_DIR 可由環境變數覆蓋，預設 <repo>/server/data
// Docker 部署時可設 DATA_DIR=/data 把 SQLite 檔案掛到 volume
export const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'resident-system.db');

// 確保資料目錄存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const db: DBType = new Database(DB_PATH);
db.pragma('journal_mode = WAL'); // 提升並發讀寫效能
db.pragma('foreign_keys = ON'); // 啟用 FK 約束

/**
 * 檢查表是否已存在某欄位
 */
function hasColumn(table: string, column: string): boolean {
  try {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    return cols.some(c => c.name === column);
  } catch {
    return false;
  }
}

/**
 * 補欄位（idempotent）：用戶 .db 是 2026-06-24 從 sql.js 救援重建的，當時
 * holidays 表沒有 category_id / color / notes / created_at / updated_at，
 * 用 CREATE TABLE IF NOT EXISTS 跳過。所以需要在 schema 建立後補欄位。
 */
function ensureHolidaysColumns(): void {
  const migrations: Array<[string, string]> = [
    ['holidays', 'category_id TEXT REFERENCES holiday_categories(id) ON DELETE SET NULL'],
    ['holidays', 'color TEXT'],
    ['holidays', 'notes TEXT'],
    ['holidays', 'created_at TEXT NOT NULL DEFAULT ""'],
    ['holidays', 'updated_at TEXT NOT NULL DEFAULT ""'],
  ];
  for (const [table, colOrIdx] of migrations) {
    const colName = colOrIdx.split(' ')[0];
    if (table === 'holidays' && hasColumn('holidays', colName)) continue;
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${colOrIdx}`);
      console.log(`  migration: ALTER TABLE ${table} ADD COLUMN ${colName}`);
    } catch (e: any) {
      // 已存在會報 duplicate column，忽略
      if (!String(e?.message ?? e).includes('duplicate column')) throw e;
    }
  }
  // 索引（欄位補完才能建；IF NOT EXISTS 自動跳過）
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_holidays_category ON holidays(category_id)`);
  } catch (e: any) {
    if (!String(e?.message ?? e).includes('already exists')) throw e;
  }
}

/**
 * 排班去重：每個員工每天每個 shift 只能排一次
 * 用 CREATE UNIQUE INDEX（SQLite 不支援 ALTER TABLE ADD CONSTRAINT）
 * 對現有重複資料會失敗 → 建議先用 query 確認再建立
 */
function ensureScheduleUniqueConstraint(): void {
  try {
    // 先檢查現有重複
    const dups = db
      .prepare(
        `SELECT date, shift_id, assignee_id, COUNT(*) AS cnt
         FROM schedule_entries
         WHERE assignee_id IS NOT NULL
         GROUP BY date, shift_id, assignee_id
         HAVING cnt > 1`
      )
      .all() as Array<{ cnt: number }>;
    if (dups.length > 0) {
      console.log(`  schedule: 發現 ${dups.length} 筆重複排班，UNIQUE constraint 未建立（請先清理）`);
      return;
    }
    db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_unique
       ON schedule_entries(date, shift_id, assignee_id)
       WHERE assignee_id IS NOT NULL`
    );
    console.log('  migration: schedule_entries UNIQUE constraint 已建立');
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg.includes('already exists')) return;
    console.log('  schedule UNIQUE migration failed:', msg);
  }
}

/**
 * Residents 表加欄位（M-11 修復）
 */
function ensureResidentsColumns(): void {
  const migrations: Array<[string, string]> = [
    ['residents', 'owner_address TEXT'],
    ['residents', 'delivery_date TEXT'],
  ];
  for (const [table, colOrIdx] of migrations) {
    const colName = colOrIdx.split(' ')[0];
    if (hasColumn('residents', colName)) continue;
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${colOrIdx}`);
      console.log(`  migration: ALTER TABLE ${table} ADD COLUMN ${colName}`);
    } catch (e: any) {
      if (!String(e?.message ?? e).includes('duplicate column')) throw e;
    }
  }
}

/**
 * Buildings 表加欄位（M-12 修復）
 * - 原本 client 送 unitsPerFloor / unitArea / unitNamePattern 都被 silent drop
 * - 加欄位後 client 設定才會被持久化
 */
function ensureBuildingsColumns(): void {
  const migrations: Array<[string, string]> = [
    ['buildings', 'units_per_floor INTEGER DEFAULT 4'],
    ['buildings', 'unit_area REAL DEFAULT 30'],
    ['buildings', 'unit_name_pattern TEXT DEFAULT \'{building}-{floor}F-{unit}\''],
  ];
  for (const [table, colOrIdx] of migrations) {
    const colName = colOrIdx.split(' ')[0];
    if (hasColumn(table, colName)) continue;
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${colOrIdx}`);
      console.log(`  migration: ALTER TABLE ${table} ADD COLUMN ${colName}`);
    } catch (e: any) {
      if (!String(e?.message ?? e).includes('duplicate column')) throw e;
    }
  }
}

/**
 * parking_spots.bound_resident_id 加 FK 約束（M-10 修復）
 *
 * 背景：parking_spots 同時有 `resident_id`（V3 舊欄位）+ `bound_resident_id`（V4 唯一使用）。
 * V4 邏輯只寫 bound_resident_id，但 FK 約束缺失導致：
 *   - 刪住戶後 parking_spots 還指向不存在住戶（孤兒）
 *   - 兩個欄位同步問題難以察覺
 *
 * 修法：
 *   1. 為 bound_resident_id 加 FK CASCADE — 刪住戶自動清綁定
 *   2. 把現有 `resident_id` 資料 migrate 到 `bound_resident_id`（如果後者為空）
 *   3. resident_id 保留但不建議使用，未來會 drop
 */
function ensureParkingSpotsFK(): void {
  // 1. 把資料從舊 resident_id migrate 到 bound_resident_id
  const orphanOldBindings = db
    .prepare(
      `UPDATE parking_spots
       SET bound_resident_id = resident_id
       WHERE resident_id IS NOT NULL
         AND (bound_resident_id IS NULL OR bound_resident_id = '')`
    )
    .run();
  if (orphanOldBindings.changes > 0) {
    console.log(
      `  migration: parking_spots — ${orphanOldBindings.changes} old resident_id → bound_resident_id`,
    );
  }

  // 2. 嘗試加 FK 約束（SQLite 不支援 ALTER TABLE ADD CONSTRAINT，所以重建表）
  // 檢查現有 FK 是否已存在
  const fkList = db
    .prepare(`SELECT * FROM pragma_foreign_key_list('parking_spots')`)
    .all() as Array<{ from: string }>;
  const hasBoundFK = fkList.some((fk) => fk.from === 'bound_resident_id');

  if (!hasBoundFK) {
    try {
      db.exec(`PRAGMA foreign_keys = OFF`);
      db.exec(`
        CREATE TABLE parking_spots_new (
          id TEXT PRIMARY KEY,
          building_id TEXT,
          floor TEXT NOT NULL,
          number TEXT NOT NULL,
          space TEXT,
          status TEXT NOT NULL DEFAULT 'empty',
          status_id TEXT,
          resident_id TEXT,
          bound_resident_id TEXT,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE,
          FOREIGN KEY (bound_resident_id) REFERENCES residents(id) ON DELETE SET NULL
        )
      `);
      db.exec(`
        INSERT INTO parking_spots_new
        SELECT id, building_id, floor, number, space, status, status_id,
               resident_id, bound_resident_id, notes, created_at, updated_at
        FROM parking_spots
      `);
      db.exec(`DROP TABLE parking_spots`);
      db.exec(`ALTER TABLE parking_spots_new RENAME TO parking_spots`);
      // 重建索引
      db.exec(`CREATE INDEX IF NOT EXISTS idx_parking_resident ON parking_spots(resident_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_parking_status ON parking_spots(status)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_parking_bound_resident ON parking_spots(bound_resident_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_parking_building ON parking_spots(building_id)`);
      console.log('  migration: parking_spots FK CASCADE 已建立 (bound_resident_id)');
    } catch (e: any) {
      console.log('  parking_spots FK migration failed:', String(e?.message ?? e));
    } finally {
      db.exec(`PRAGMA foreign_keys = ON`);
    }
  }
}

/**
 * 初始化資料庫
 * - 建立所有表 + 索引
 * - 跑 idempotent migration（補舊 .db 缺欄位）
 * - 插入預設資料
 */
export function initDatabase(): void {
  db.exec(SCHEMA_SQL);
  ensureHolidaysColumns();
  ensureScheduleUniqueConstraint();
  ensureResidentsColumns();
  ensureBuildingsColumns();
  ensureParkingSpotsFK();

  // V4 預設 status_options
  const insertLegacyStatus = db.prepare(`
    INSERT OR IGNORE INTO status_options (id, type, label, color, sort_order)
    VALUES (@id, @type, @label, @color, @sort_order)
  `);
  for (const s of DEFAULT_STATUSES) {
    insertLegacyStatus.run(s);
  }

  // V1 house_statuses（細分版）
  const insertHouseStatus = db.prepare(`
    INSERT OR IGNORE INTO house_statuses (id, label, color, sort_order, is_working)
    VALUES (?, ?, ?, ?, 1)
  `);
  for (const s of V1_DEFAULT_HOUSE_STATUSES) {
    insertHouseStatus.run(s.id, s.label, s.color, s.sort_order);
  }

  // V1 parking_statuses（細分版）
  const insertParkingStatus = db.prepare(`
    INSERT OR IGNORE INTO parking_statuses (id, label, color, sort_order)
    VALUES (?, ?, ?, ?)
  `);
  for (const s of V1_DEFAULT_PARKING_STATUSES) {
    insertParkingStatus.run(s.id, s.label, s.color, s.sort_order);
  }

  // V1 預設費用類別
  const insertCategory = db.prepare(`
    INSERT OR IGNORE INTO expense_categories (id, name, type, color, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const c of V1_DEFAULT_EXPENSE_CATEGORIES) {
    insertCategory.run(`cat-${c.name}`, c.name, c.type, c.color, c.sort_order);
  }

  console.log('資料庫初始化完成');
  console.log(`  資料表：${ALL_TABLES.length} 個`);
  console.log(`  位置：${DB_PATH}`);
}

/**
 * 健康檢查 — 回傳資料庫狀態供 /api/health 使用
 */
export function healthCheck(): {
  ok: boolean;
  tables: number;
  sizeBytes: number;
  location: string;
} {
  const tables = db
    .prepare("SELECT COUNT(*) as c FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .get() as { c: number };
  const sizeBytes = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0;
  return {
    ok: true,
    tables: tables.c,
    sizeBytes,
    location: DB_PATH,
  };
}

export { ALL_TABLES };
export type { TableName };