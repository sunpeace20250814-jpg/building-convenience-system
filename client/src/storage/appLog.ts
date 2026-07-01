/**
 * APP 系統紀錄服務 — M-59 修復 (2026-07-01)
 *
 * 原本 client-side 用 execute/queryAll (storage/database.ts 已 throw-stub).
 * 改成 fetch /api/app-logs 走 server-side SQLite.
 *
 * 注意: log() 是 fire-and-forget (不等回應), 失敗不影響主流程.
 */

import { apiClient } from '@/lib/apiClient';

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
  user?: string;
}

/**
 * 寫入一筆系統紀錄 (fire-and-forget)
 */
export function log(input: LogInput): void {
  // 不 await - 寫 log 失敗不應影響主流程
  apiClient.post('/api/app-logs', {
    level: input.level ?? 'info',
    source: input.source,
    action: input.action,
    message: input.message ?? '',
    details: input.details,
  }).catch((err) => {
    console.warn('[appLog] Failed to write log:', err);
  });
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
export async function getLogs(options: {
  limit?: number;
  level?: LogLevel;
  source?: LogSource;
  search?: string;
} = {}): Promise<AppLog[]> {
  try {
    const params: Record<string, string> = {};
    if (options.limit) params.limit = String(options.limit);
    if (options.level) params.level = options.level;
    if (options.source) params.source = options.source;
    if (options.search) params.search = options.search;
    return await apiClient.get<AppLog[]>('/api/app-logs', { params });
  } catch (err) {
    console.warn('[appLog] Failed to query logs:', err);
    return [];
  }
}

/**
 * 清空紀錄
 */
export async function clearLogs(): Promise<void> {
  try {
    await apiClient.delete('/api/app-logs');
  } catch {}
}

/**
 * 取得統計
 */
export async function getLogStats(): Promise<{
  total: number;
  byLevel: Record<string, number>;
  bySource: Record<string, number>;
}> {
  try {
    return await apiClient.get('/api/app-logs/stats');
  } catch {
    return { total: 0, byLevel: {}, bySource: {} };
  }
}