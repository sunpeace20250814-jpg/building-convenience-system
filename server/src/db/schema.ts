/**
 * Server SQLite Schema
 *
 * AI 友善說明：
 * - 與 client/src/storage/schema.ts 結構對齊
 * - 涵蓋 V1（住戶管理）+ V4（會計、報表）所有表
 * - 表名使用 snake_case，欄位也用 snake_case
 *
 * 修改時注意：
 * - 新增表：同步更新 client/src/storage/schema.ts
 * - 新增欄位：用 ALTER TABLE + DEFAULT，避免破壞現有資料
 * - 索引：FK 欄位必加索引
 */

export const SCHEMA_SQL = `
-- 狀態
CREATE TABLE IF NOT EXISTS status_options (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  color TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS house_statuses (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  color TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  days INTEGER,
  is_working INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS parking_statuses (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  color TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

-- 建築 / 樓層 / 公設
CREATE TABLE IF NOT EXISTS buildings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normal_floor_count INTEGER NOT NULL DEFAULT 0,
  rooftop_floor_count INTEGER DEFAULT 0,
  basement_floor_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS floors (
  id TEXT PRIMARY KEY,
  building_id TEXT NOT NULL,
  floor_label TEXT NOT NULL,
  floor_index INTEGER NOT NULL,
  floor_area REAL,
  unit_area REAL,
  unit_count INTEGER,
  is_basement INTEGER DEFAULT 0,
  is_rooftop INTEGER DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS facilities (
  id TEXT PRIMARY KEY,
  building_id TEXT NOT NULL,
  name TEXT NOT NULL,
  fee REAL DEFAULT 0,
  unit TEXT DEFAULT '月',
  location TEXT,
  status TEXT DEFAULT 'normal',
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE
);

-- V4 擴充：公設借用紀錄
CREATE TABLE IF NOT EXISTS facility_bookings (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  resident_id TEXT,
  resident_name TEXT,
  facility_id TEXT NOT NULL,
  facility_name TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  paid INTEGER DEFAULT 0,
  fee REAL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE SET NULL,
  FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE
);

-- 停車位
CREATE TABLE IF NOT EXISTS parking_spots (
  id TEXT PRIMARY KEY,
  building_id TEXT,
  floor TEXT NOT NULL,
  number TEXT NOT NULL,
  space TEXT,
  type TEXT NOT NULL DEFAULT 'car',
  status TEXT NOT NULL DEFAULT 'empty',
  status_id TEXT,
  resident_id TEXT,
  bound_resident_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 住戶
CREATE TABLE IF NOT EXISTS residents (
  id TEXT PRIMARY KEY,
  property TEXT,
  building_id TEXT NOT NULL,
  floor_id TEXT,
  floor TEXT NOT NULL,
  floor_index INTEGER,
  unit_number TEXT,
  unit_type TEXT DEFAULT 'normal',
  name TEXT NOT NULL,
  owner_name TEXT,
  owner_address TEXT,
  delivery_date TEXT,
  renter_name TEXT,
  phone TEXT,
  email TEXT,
  parking_id TEXT,
  member_count INTEGER DEFAULT 0,
  deposit REAL,
  monthly_rent REAL,
  move_in_date TEXT,
  move_out_date TEXT,
  status_id TEXT,
  status TEXT DEFAULT '正常',
  emergency_contact TEXT,
  emergency_phone TEXT,
  note TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS resident_members (
  id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL,
  name TEXT NOT NULL,
  relation TEXT,
  relationship TEXT,
  phone TEXT,
  id_number TEXT,
  birthdate TEXT,
  note TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS resident_keycards (
  id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL,
  card_number TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE CASCADE
);

-- V4 擴充：住戶 ↔ 車位多對多綁定（取代 residents.parking_id 單一綁定）
CREATE TABLE IF NOT EXISTS resident_parking (
  id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL,
  parking_spot_id TEXT NOT NULL,
  etc_number TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE CASCADE,
  FOREIGN KEY (parking_spot_id) REFERENCES parking_spots(id) ON DELETE CASCADE
);

-- V4 擴充：區權人緊急聯絡人（多筆，取代 residents.emergency_contact 單筆）
CREATE TABLE IF NOT EXISTS resident_emergency_contacts (
  id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  relation TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE CASCADE
);

-- V4 擴充：裝潢記錄（一戶多筆，含開始 / 結束 / 退裝潢 + 圖片）
CREATE TABLE IF NOT EXISTS decoration_records (
  id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL,
  name TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  removal_date TEXT,
  start_image TEXT,
  removal_image TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE CASCADE
);

-- 記帳
CREATE TABLE IF NOT EXISTS expense_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  color TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS expense_records (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT,
  category_id TEXT,
  amount REAL NOT NULL,
  source TEXT,
  paid_by TEXT,
  item TEXT,
  quantity REAL,
  unit_price REAL,
  shared_by TEXT,
  split_method TEXT DEFAULT 'equal',
  participants TEXT,
  description TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expense_budget (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  month TEXT NOT NULL,
  amount REAL NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(category_id, month)
);

CREATE TABLE IF NOT EXISTS allowance_holders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  balance REAL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS allowance_records (
  id TEXT PRIMARY KEY,
  allowance_id TEXT NOT NULL,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  type TEXT NOT NULL,
  balance_after REAL NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (allowance_id) REFERENCES allowance_holders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS allowance_transactions (
  id TEXT PRIMARY KEY,
  allowance_id TEXT NOT NULL,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  balance_after REAL NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (allowance_id) REFERENCES allowance_holders(id) ON DELETE CASCADE
);

-- 班表
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  line_id TEXT,
  is_active INTEGER DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS shift_statuses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  color TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS schedule_entries (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  shift_id TEXT NOT NULL,
  assignee_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schedule_holidays (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_work_day INTEGER DEFAULT 0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS schedule_notes (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS holiday_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS holidays (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category_id TEXT,
  color TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES holiday_categories(id) ON DELETE SET NULL
);
-- 注意：idx_holidays_category 必須在 ALTER TABLE holidays ADD COLUMN category_id 之後才能建，
-- 所以移到 db/index.ts 的 ensureHolidaysColumns() 後面跑
-- CREATE INDEX IF NOT EXISTS idx_holidays_category ON holidays(category_id);
CREATE INDEX IF NOT EXISTS idx_holiday_categories_sort ON holiday_categories(sort_order);

CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  color TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- day_colors 表已刪除 (M-51 修復 2026-07-01):
--   - V3 殘留,0 consumer
--   - schema 移除 + migration 加上 DROP TABLE
--   - 從 ALL_TABLES 移除

CREATE TABLE IF NOT EXISTS training_records (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  date TEXT NOT NULL,
  content TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- APP 系統紀錄表 (M-59 修復 2026-07-01):
--   原本 client/src/storage/appLog.ts 用 queryAll/execute 直接寫 client-side SQLite
--   但 client storage 已是 throw-stub,資料會丟
--   改用 server-side SQLite 持久化,讓 log 能跨重啟保留
CREATE TABLE IF NOT EXISTS app_logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  level TEXT NOT NULL,
  source TEXT NOT NULL,
  action TEXT NOT NULL,
  message TEXT DEFAULT '',
  details TEXT DEFAULT '',
  user TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_app_logs_timestamp ON app_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_app_logs_level ON app_logs(level);

-- 公告
CREATE TABLE IF NOT EXISTS home_tabs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- License 表 (M-52 修復 2026-07-01):
--   原本 license.ts 用 in-memory Map 儲存,server 重啟資料全失
--   改用 SQLite 持久化,商業發布前必須
CREATE TABLE IF NOT EXISTS licenses (
  key TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  tier TEXT NOT NULL,            -- free | pro | enterprise
  expires_at TEXT NOT NULL,
  activated_at TEXT NOT NULL,
  device_limit INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS home_records (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  image_path TEXT,
  image_filename TEXT,
  image_base64 TEXT,
  tab_id TEXT REFERENCES home_tabs(id) ON DELETE SET NULL,
  pinned INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 備份
CREATE TABLE IF NOT EXISTS backup_history (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  format TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  note TEXT
);

-- ============================================================
-- 會計核心模組 (M-55 修復 2026-07-02):Sprint 3 最小可用版
-- ============================================================
-- Chart of Accounts:科目表(支援 5 大類 + 子科目)
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,        -- 例如 '1101' (現金), '4101' (管理費收入)
  name TEXT NOT NULL,
  type TEXT NOT NULL,                -- asset / liability / equity / revenue / expense
  parent_id TEXT,                    -- 子科目掛父科目
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES accounts(id) ON DELETE SET NULL
);

-- Journal Entries:日記帳分錄(複式記帳:每筆至少 1 借 + 1 貸,借貸必平)
CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  entry_date TEXT NOT NULL,           -- ISO date YYYY-MM-DD
  description TEXT NOT NULL,
  reference TEXT,                    -- 發票號碼 / 契約編號
  status TEXT NOT NULL DEFAULT 'draft',  -- draft / posted / voided
  posted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Journal Lines:分錄明細行(每筆 entry 至少 2 行)
CREATE TABLE IF NOT EXISTS journal_lines (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  debit REAL NOT NULL DEFAULT 0,      -- 借方金額
  credit REAL NOT NULL DEFAULT 0,     -- 貸方金額
  memo TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  -- 借貸互斥:debit 跟 credit 不能同時 > 0
  CHECK (NOT (debit > 0 AND credit > 0))
);

-- Accounting Periods:會計期間(每月一個,防止跨期改分錄)
CREATE TABLE IF NOT EXISTS accounting_periods (
  id TEXT PRIMARY KEY,
  period_code TEXT NOT NULL UNIQUE,   -- 例如 '2026-07'
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  is_closed INTEGER NOT NULL DEFAULT 0,
  closed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_residents_building ON residents(building_id);
CREATE INDEX IF NOT EXISTS idx_residents_floor ON residents(floor);
CREATE INDEX IF NOT EXISTS idx_residents_property ON residents(property);
CREATE INDEX IF NOT EXISTS idx_members_resident ON resident_members(resident_id);
CREATE INDEX IF NOT EXISTS idx_keycards_resident ON resident_keycards(resident_id);
CREATE INDEX IF NOT EXISTS idx_resident_parking_resident ON resident_parking(resident_id);
CREATE INDEX IF NOT EXISTS idx_resident_parking_spot ON resident_parking(parking_spot_id);
CREATE INDEX IF NOT EXISTS idx_resident_emergency_contacts_resident ON resident_emergency_contacts(resident_id);
CREATE INDEX IF NOT EXISTS idx_decoration_records_resident ON decoration_records(resident_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expense_records(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expense_records(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_type ON expense_records(type);
CREATE INDEX IF NOT EXISTS idx_floors_building ON floors(building_id);

-- M-55: 會計索引
CREATE INDEX IF NOT EXISTS idx_accounts_code ON accounts(code);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(type);
CREATE INDEX IF NOT EXISTS idx_accounts_parent ON accounts(parent_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON journal_entries(status);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_facilities_building ON facilities(building_id);
CREATE INDEX IF NOT EXISTS idx_parking_resident ON parking_spots(resident_id);
CREATE INDEX IF NOT EXISTS idx_parking_status ON parking_spots(status);
CREATE INDEX IF NOT EXISTS idx_facility_bookings_date ON facility_bookings(date);
CREATE INDEX IF NOT EXISTS idx_facility_bookings_resident ON facility_bookings(resident_id);
CREATE INDEX IF NOT EXISTS idx_facility_bookings_facility ON facility_bookings(facility_id);
CREATE INDEX IF NOT EXISTS idx_schedule_date ON schedule_entries(date);
CREATE INDEX IF NOT EXISTS idx_schedule_assignee ON schedule_entries(assignee_id);
CREATE INDEX IF NOT EXISTS idx_home_records_date ON home_records(created_at);
CREATE INDEX IF NOT EXISTS idx_backup_history_date ON backup_history(created_at);
`;

