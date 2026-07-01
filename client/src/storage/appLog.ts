/**
 * APP 系統紀錄服務
 * 統一記錄所有重要事件到 app_logs table
 */

import { execute, queryAll } from './database';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';
export type LogSource = 'system' | 'user' | 'ai' | 'backup' | 'storage' | 'module';

export interface AppLog {
  id: string;
  timestamp: string;
  level: LogLevel;
  source: LogSource;
  action: string;
  message: string;
  details: string;
  user: string;
}

export interface LogInput {
  level?: LogLevel;
  source: LogSource;
  action: string;
  message?: string;
  details?: Record<string, any>;
}

/**
 * 寫入一筆系統紀錄
 */
export function log(input: LogInput): void {
  try {
    const id = `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date().toISOString();
    execute(
      `INSERT INTO app_logs (id, timestamp, level, source, action, message, details) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        timestamp,
        input.level || 'info',
        input.source,
        input.action,
        input.message || '',
        input.details ? JSON.stringify(input.details) : '',
      ]
    );
  } catch (err) {
    // 寫 log 失敗不應影響主流程
    console.warn('[appLog] Failed to write log:', err);
  }
}

export function logInfo(source: LogSource, action: string, message?: string, details?: any) {
  log({ level: 'info', source, action, message, details });
}
export function logWarn(source: LogSource, action: string, message?: string, details?: any) {
  log({ level: 'warn', source, action, message, details });
}
export function logError(source: LogSource, action: string, message?: string, details?: any) {
  log({ level: 'error', source, action, message, details });
}
export function logDebug(source: LogSource, action: string, message?: string, details?: any) {
  log({ level: 'debug', source, action, message, details });
}

/**
 * 查詢紀錄
 */
export function getLogs(options: {
  limit?: number;
  level?: LogLevel;
  source?: LogSource;
  search?: string;
} = {}): AppLog[] {
  try {
    let sql = 'SELECT * FROM app_logs WHERE 1=1';
    const params: any[] = [];

    if (options.level) {
      sql += ' AND level = ?';
      params.push(options.level);
    }
    if (options.source) {
      sql += ' AND source = ?';
      params.push(options.source);
    }
    if (options.search) {
      sql += ' AND (action LIKE ? OR message LIKE ?)';
      params.push(`%${options.search}%`, `%${options.search}%`);
    }

    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(options.limit || 200);

    return queryAll<AppLog>(sql, params);
  } catch (err) {
    console.warn('[appLog] Failed to query logs:', err);
    return [];
  }
}

/**
 * 清空紀錄
 */
export function clearLogs(): void {
  try {
    execute('DELETE FROM app_logs');
  } catch {}
}

/**
 * 取得統計
 */
export function getLogStats(): { total: number; byLevel: Record<string, number>; bySource: Record<string, number> } {
  try {
    const rows = queryAll<any>('SELECT level, source, COUNT(*) as cnt FROM app_logs GROUP BY level, source');
    const total = rows.reduce((s, r) => s + r.cnt, 0);
    const byLevel: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    for (const r of rows) {
      byLevel[r.level] = (byLevel[r.level] || 0) + r.cnt;
      bySource[r.source] = (bySource[r.source] || 0) + r.cnt;
    }
    return { total, byLevel, bySource };
  } catch {
    return { total: 0, byLevel: {}, bySource: {} };
  }
}