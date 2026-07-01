/**
 * Server 通用 Repository 層
 *
 * AI 友善說明：
 * - 對齊 client/src/storage/database.ts 的 Repository class
 *   （差別只在底層用 better-sqlite3 而不是 sql.js）
 * - 28 個資料表共用同一套 CRUD：getAll / getById / create / update / delete
 * - 欄位自動 snake_case ↔ camelCase 轉換
 * - 自動補上 created_at / updated_at 時間戳
 * - 用 PRAGMA table_info 內省表結構，無需硬編碼欄位清單
 *
 * 擴充方式：
 * - 新增表：在 schema.ts 加 CREATE TABLE + 加到 ALL_TABLES 即可，無需修改此檔
 * - 新增特殊查詢：在對應 route 檔用 db.prepare() 直接寫，或擴充 Repository 子類別
 *
 * 設計原則：
 * - Repository 接受 camelCase data（與 client 一致），底層轉 snake_case 寫入
 * - Repository 回傳 camelCase row（給 route 直接 JSON 回應）
 * - ID 自動生成；timeStamp 自動填入
 */

import { db } from './index.js';
import { ALL_TABLES, type TableName } from './schema.js';

// ============================================================
// Helper utilities
// ============================================================

/** 產生短隨機 ID */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** 取得現在 ISO 字串 */
export function nowIso(): string {
  return new Date().toISOString();
}

/** snake_case → camelCase */
export function snakeToCamel(s: string): string {
  return s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

/** camelCase → snake_case */
export function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
}

/**
 * 欄位別名：客戶端送錯（單複數差一）時，自動映射到正確欄位
 * 防止 silent drop（M-08）
 *
 * 加新別名時也加到對應的 schema 註解。
 */
const FIELD_ALIASES: Record<string, string> = {
  // expenses.notes 客戶端可能送 'note'（舊 API）
  note: 'notes',
};

/** 將 sqlite 回傳 row 的 keys 全部轉 camelCase */
export function snakeRowToCamel(row: unknown): any {
  if (!row || typeof row !== 'object') return row;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
    if (k.startsWith('_')) continue; // better-sqlite3 internal
    out[snakeToCamel(k)] = v;
  }
  return out;
}

// ============================================================
// 欄位內省（PRAGMA table_info，啟動時快取）
// ============================================================

const COLUMN_CACHE = new Map<TableName, Set<string>>();

/** 取得表的所有欄位名（snake_case），快取在記憶體 */
export function getColumnNames(table: TableName): Set<string> {
  let cols = COLUMN_CACHE.get(table);
  if (cols) return cols;
  const rows = db
    .prepare(`PRAGMA table_info(${table})`)
    .all() as Array<{ name: string }>;
  cols = new Set(rows.map((r) => r.name));
  COLUMN_CACHE.set(table, cols);
  return cols;
}

/** 拋出 404 風格的錯誤物件 */
export function notFound(message = '找不到資源'): { statusCode: number; message: string } {
  return { statusCode: 404, message };
}

/** 拋出 400 風格的錯誤物件 */
export function badRequest(message = '請求參數錯誤'): { statusCode: number; message: string } {
  return { statusCode: 400, message };
}

// ============================================================
// 通用 Repository<T>
// ============================================================

export interface BaseEntity {
  id: string;
  // AI 友善：加索引簽章讓 Partial<T> 可以容納任意欄位
  // 否則嚴格模式下傳 balance / residentId / allowanceId 等都會 TS2353
  [key: string]: unknown;
}

/**
 * 通用 Repository
 *
 * 用法：
 *   const repo = new Repository('residents');
 *   repo.getAll();
 *   repo.create({ buildingId: 'b1', ... });
 */
export class Repository<T extends BaseEntity = BaseEntity> {
  constructor(public table: TableName) {}

  /** 取得所有資料，可指定 ORDER BY 欄位（snake_case） */
  getAll(orderBy = 'id'): T[] {
    const rows = db
      .prepare(`SELECT * FROM ${this.table} ORDER BY ${orderBy}`)
      .all();
    return rows.map(snakeRowToCamel) as T[];
  }