export const DEFAULT_STATUSES = [
  { id: 'status-normal', type: 'resident', label: '正常', color: '#22c55e', sort_order: 1 },
  { id: 'status-rental', type: 'resident', label: '出租中', color: '#3b82f6', sort_order: 2 },
  { id: 'status-vacant', type: 'resident', label: '空屋', color: '#f59e0b', sort_order: 3 },
  { id: 'parking-empty', type: 'parking', label: '空位', color: '#22c55e', sort_order: 1 },
  { id: 'parking-rented', type: 'parking', label: '已出租', color: '#3b82f6', sort_order: 2 },
];

export const V1_DEFAULT_PARKING_STATUSES = [
  { id: 'ps-empty', label: '空位', color: '#22c55e', sort_order: 1 },
  { id: 'ps-rented', label: '已出租', color: '#3b82f6', sort_order: 2 },
  { id: 'ps-sold', label: '已出售', color: '#a855f7', sort_order: 3 },
  { id: 'ps-used', label: '使用中', color: '#f59e0b', sort_order: 4 },
];

export const V1_DEFAULT_HOUSE_STATUSES = [
  { id: 'hs-normal', label: '正常', color: '#22c55e', sort_order: 1 },
  { id: 'hs-rental', label: '出租中', color: '#3b82f6', sort_order: 2 },
  { id: 'hs-vacant', label: '空屋', color: '#f59e0b', sort_order: 3 },
  { id: 'hs-sold', label: '已出售', color: '#a855f7', sort_order: 4 },
];

