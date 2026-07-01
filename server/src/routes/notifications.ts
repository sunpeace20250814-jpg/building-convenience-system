/**
 * Notifications Routes — M-58 (2026-07-01)
 *
 * 從 client-side (notifications/system.ts) 搬到 server-side.
 * 前端改用 fetch 取代 queryAll storage/database.ts (throw-stub).
 *
 * 通知類型:
 *   - 合約到期: move_out_date 在未來 30 天內
 *   - 零用金餘額偏低: allowance_holders.balance < 1000
 *   - 即將到來的國定假日: 14 天內
 *   - 系統錯誤: 過去 24h 累計超過 10 個 (從 monitor 拿)
 *
 * 注意: monitor 是 client-side in-memory,所以系統錯誤統計仍要在 client 收集.
 */

import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';

interface NotificationDTO {
  id: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'urgent';
  category: 'contract' | 'low_balance' | 'system';
  link?: string;
  createdAt: number;
}

const LOW_BALANCE_THRESHOLD = 1000;
const CONTRACT_WINDOW_DAYS = 30;
const HOLIDAY_WINDOW_DAYS = 14;

function todayMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

function isoToDate(iso: string): Date {
  // ISO YYYY-MM-DD 或 YYYY-MM-DDTHH:mm:ss 都支援
  return new Date(iso);
}

export async function notificationsRoutes(fastify: FastifyInstance) {
  // GET /api/notifications — 收集所有通知
  fastify.get('/notifications', {
    schema: {
      tags: ['notifications'],
      summary: '收集所有通知 (合約到期 / 零用金偏低 / 即將到來的假日)',
      response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
    },
  }, async () => {
    const notifications: NotificationDTO[] = [];
    const today = todayMidnight();
    const now = Date.now();

    // 1. 合約到期
    const expiring = db.prepare(
      `SELECT id, owner_name, renter_name, move_out_date FROM residents
       WHERE move_out_date IS NOT NULL
       AND date(move_out_date) BETWEEN date('now') AND date('now', '+${CONTRACT_WINDOW_DAYS} days')
       ORDER BY move_out_date`
    ).all() as any[];

    for (const r of expiring) {
      const moveOut = isoToDate(r.move_out_date);
      const days = daysBetween(today, moveOut);
      notifications.push({
        id: `contract-${r.id}`,
        title: `${r.owner_name ?? r.renter_name ?? '住戶'} 合約即將到期`,
        description: `剩 ${days} 天（${r.move_out_date}）`,
        severity: days <= 7 ? 'urgent' : 'warning',
        category: 'contract',
        link: '/residents',
        createdAt: now,
      });
    }

    // 2. 零用金餘額偏低
    const lowBalances = db.prepare(
      'SELECT id, name, balance FROM allowance_holders WHERE balance < ? ORDER BY balance'
    ).all(LOW_BALANCE_THRESHOLD) as any[];

    for (const a of lowBalances) {
      notifications.push({
        id: `balance-${a.id}`,
        title: `${a.name} 零用金餘額偏低`,
        description: `目前餘額 $${a.balance},建議補充`,
        severity: a.balance < 0 ? 'urgent' : 'warning',
        category: 'low_balance',
        link: '/expenses',
        createdAt: now,
      });
    }

    // 3. 即將到來的假日
    const upcomingHolidays = db.prepare(
      `SELECT id, date, name FROM holidays
       WHERE date BETWEEN date('now') AND date('now', '+${HOLIDAY_WINDOW_DAYS} days')
       ORDER BY date LIMIT 3`
    ).all() as any[];

    for (const h of upcomingHolidays) {
      const holidayDate = isoToDate(h.date);
      const days = daysBetween(today, holidayDate);
      notifications.push({
        id: `holiday-${h.id}`,
        title: h.name,
        description: days === 0 ? '就是今天' : `${days} 天後`,
        severity: 'info',
        category: 'system',
        link: '/schedule',
        createdAt: now,
      });
    }

    // 排序: urgent > warning > info
    const severityOrder = { urgent: 0, warning: 1, info: 2 };
    notifications.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return notifications;
  });
}