/**
 * 監測系統核心測試
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { monitor } from '@/monitoring/core';

describe('Monitoring System', () => {
  beforeEach(() => {
    monitor.clear();
  });

  describe('Metrics', () => {
    it('記錄 metric', () => {
      monitor.recordMetric('test.value', 42);
      const metrics = monitor.getMetrics('test.value');
      expect(metrics.length).toBe(1);
      expect(metrics[0].value).toBe(42);
    });

    it('aggregate 計算正確', () => {
      for (let i = 0; i < 100; i++) {
        monitor.recordMetric('latency', i);
      }
      const agg = monitor.aggregate('latency', 60_000);
      expect(agg).not.toBeNull();
      expect(agg!.count).toBe(100);
      expect(agg!.min).toBe(0);
      expect(agg!.max).toBe(99);
      expect(agg!.avg).toBe(49.5);
    });

    it('increment 計數', () => {
      monitor.increment('counter');
      monitor.increment('counter');
      monitor.increment('counter', 5);
      const all = monitor.getMetrics('counter');
      const sum = all.reduce((s, m) => s + m.value, 0);
      expect(sum).toBe(7);
    });
  });

  describe('Errors', () => {
    it('記錄錯誤', () => {
      monitor.recordError('test error', 'test', 'error');
      const errors = monitor.getErrors('error');
      expect(errors.length).toBe(1);
      expect(errors[0].message).toBe('test error');
    });

    it('5 秒內同 source+message 合併計數', () => {
      monitor.recordError('same', 'src');
      monitor.recordError('same', 'src');
      monitor.recordError('same', 'src');
      const stats = monitor.getErrorCount(60_000);
      expect(stats.total).toBe(3);
      expect(stats.bySource['src']).toBe(3);
    });

    it('按嚴重度分組', () => {
      monitor.recordError('a', 'x', 'warn');
      monitor.recordError('b', 'x', 'error');
      monitor.recordError('c', 'x', 'fatal');
      const stats = monitor.getErrorCount(60_000);
      expect(stats.bySeverity.warn).toBe(1);
      expect(stats.bySeverity.error).toBe(1);
      expect(stats.bySeverity.fatal).toBe(1);
    });
  });

  describe('Performance', () => {
    it('time helper 自動記錄', async () => {
      const result = await monitor.time('test.op', async () => {
        await new Promise((r) => setTimeout(r, 10));
        return 'done';
      });
      expect(result).toBe('done');
      const perf = monitor.getPerformance('test.op');
      expect(perf.length).toBe(1);
      expect(perf[0].durationMs).toBeGreaterThanOrEqual(10);
      expect(perf[0].success).toBe(true);
    });

    it('time 失敗時 success = false', async () => {
      try {
        await monitor.time('fail.op', async () => {
          throw new Error('boom');
        });
      } catch {}
      const perf = monitor.getPerformance('fail.op');
      expect(perf[0].success).toBe(false);
    });
  });

  describe('Subscription', () => {
    it('訂閱後狀態變化收到通知', () => {
      let notified = 0;
      const unsub = monitor.subscribe(() => notified++);
      monitor.recordMetric('x', 1);
      monitor.recordError('y', 'src');
      expect(notified).toBeGreaterThanOrEqual(2);
      unsub();
    });
  });

  describe('Ring buffer capacity', () => {
    it('超過容量自動丟棄舊的', () => {
      for (let i = 0; i < 600; i++) {
        monitor.recordMetric('bulk', i);
      }
      // 容量是 500
      const all = monitor.getMetrics('bulk');
      expect(all.length).toBeLessThanOrEqual(500);
    });
  });
});