  /** 依 id 取得單筆（找不到回傳 null） */
  getById(id: string): T | null {
    const row = db
      .prepare(`SELECT * FROM ${this.table} WHERE id = ?`)
      .get(id);
    return row ? (snakeRowToCamel(row) as T) : null;
  }

  /** 新增一筆（自動補 id / created_at / updated_at） */
  create(data: Record<string, unknown> | (Partial<T> & { id?: string })): T {
    const now = nowIso();
    const cols = getColumnNames(this.table);
    const hasCreated = cols.has('created_at');
    const hasUpdated = cols.has('updated_at');

    const insertCols: string[] = [];
    const insertVals: unknown[] = [];

    // 1. ID
    const explicitId = (data as { id?: string }).id;
    if (explicitId) {
      insertCols.push('id');
      insertVals.push(explicitId);
    } else {
      insertCols.push('id');
      insertVals.push(generateId());
    }

    // 2. 其他欄位
    for (const [key, value] of Object.entries(data)) {
      if (key === 'id') continue;
      let snake = camelToSnake(key);
      // 套用欄位別名（防止 client 送錯單複數導致 silent drop）
      if (FIELD_ALIASES[snake]) snake = FIELD_ALIASES[snake];
      if (!cols.has(snake)) {
        // 略過未知欄位（不丟例外，避免 client 多送欄位時爆炸）
        continue;
      }
      insertCols.push(snake);
      insertVals.push(value ?? null);
    }

    // 3. 時間戳
    if (hasCreated && !insertCols.includes('created_at')) {
      insertCols.push('created_at');
      insertVals.push(now);
    }
    if (hasUpdated && !insertCols.includes('updated_at')) {
      insertCols.push('updated_at');
      insertVals.push(now);
    }

    const placeholders = insertCols.map(() => '?').join(', ');
    db
      .prepare(
        `INSERT INTO ${this.table} (${insertCols.join(', ')}) VALUES (${placeholders})`,
      )
      .run(...insertVals);

    const newId = insertVals[insertCols.indexOf('id')] as string;
    return this.getById(newId) as T;
  }

  /** 更新一筆（自動補 updated_at；找不到回傳 null） */
  update(id: string, data: Record<string, unknown> | Partial<T>): T | null {
    const existing = this.getById(id);
    if (!existing) return null;

    const cols = getColumnNames(this.table);
    const sets: string[] = [];
    const vals: unknown[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (key === 'id') continue;
      let snake = camelToSnake(key);
      // 套用欄位別名
      if (FIELD_ALIASES[snake]) snake = FIELD_ALIASES[snake];
      if (!cols.has(snake)) continue;
      sets.push(`${snake} = ?`);
      vals.push(value ?? null);
    }

    if (cols.has('updated_at') && !('updatedAt' in data)) {
      sets.push('updated_at = ?');
      vals.push(nowIso());
    }

    if (sets.length === 0) return existing;

    vals.push(id);
    db
      .prepare(`UPDATE ${this.table} SET ${sets.join(', ')} WHERE id = ?`)
      .run(...vals);

    return this.getById(id);
  }

  /** 刪除一筆（找不到回傳 false） */
  delete(id: string): boolean {
    const before = this.getById(id);
    if (!before) return false;
    db.prepare(`DELETE FROM ${this.table} WHERE id = ?`).run(id);
    return true;
  }

  /** 計數 */
  count(where = '1=1', params: unknown[] = []): number {
    const row = db
      .prepare(`SELECT COUNT(*) as c FROM ${this.table} WHERE ${where}`)
      .get(...params) as { c: number };
    return row.c;
  }

  /** 條件查詢（where 子句直接傳，記得用 ? 佔位） */
  findBy(where: string, params: unknown[] = [], orderBy = 'id'): T[] {
    const rows = db
      .prepare(`SELECT * FROM ${this.table} WHERE ${where} ORDER BY ${orderBy}`)
      .all(...params);
    return rows.map(snakeRowToCamel) as T[];
  }

