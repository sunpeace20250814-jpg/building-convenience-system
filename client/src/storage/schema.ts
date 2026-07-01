/**
 * SQLite Schema (瀏覽器端版本)
 * V4 + V1 完整邏輯整合版
 * - V4 保留：residents, parking_spots, status_options 等
 * - V1 新增：floors, facilities, members (改名), parking_statuses,
 *           house_statuses, employees, shifts, schedule_*,
 *           expense_categories V1 版, allowance_*, home_records V1 版
 */

export const SCHEMA_SQL = `
-- ========== 狀態 ==========
CREATE TABLE IF NOT EXISTS status_options (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  color TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

-- V1 細分的兩種狀態表（向後相容：status_options 仍可使用）
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

-- ========== 建築 / 樓層 / 公設 ==========
CREATE TABLE IF NOT EXISTS buildings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normal_floor_count INTEGER NOT NULL DEFAULT 0,
  rooftop_floor_count INTEGER DEFAULT 0,
  basement_floor_count INTEGER DEFAULT 0,
  units_per_floor INTEGER DEFAULT 4,
  unit_area REAL DEFAULT 30,
  unit_name_pattern TEXT DEFAULT '{building}-{floor}-{unit}',
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- V1 新增：每層細部設定（面積、計算房數、樓層顯示名）
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

-- ========== 停車位 ==========
CREATE TABLE IF NOT EXISTS parking_spots (
  id TEXT PRIMARY KEY,
  building_id TEXT,
  floor TEXT NOT NULL,
  number TEXT NOT NULL,
  space TEXT,                          -- V1 完整編號 e.g. "A-001"
  type TEXT NOT NULL DEFAULT 'car',
  status TEXT NOT NULL DEFAULT 'empty',
  status_id TEXT,
  resident_id TEXT,
  bound_resident_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ========== 住戶 ==========
CREATE TABLE IF NOT EXISTS residents (
  id TEXT PRIMARY KEY,
  property TEXT,                       -- V1 房號 "1-01-01"
  building_id TEXT NOT NULL,
  floor_id TEXT,
  floor TEXT NOT NULL,
  floor_index INTEGER,
  unit_number TEXT,
  unit_type TEXT DEFAULT 'normal',
  name TEXT NOT NULL,
  owner_name TEXT,                     -- V4 保留
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

-- ========== 成員 / 鑰匙卡 ==========
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

-- ========== V4 next-gen: 裝潢記錄 / 緊急聯絡人 / 車位綁定 ==========
-- 裝潢記錄：一戶多筆裝潢（開始 / 結束 / 退裝潢 + 圖片）
CREATE TABLE IF NOT EXISTS decoration_records (
  id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL,
  name TEXT NOT NULL,                    -- 裝潢名稱
  start_date TEXT,                      -- 開始日期 (YYYY-MM-DD)
  end_date TEXT,                         -- 結束日期 (YYYY-MM-DD)
  removal_date TEXT,                     -- 退裝潢日期
  start_image TEXT,                      -- 開始圖片（base64 或路徑）
  removal_image TEXT,                    -- 退裝潢圖片
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_decoration_records_resident ON decoration_records(resident_id);

-- 區權人緊急聯絡人（多筆，取代 residents.emergency_contact 單筆）
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
CREATE INDEX IF NOT EXISTS idx_resident_emergency_contacts_resident ON resident_emergency_contacts(resident_id);

-- 住戶 ↔ 車位多對多綁定（一戶多車位 + ETC 號碼）
-- 取代 residents.parking_id 單一綁定；保留 parking_spots.resident_id 唯讀標記
CREATE TABLE IF NOT EXISTS resident_parking (
  id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL,
  parking_spot_id TEXT NOT NULL,
  etc_number TEXT,                       -- ETC 號碼（綁定在這個車位上）
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE CASCADE,
  FOREIGN KEY (parking_spot_id) REFERENCES parking_spots(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_resident_parking_resident ON resident_parking(resident_id);
CREATE INDEX IF NOT EXISTS idx_resident_parking_spot ON resident_parking(parking_spot_id);

-- ========== 記帳 ==========
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

-- V4 舊名稱保留
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

-- ========== 班表 ==========
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
CREATE INDEX IF NOT EXISTS idx_holidays_category ON holidays(category_id);
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

CREATE TABLE IF NOT EXISTS day_colors (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS training_records (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  date TEXT NOT NULL,
  content TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- ========== 備份 ==========
CREATE TABLE IF NOT EXISTS backup_history (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  format TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  note TEXT
);

-- ========== APP 設定（key-value 持久化）==========
-- 存在 .db 檔內，跟著雲端硬碟走 → 換瀏覽器/換電腦都同步
-- 不依賴 localStorage（避免瀏覽器清資料 / 無痕模式 / Edge App mode 關閉清狀態）
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
-- 預設 onboarding 設定（marker）
INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES ('onboarding_completed', '0', datetime('now'));
INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES ('onboarding_skipped_at', '0', datetime('now'));
INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES ('schema_version', '1', datetime('now'));

-- ========== APP 系統紀錄 ==========
CREATE TABLE IF NOT EXISTS app_logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  level TEXT NOT NULL,           -- info / warn / error / debug
  source TEXT NOT NULL,          -- module / system / user / ai
  action TEXT NOT NULL,          -- 動作描述
  message TEXT,
  details TEXT,                  -- JSON 細節
  user TEXT                      -- 之後可擴充多用戶
);
CREATE INDEX IF NOT EXISTS idx_app_logs_timestamp ON app_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_app_logs_level ON app_logs(level);

-- ========== 公設借用 ==========
CREATE TABLE IF NOT EXISTS facility_bookings (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,            -- 借用日期 YYYY-MM-DD
  resident_id TEXT,              -- 哪戶（FK → residents）
  resident_name TEXT,            -- 冗餘欄位（避免 join）
  facility_id TEXT NOT NULL,     -- 公設 ID（FK → facilities）
  facility_name TEXT,            -- 公設名稱（冗餘）
  start_time TEXT NOT NULL,      -- 開始時間 HH:MM
  end_time TEXT NOT NULL,        -- 結束時間 HH:MM
  paid INTEGER DEFAULT 0,        -- 0/1 是否付款
  fee REAL DEFAULT 0,            -- 費用
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE SET NULL,
  FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_facility_bookings_date ON facility_bookings(date);
CREATE INDEX IF NOT EXISTS idx_facility_bookings_resident ON facility_bookings(resident_id);
CREATE INDEX IF NOT EXISTS idx_facility_bookings_facility ON facility_bookings(facility_id);

-- ========== 首頁公告 ==========
CREATE TABLE IF NOT EXISTS home_tabs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
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
  tab_id TEXT,
  pinned INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ========== 索引 ==========
CREATE INDEX IF NOT EXISTS idx_residents_building ON residents(building_id);
CREATE INDEX IF NOT EXISTS idx_residents_floor ON residents(floor);
CREATE INDEX IF NOT EXISTS idx_residents_property ON residents(property);
CREATE INDEX IF NOT EXISTS idx_residents_floor_id ON residents(floor_id);
CREATE INDEX IF NOT EXISTS idx_members_resident ON resident_members(resident_id);
CREATE INDEX IF NOT EXISTS idx_keycards_resident ON resident_keycards(resident_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expense_records(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expense_records(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_type ON expense_records(type);
CREATE INDEX IF NOT EXISTS idx_floors_building ON floors(building_id);
CREATE INDEX IF NOT EXISTS idx_facilities_building ON facilities(building_id);
CREATE INDEX IF NOT EXISTS idx_parking_resident ON parking_spots(resident_id);
CREATE INDEX IF NOT EXISTS idx_parking_status ON parking_spots(status);
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

export const V1_DEFAULT_HOLIDAY_CATEGORIES = [
  { id: 'holiday-cat-national', name: '國定假日', color: '#ef4444', sort_order: 1 },
  { id: 'holiday-cat-makeup', name: '補班日', color: '#eab308', sort_order: 2 },
  { id: 'holiday-cat-typhoon', name: '颱風假', color: '#f97316', sort_order: 3 },
  { id: 'holiday-cat-company', name: '公司紀念日', color: '#3b82f6', sort_order: 4 },
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
  'calendar_events',
  'day_colors',
  'training_records',
  'home_tabs',
  'home_records',
  'backup_history',
  'app_logs',
  'facility_bookings',
  'decoration_records',
  'resident_emergency_contacts',
  'resident_parking',
  'holiday_categories',
] as const;

export type TableName = (typeof ALL_TABLES)[number];