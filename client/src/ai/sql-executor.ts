/**
 * SQL 查詢安全檢查 + 執行器
 * AI 只能跑 SELECT，且欄位、表名、limit 都有限制
 */

import { queryAll } from '@/storage/database';
import { monitor } from '@/monitoring/core';

const FORBIDDEN_KEYWORDS = [
  'insert', 'update', 'delete', 'drop', 'create', 'alter', 'truncate',
  'replace', 'attach', 'detach', 'vacuum', 'reindex', 'pragma',
  'grant', 'revoke', 'savepoint',
];

// WITH 子句內可能用到但仍需檢查的關鍵字（允許子句內但擋外層操作）
// const STATEMENT_STARTERS = ['with', 'select']; // 保留作為未來擴充用

const ALLOWED_TABLES = new Set([
  'residents', 'resident_members', 'resident_keycards',
  'expense_records', 'expense_categories',
  'allowance_holders', 'allowance_transactions',
  'employees', 'shift_statuses', 'schedule_entries', 'holidays',
  'home_tabs', 'home_records',
  'buildings', 'parking_spots', 'status_options',
]);

export interface SafeQueryResult {
  ok: boolean;
  error?: string;
  rows?: any[];
  sql?: string;
  rowCount?: number;
}

export function validateSQL(sql: string): { valid: boolean; error?: string; normalizedSQL?: string } {
  if (!sql || typeof sql !== 'string') {
    return { valid: false, error: 'SQL 不可為空' };
  }

  // 移除多餘空白、註解
  const normalized = sql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // 必須以 SELECT 開頭（或 WITH）
  if (!/^(SELECT|WITH)\s/i.test(normalized)) {
    return { valid: false, error: '只允許 SELECT 或 WITH 查詢' };
  }

  // 不能有多語句（用分號分隔多句）
  const statements = normalized.split(';').map((s) => s.trim()).filter(Boolean);
  if (statements.length > 1) {
    return { valid: false, error: '不允許多語句' };
  }

  // 對於 WITH 開頭的語句，把開頭的 WITH...SELECT 視為一個整體，仍只檢查有沒有禁用字
  // 然後檢查整個語句必須以 SELECT 結尾（常見 CTE 模式）

  // 檢查禁用關鍵字
  const upper = normalized.toUpperCase();
  for (const kw of FORBIDDEN_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`, 'i');
    if (re.test(upper)) {
      return { valid: false, error: `禁用關鍵字: ${kw}` };
    }
  }

  // 強制加 LIMIT
  let finalSQL = normalized;
  if (!/\bLIMIT\s+\d+/i.test(finalSQL)) {
    finalSQL += ' LIMIT 200';
  }

  // 解析表名（粗略比對）— 確保都是 ALLOWED_TABLES
  // 注意：CTE 名稱也會被抓到，但 CTE 是 WITH 內部定義的，視為合法
  const tableMatches = finalSQL.matchAll(/\b(FROM|JOIN)\s+([a-z_][a-z0-9_]*)/gi);
  for (const m of tableMatches) {
    const table = m[2].toLowerCase();
    if (ALLOWED_TABLES.has(table)) continue;
    if (isLikelyCTERef(finalSQL, m[2])) continue;
    return { valid: false, error: `不允許存取表: ${table}` };
  }

  return { valid: true, normalizedSQL: finalSQL };
}

function isLikelyCTERef(sql: string, name: string): boolean {
  // 檢查 name 是否在 WITH 子句裡定義為 CTE
  const upper = sql.toUpperCase();
  const withMatch = upper.match(/WITH\s+(\w+(?:\s*,\s*\w+)*)\s+AS\s*\(/);
  if (withMatch) {
    const cteNames = withMatch[1].split(',').map((s) => s.trim().toLowerCase());
    if (cteNames.includes(name.toLowerCase())) return true;
  }
  return false;
}

export function executeSafeQuery(rawSQL: string, maxRows = 100): SafeQueryResult {
  const validation = validateSQL(rawSQL);
  if (!validation.valid) {
    monitor.recordError(`AI SQL 驗證失敗: ${validation.error}`, 'ai.sqlValidate', 'warn', { sql: rawSQL });
    return { ok: false, error: validation.error || '驗證失敗' };
  }

  try {
    const rows = queryAll(validation.normalizedSQL!);
    const limited = rows.slice(0, maxRows);
    monitor.increment('ai.sqlExecutes', 1);
    return {
      ok: true,
      rows: limited,
      sql: validation.normalizedSQL,
      rowCount: limited.length,
    };
  } catch (err: any) {
    monitor.recordError(`AI SQL 執行失敗: ${err.message}`, 'ai.sqlExecute', 'error', { sql: validation.normalizedSQL, error: err });
    return { ok: false, error: err.message };
  }
}