  /** 條件查詢（單筆） */
  findOneBy(where: string, params: unknown[] = []): T | null {
    const row = db
      .prepare(`SELECT * FROM ${this.table} WHERE ${where} LIMIT 1`)
      .get(...params);
    return row ? (snakeRowToCamel(row) as T) : null;
  }
}

// ============================================================
// 28 表 Repository 實例註冊表
// ============================================================

/**
 * 所有表的 Repository 實例集中管理
 *
 * AI 友善：route 檔只需 `import { repositories } from '../db/repository.js'`
 * 然後用 `repositories.floors.getAll()` 之類
 */
export const repositories = {
  status_options: new Repository('status_options'),
  house_statuses: new Repository('house_statuses'),
  parking_statuses: new Repository('parking_statuses'),
  buildings: new Repository('buildings'),
  floors: new Repository('floors'),
  facilities: new Repository('facilities'),
  parking_spots: new Repository('parking_spots'),
  residents: new Repository('residents'),
  resident_members: new Repository('resident_members'),
  resident_keycards: new Repository('resident_keycards'),
  resident_parking: new Repository('resident_parking'),
  resident_emergency_contacts: new Repository('resident_emergency_contacts'),
  decoration_records: new Repository('decoration_records'),
  facility_bookings: new Repository('facility_bookings'),
  expense_categories: new Repository('expense_categories'),
  expense_records: new Repository('expense_records'),
  expense_budget: new Repository('expense_budget'),
  allowance_holders: new Repository('allowance_holders'),
  allowance_records: new Repository('allowance_records'),
  allowance_transactions: new Repository('allowance_transactions'),
  employees: new Repository('employees'),
  shifts: new Repository('shifts'),
  shift_statuses: new Repository('shift_statuses'),
  schedule_entries: new Repository('schedule_entries'),
  schedule_holidays: new Repository('schedule_holidays'),
  schedule_notes: new Repository('schedule_notes'),
  holidays: new Repository('holidays'),
  holiday_categories: new Repository('holiday_categories'),
  calendar_events: new Repository('calendar_events'),
  training_records: new Repository('training_records'),
  home_tabs: new Repository('home_tabs'),
  home_records: new Repository('home_records'),
  backup_history: new Repository('backup_history'),
  // M-55: 會計模組 repository (Sprint 3)
  accounts: new Repository('accounts'),
  journal_entries: new Repository('journal_entries'),
  journal_lines: new Repository('journal_lines'),
  accounting_periods: new Repository('accounting_periods'),
} as const;

// 兼容舊的 named export（既有 route 暫時還在用）
export const statusRepository = repositories.status_options;
export const houseStatusRepository = repositories.house_statuses;
export const parkingStatusRepository = repositories.parking_statuses;
export const buildingRepository = repositories.buildings;
export const floorRepository = repositories.floors;
export const facilityRepository = repositories.facilities;
export const parkingRepository = repositories.parking_spots;
export const residentRepository = repositories.residents;
export const memberRepository = repositories.resident_members;
export const keycardRepository = repositories.resident_keycards;
export const residentParkingRepository = repositories.resident_parking;
export const residentEmergencyContactRepository = repositories.resident_emergency_contacts;
export const decorationRecordRepository = repositories.decoration_records;
export const facilityBookingRepository = repositories.facility_bookings;
export const expenseCategoryRepository = repositories.expense_categories;
export const expenseRepository = repositories.expense_records;
export const expenseBudgetRepository = repositories.expense_budget;
export const allowanceHolderRepository = repositories.allowance_holders;
export const allowanceRecordRepository = repositories.allowance_records;
export const allowanceTransactionRepository = repositories.allowance_transactions;
export const employeeRepository = repositories.employees;
export const shiftRepository = repositories.shifts;
export const shiftStatusRepository = repositories.shift_statuses;
export const scheduleRepository = repositories.schedule_entries;
export const scheduleHolidayRepository = repositories.schedule_holidays;
export const scheduleNoteRepository = repositories.schedule_notes;
export const holidayRepository = repositories.holidays;
export const holidayCategoryRepository = repositories.holiday_categories;
export const calendarEventRepository = repositories.calendar_events;
export const trainingRepository = repositories.training_records;
export const homeTabRepository = repositories.home_tabs;
export const homeRecordRepository = repositories.home_records;
export const backupHistoryRepository = repositories.backup_history;

