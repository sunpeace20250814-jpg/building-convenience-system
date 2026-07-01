/**
 * 通知系統 — M-58 修復 (2026-07-01)
 *
 * 原本 client-side 用 queryAll 直接查 SQLite (storage/database.ts 已棄用為 throw-stub).
 * 改成 fetch /api/notifications 走 server-side SQLite.
 *
 * 通知類型 (server-side 計算):
 *   - 合約到期: move_out_date 在未來 30 天內
 *   - 零用金餘額偏低: allowance_holders.balance < 1000
 *   - 即將到來的國定假日: 14 天內
 *
 * 注意: 系統錯誤統計仍在 client-side (monitor 是 in-memory)
 */

import { apiClient } from '@/lib/apiClient';

export type NotificationSeverity = 'info' | 'warning' | 'urgent';

export interface Notification {
  id: string;
  title: string;
  description: string;
  severity: NotificationSeverity;
  category: 'contract' | 'birthday' | 'overdue' | 'low_balance' | 'system';
  link?: string;
  createdAt: number;
}

const listeners = new Set<() => void>();
let cache: Notification[] = [];
let lastFetch = 0;
const CACHE_MS = 60_000; // 1 分鐘緩存

export function subscribeNotifications(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notify() {
  for (const cb of listeners) cb();
}

export function getNotifications(): Notification[] {
  return cache;
}

export async function refreshNotifications(force = false): Promise<Notification[]> {
  const now = Date.now();
  if (!force && now - lastFetch < CACHE_MS) {
    return cache;
  }

  try {
    const data = await apiClient.get<Notification[]>('/api/notifications');
    cache = data ?? [];
    lastFetch = now;
    notify();
    return cache;
  } catch (err) {
    // 失敗時保留 cache 不變(避免 UI 閃爍)
    return cache;
  }
}

export function clearNotificationCache(): void {
  lastFetch = 0;
  cache = [];
  notify();
}