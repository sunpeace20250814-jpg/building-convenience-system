/**
 * App Logs Routes — M-59 (2026-07-01)
 *
 * 從 client-side (storage/appLog.ts) 搬到 server-side.
 * 原本 log() 用 INSERT INTO app_logs 寫 client-side SQLite,
 * 但 client storage 已是 throw-stub, log 直接被吃掉.
 *
 * 改用 server-side SQLite 持久化,讓 log 跨重啟保留.
 *
 * 注意: log 是 fire-and-forget (client 不等回應), 不阻塞主流程.
 */

import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';

interface AppLogDTO {
  id: string;
  timestamp: string;
  level: string;
  source: string;
  action: string;
  message: string;
  details: string;
  user: string;
}

interface LogInput {
  level?: string;
  source: string;
  action: string;
  message?: string;
  details?: Record<string, any>;
  user?: string;
}

const MAX_LOG_ROWS = 10_000; // 最多保留 10000 筆,超過會刪最舊的

export async function appLogsRoutes(fastify: FastifyInstance) {
  // POST /api/app-logs — 寫入一筆紀錄
  fastify.post<{ Body: LogInput }>('/app-logs', {
    schema: {
      tags: ['app-logs'],
      summary: '寫入 APP 系統紀錄',
      body: {
        type: 'object',
        required: ['source', 'action'],
        properties: {
          level: { type: 'string' },
          source: { type: 'string' },
          action: { type: 'string' },
          message: { type: 'string' },
          details: { type: 'object' },
          user: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const input = req.body;
    const id = `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date().toISOString();

    try {
      db.prepare(
        `INSERT INTO app_logs (id, timestamp, level, source, action, message, details, user)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        timestamp,
        input.level ?? 'info',
        input.source,
        input.action,
        input.message ?? '',
        input.details ? JSON.stringify(input.details) : '',
        input.user ?? ''
      );

      // 超過上限就刪最舊的 (background, 不阻塞回應)
      const { cnt } = db.prepare('SELECT COUNT(*) as cnt FROM app_logs').get() as { cnt: number };
      if (cnt > MAX_LOG_ROWS) {
        db.prepare(
          `DELETE FROM app_logs WHERE id IN (
            SELECT id FROM app_logs ORDER BY timestamp ASC LIMIT ?
          )`
        ).run(cnt - MAX_LOG_ROWS);
      }

      return { ok: true, id };
    } catch (err: any) {
      // log 寫入失敗不應影響主流程
      fastify.log.warn(`[app-logs] Failed to write log: ${err.message}`);
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });

  // GET /api/app-logs — 查詢紀錄
  fastify.get<{
    Querystring: { limit?: string; level?: string; source?: string; search?: string };
  }>('/app-logs', {
    schema: {
      tags: ['app-logs'],
      summary: '查詢 APP 系統紀錄',
    },
  }, async (req) => {
    const { limit, level, source, search } = req.query;
    let sql = 'SELECT * FROM app_logs WHERE 1=1';
    const params: any[] = [];

    if (level) {
      sql += ' AND level = ?';
      params.push(level);
    }
    if (source) {
      sql += ' AND source = ?';
      params.push(source);
    }
    if (search) {
      sql += ' AND (action LIKE ? OR message LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(Number(limit) || 200);

    return db.prepare(sql).all(...params) as AppLogDTO[];
  });

  // GET /api/app-logs/stats — 統計
  fastify.get('/app-logs/stats', {
    schema: {
      tags: ['app-logs'],
      summary: 'APP 系統紀錄統計 (總數 / byLevel / bySource)',
    },
  }, async () => {
    const rows = db.prepare(
      'SELECT level, source, COUNT(*) as cnt FROM app_logs GROUP BY level, source'
    ).all() as any[];

    const total = rows.reduce((s, r) => s + r.cnt, 0);
    const byLevel: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    for (const r of rows) {
      byLevel[r.level] = (byLevel[r.level] || 0) + r.cnt;
      bySource[r.source] = (bySource[r.source] || 0) + r.cnt;
    }
    return { total, byLevel, bySource };
  });

  // DELETE /api/app-logs — 清空紀錄
  fastify.delete('/app-logs', {
    schema: {
      tags: ['app-logs'],
      summary: '清空所有 APP 系統紀錄',
    },
  }, async () => {
    db.prepare('DELETE FROM app_logs').run();
    return { ok: true };
  });
}