// ============================================================
// 向後相容：特殊查詢（既有 route 依賴；新程式碼請用 Repository.findBy/findOneBy）
// ============================================================

/** 內部使用：sql 查詢後轉 camelCase */
function queryAllCamel(sql: string, params: unknown[] = []): unknown[] {
  return db.prepare(sql).all(...params).map(snakeRowToCamel);
}

function queryOneCamel(sql: string, params: unknown[] = []): unknown | null {
  const row = db.prepare(sql).get(...params);
  return row ? snakeRowToCamel(row) : null;
}

// 使用 IIFE 形式把舊 API 掛到各 Repository 實例上
// 因為 Repository<T> class 沒有這些方法，用 any cast 繞過型別檢查
type LegacyExt<T> = T & {
  // residents
  search?(query: string): unknown[];
  getByBuilding?(buildingId: string): unknown[];
  // parking_spots
  getByBuilding2?(buildingId: string): unknown[];
  // resident_members / resident_keycards
  getByResidentId?(residentId: string): unknown[];
  // expense_records
  getByDateRange?(startDate: string, endDate: string): unknown[];
  // expense_categories / status_options
  getByType?(type: string): unknown[];
  // employees
  getAllActive?(includeInactive?: boolean): unknown[];
  // holidays
  getByYear?(year: number): unknown[];
  getByDate?(date: string): unknown | null;
  // schedule_entries
  getByDateSR?(date: string): unknown[];
  getByDateRangeSR?(startDate: string, endDate: string): unknown[];
  // allowance_transactions
  getByHolder?(allowanceId: string): unknown[];
  // home_records (join)
  getAllJoin?(): unknown[];
  getByTabJoin?(tabId: string): unknown[];
  getByIdJoin?(id: string): unknown | null;
};

// residents
const residentsExt = residentRepository as LegacyExt<typeof residentRepository>;
residentsExt.search = (q) => {
  const p = `%${q}%`;
  return queryAllCamel(
    `SELECT * FROM residents WHERE owner_name LIKE ? OR renter_name LIKE ? OR phone LIKE ? OR floor LIKE ?`,
    [p, p, p, p],
  );
};
residentsExt.getByBuilding = (bid) =>
  queryAllCamel(
    `SELECT * FROM residents WHERE building_id = ? ORDER BY floor, unit_number`,
    [bid],
  );

// parking_spots
const parkingExt = parkingRepository as LegacyExt<typeof parkingRepository>;
parkingExt.getByBuilding = (bid) =>
  queryAllCamel(
    `SELECT * FROM parking_spots WHERE building_id = ? ORDER BY floor, number`,
    [bid],
  );

// resident_members / keycards
const memberExt = memberRepository as LegacyExt<typeof memberRepository>;
memberExt.getByResidentId = (rid) =>
  queryAllCamel(
    `SELECT * FROM resident_members WHERE resident_id = ? ORDER BY name`,
    [rid],
  );
const keycardExt = keycardRepository as LegacyExt<typeof keycardRepository>;
keycardExt.getByResidentId = (rid) =>
  queryAllCamel(
    `SELECT * FROM resident_keycards WHERE resident_id = ? ORDER BY created_at`,
    [rid],
  );

// expense_records
const expenseExt = expenseRepository as LegacyExt<typeof expenseRepository>;
expenseExt.getByDateRange = (s, e) =>
  queryAllCamel(
    `SELECT * FROM expense_records WHERE date BETWEEN ? AND ? ORDER BY date DESC`,
    [s, e],
  );

// expense_categories
const expCatExt = expenseCategoryRepository as LegacyExt<typeof expenseCategoryRepository>;
expCatExt.getByType = (t) =>
  queryAllCamel(
    `SELECT * FROM expense_categories WHERE type = ? ORDER BY sort_order`,
    [t],
  );

// status_options
const statusExt = statusRepository as LegacyExt<typeof statusRepository>;
statusExt.getByType = (t) =>
  queryAllCamel(
    `SELECT * FROM status_options WHERE type = ? ORDER BY sort_order`,
    [t],
  );

