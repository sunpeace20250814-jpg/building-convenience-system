/**
 * SQL 查詢安全檢查 + 執行器
 *
 * M-62 修復 (2026-07-01): 從 client-side queryAll → server-side fetch
 *
 * Client 只做「本地 validate」+「送 server 執行」+「接收結果」
 * Server-side (POST /api/ai/safe-query) 永遠重新驗證,不信任 client
 *
 * 注意:
 *   - FORBIDDEN_KEYWORDS / ALLOWED_TABLES 在 server side 是 single source of truth
 *   - client 的 whitelist 是 hint (讓 UI 在送 request 前可以快速擋)
 *   - 即使 client 改了 whitelist, server 還會擋
 */

import { apiClient } from '@/lib/apiClient';
import { monitor } from '@/monitoring/core';

const FORBIDDEN_KEYWORDS = [
  'insert', 'update', 'delete', 'drop', 'create', 'alter', 'truncate',
  'replace', 'attach', 'detach', 'vacuum', 'reindex', 'pragma',
  'grant', 'revoke', 'savepoint',
];

const ALLOWED_TABLES = new Set([
  'residents', 'resident_members', 'resident_keycards',
  'expense_records', 'expense_categories',
  'allowance_holders', 'allowance_transactions',
  'employees', 'shift_statuses', 'schedule_entries', 'holidays',
  'home_tabs', 'home_records',
  'buildings', 'parking_spots', 'status_options',
  'accounts', 'journal_entries', 'journal_lines', 'accounting_periods',
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

  const normalized = sql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!/^(SELECT|WITH)\s/i.test(normalized)) {
    return { valid: false, error: '只允許 SELECT 或 WITH 查詢' };
  }

  const statements = normalized.split(';').map((s) => s.trim()).filter(Boolean);
  if (statements.length > 1) {
    return { valid: false, error: '不允許多語句' };
  }

  const upper = normalized.toUpperCase();
  for (const kw of FORBIDDEN_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`, 'i');
    if (re.test(upper)) {
      return { valid: false, error: `禁用關鍵字: ${kw}` };
    }
  }

  let finalSQL = normalized;
  if (!/\bLIMIT\s+\d+/i.test(finalSQL)) {
    finalSQL += ' LIMIT 200';
  }

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
  const upper = sql.toUpperCase();
  const withMatch = upper.match(/WITH\s+(\w+(?:\s*,\s*\w+)*)\s+AS\s*\(/);
  if (withMatch) {
    const cteNames = withMatch[1].split(',').map((s) => s.trim().toLowerCase());
    if (cteNames.includes(name.toLowerCase())) return true;
  }
  return false;
}

/**
 * 執行安全 SQL 查詢 (async - 透過 server /api/ai/safe-query)
 * Server 會重新驗證,即使 client 端驗證通過, server 還會擋
 */
export async function executeSafeQuery(rawSQL: string, maxRows = 100): Promise<SafeQueryResult> {
  // Client-side 預先驗證 (UX: 在送 request 前就擋掉大部分錯誤)
  const validation = validateSQL(rawSQL);
  if (!validation.valid) {
    monitor.recordError(`AI SQL 驗證失敗: ${validation.error}`, 'ai.sqlValidate', 'warn', { sql: rawSQL });
    return { ok: false, error: validation.error || '驗證失敗' };
  }

  try {
    const result = await apiClient.post<{
      ok: boolean;
      rows?: any[];
      sql?: string;
      rowCount?: number;
      error?: string;
    }>('/api/ai/safe-query', {
      sql: validation.normalizedSQL,
      maxRows,
    });

    if (!result.ok) {
      monitor.recordError(`AI SQL server 拒絕: ${result.error}`, 'ai.sqlValidate', 'warn', { sql: validation.normalizedSQL });
      return { ok: false, error: result.error || 'server 拒絕執行' };
    }

    monitor.increment('ai.sqlExecutes', 1);
    return {
      ok: true,
      rows: result.rows,
      sql: result.sql,
      rowCount: result.rowCount,
    };
  } catch (err: any) {
    monitor.recordError(`AI SQL 執行失敗: ${err.message}`, 'ai.sqlExecute', 'error', { sql: validation.normalizedSQL, error: err });
    return { ok: false, error: err.message };
  }
}