export const V1_DEFAULT_EXPENSE_CATEGORIES = [
  { name: '水電', type: 'expense', color: '#ef4444', sort_order: 1 },
  { name: '瓦斯', type: 'expense', color: '#f97316', sort_order: 2 },
  { name: '管理費', type: 'expense', color: '#eab308', sort_order: 3 },
  { name: '電話/網路', type: 'expense', color: '#84cc16', sort_order: 4 },
  { name: '設備維修', type: 'expense', color: '#22c55e', sort_order: 5 },
  { name: '清潔用品', type: 'expense', color: '#14b8a6', sort_order: 6 },
  { name: '其他', type: 'expense', color: '#6b7280', sort_order: 99 },
  { name: '房租', type: 'income', color: '#3b82f6', sort_order: 1 },
  { name: '押金', type: 'income', color: '#8b5cf6', sort_order: 2 },
  { name: '車位費', type: 'income', color: '#ec4899', sort_order: 3 },
  { name: '其他收入', type: 'income', color: '#6b7280', sort_order: 99 },
];

export const ALL_TABLES = [
  'status_options',
  'house_statuses',
  'parking_statuses',
  'buildings',
  'floors',
  'facilities',
  'parking_spots',
  'residents',
  'resident_members',
  'resident_keycards',
  'resident_parking',
  'resident_emergency_contacts',
  'decoration_records',
  'facility_bookings',
  'expense_categories',
  'expense_records',
  'expense_budget',
  'allowance_holders',
  'allowance_records',
  'allowance_transactions',
  'employees',
  'shifts',
  'shift_statuses',
  'schedule_entries',
  'schedule_holidays',
  'schedule_notes',
  'holidays',
  'holiday_categories',
  'calendar_events',
  'training_records',
  'home_tabs',
  'home_records',
  'backup_history',
  'licenses',
  'accounts',
  'journal_entries',
  'journal_lines',
  'accounting_periods',
  'app_logs',
] as const;

export type TableName = (typeof ALL_TABLES)[number];