// employees
const employeeExt = employeeRepository as LegacyExt<typeof employeeRepository>;
employeeExt.getAllActive = (includeInactive = false) => {
  if (includeInactive) {
    return queryAllCamel(`SELECT * FROM employees ORDER BY name`);
  }
  return queryAllCamel(`SELECT * FROM employees WHERE is_active = 1 ORDER BY name`);
};
// 既有 route 用的舊 API
(employeeRepository as any).getAll = employeeExt.getAllActive;

// holidays
const holidayExt = holidayRepository as LegacyExt<typeof holidayRepository>;
holidayExt.getByYear = (year) =>
  queryAllCamel(`SELECT * FROM holidays WHERE date LIKE ? ORDER BY date`, [
    `${year}-%`,
  ]);
holidayExt.getByDate = (d) =>
  queryOneCamel(`SELECT * FROM holidays WHERE date = ?`, [d]);

// schedule_entries（join）
const scheduleExt = scheduleRepository as LegacyExt<typeof scheduleRepository>;
scheduleExt.getByDateSR = (d) =>
  queryAllCamel(
    `SELECT se.*, ss.label as shift_label, ss.color as shift_color, e.name as assignee_name
     FROM schedule_entries se
     LEFT JOIN shifts ss ON se.shift_id = ss.id
     LEFT JOIN employees e ON se.assignee_id = e.id
     WHERE se.date = ?
     ORDER BY se.created_at`,
    [d],
  );
scheduleExt.getByDateRangeSR = (s, e) =>
  queryAllCamel(
    `SELECT se.*, ss.label as shift_label, ss.color as shift_color, e.name as assignee_name
     FROM schedule_entries se
     LEFT JOIN shifts ss ON se.shift_id = ss.id
     LEFT JOIN employees e ON se.assignee_id = e.id
     WHERE se.date BETWEEN ? AND ?
     ORDER BY se.date, se.created_at`,
    [s, e],
  );

// allowance_transactions
const allowanceTxExt = allowanceTransactionRepository as LegacyExt<typeof allowanceTransactionRepository>;
allowanceTxExt.getByHolder = (aid) =>
  queryAllCamel(
    `SELECT * FROM allowance_transactions WHERE allowance_id = ? ORDER BY date DESC, created_at DESC`,
    [aid],
  );

// home_records (join home_tabs)
const homeRecExt = homeRecordRepository as LegacyExt<typeof homeRecordRepository>;
homeRecExt.getAllJoin = () =>
  queryAllCamel(
    `SELECT hr.*, ht.name as tab_name
     FROM home_records hr
     LEFT JOIN home_tabs ht ON hr.tab_id = ht.id
     ORDER BY hr.created_at DESC`,
  );
homeRecExt.getByTabJoin = (tid) =>
  queryAllCamel(
    `SELECT hr.*, ht.name as tab_name
     FROM home_records hr
     LEFT JOIN home_tabs ht ON hr.tab_id = ht.id
     WHERE hr.tab_id = ?
     ORDER BY hr.created_at DESC`,
    [tid],
  );
homeRecExt.getByIdJoin = (id) =>
  queryOneCamel(
    `SELECT hr.*, ht.name as tab_name
     FROM home_records hr
     LEFT JOIN home_tabs ht ON hr.tab_id = ht.id
     WHERE hr.id = ?`,
    [id],
  );

// 既有 route 用的舊 API
(homeRecordRepository as any).getAll = homeRecExt.getAllJoin;
(homeRecordRepository as any).getByTab = homeRecExt.getByTabJoin;
(homeRecordRepository as any).getById = homeRecExt.getByIdJoin;
// schedule entries 既有 route 用 .getByDate / .getByDateRange
(scheduleRepository as any).getByDate = scheduleExt.getByDateSR;
(scheduleRepository as any).getByDateRange = scheduleExt.getByDateRangeSR;
(allowanceTransactionRepository as any).getByHolder = allowanceTxExt.getByHolder;

export { ALL_TABLES };
export type { TableName };
