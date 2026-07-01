/**
 * 稽核記錄模組
 *
 * 啟用後會記錄所有資料表的修改歷史：
 * - 誰改了
 * - 什麼時候
 * - 改之前/之後的值
 * - 從哪個來源
 *
 * 預設核心啟用（這是基本內控要求）
 */

import type { ModuleManifest } from '../registry';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL,                  -- create / update / delete
  old_value TEXT,                        -- JSON
  new_value TEXT,                        -- JSON
  changed_by TEXT,                       -- 之後可接登入
  source TEXT,                           -- ui / api / cli / ai / system
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_table ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_log(created_at);
`;

export const auditManifest: ModuleManifest = {
  id: 'audit',
  name: '修改稽核記錄',
  category: 'core',
  description: '記錄所有資料變更的歷史（誰、何時、改了什麼）。建議永遠啟用。',
  defaultEnabled: true,
  core: true,
  schema: SCHEMA,
  routes: [
    { path: '/audit-log', label: '稽核記錄', icon: 'Shield' },
  ],
  sidebar: [
    { path: '/audit-log', label: '稽核記錄', icon: 'Shield' },
  ],
};
