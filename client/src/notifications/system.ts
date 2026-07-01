/**
 * 通知系統
 * 計算各種提醒：合約到期、生日、繳費逾期等
 * 結果透過訂閱傳給 UI
 */

import { queryAll } from '@/storage/database';
import { monitor } from '@/monitoring/core';

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

  const notifications: Notification[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    // 1. 合約到期（moveOutDate 在未來 30 天內）
    const expiring = queryAll<any>(
      `SELECT id, owner_name, renter_name, move_out_date FROM residents
       WHERE move_out_date IS NOT NULL
       AND date(move_out_date) BETWEEN date('now') AND date('now', '+30 days')
       ORDER BY move_out_date`
    );
    for (const r of expiring) {
      const days = Math.floor((new Date(r.moveOutDate).getTime() - today.getTime()) / 86400_000);
      notifications.push({
        id: `contract-${r.id}`,
        title: `${r.owner_name} 合約即將到期`,
        description: `剩 ${days} 天（${r.moveOutDate}）`,
        severity: days <= 7 ? 'urgent' : 'warning',
        category: 'contract',
        link: '/residents',
        createdAt: now,
      });
    }

    // 2. 繳費逾期（最近 30 天沒有任何收支記錄的住戶，啟發式判斷）
    // 簡化：略過（沒有 due_date 欄位）

    // 3. 零用金餘額過低
    const lowBalances = queryAll<any>(
      `SELECT id, name, balance FROM allowance_holders WHERE balance < 1000 ORDER BY balance`
    );
    for (const a of lowBalances) {
      notifications.push({
        id: `balance-${a.id}`,
        title: `${a.name} 零用金餘額偏低`,
        description: `目前餘額 $${a.balance}，建議補充`,
        severity: a.balance < 0 ? 'urgent' : 'warning',
        category: 'low_balance',
        link: '/expenses',
        createdAt: now,
      });
    }

    // 4. 即將到來的國定假日
    const upcomingHolidays = queryAll<any>(
      `SELECT id, date, name FROM holidays
       WHERE date BETWEEN date('now') AND date('now', '+14 days')
       ORDER BY date LIMIT 3`
    );
    for (const h of upcomingHolidays) {
      const days = Math.floor((new Date(h.date).getTime() - today.getTime()) / 86400_000);
      notifications.push({
        id: `holiday-${h.id}`,
        title: `${h.name}`,
        description: days === 0 ? '就是今天' : `${days} 天後`,
        severity: 'info',
        category: 'system',
        link: '/schedule',
        createdAt: now,
      });
    }

    // 5. 系統錯誤（最近 24h 有 error）
    const errStats = monitor.getErrorCount(24 * 60 * 60 * 1000);
    if (errStats.total > 10) {
      notifications.push({
        id: 'system-errors',
        title: '近期錯誤過多',
        description: `過去 24 小時累計 ${errStats.total} 個錯誤，建議查看監測頁面`,
        severity: 'warning',
        category: 'system',
        link: '/monitoring',
        createdAt: now,
      });
    }
  } catch (err: any) {
    monitor.recordError(`通知重新整理失敗: ${err.message}`, 'notifications', 'warn', { error: err });
  }

  // 排序：urgent > warning > info
  const severityOrder = { urgent: 0, warning: 1, info: 2 };
  notifications.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  cache = notifications;
  lastFetch = now;
  notify();
  return cache;
}

export function clearNotificationCache(): void {
  lastFetch = 0;
  cache = [];
  notify();
}
