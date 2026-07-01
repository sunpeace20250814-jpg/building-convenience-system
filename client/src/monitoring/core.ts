/**
 * 監測系統核心
 * 提供 metric 收集、錯誤追蹤、效能量測、儲存監測
 *
 * 設計原則：
 * - 全 in-memory（不持久化，避免額外 IO 開銷）
 * - Ring Buffer 限制記憶體
 * - 訂閱模式：訂閱者只在有更新時收到通知
 * - 簡單聚合：支援 time window 統計
 */

import { logError, logWarn } from '@/storage/appLog';

export type Severity = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface Metric {
  id: string;
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp: number;
}

export interface ErrorEvent {
  id: string;
  message: string;
  stack?: string;
  source: string;
  severity: Severity;
  context?: Record<string, any>;
  timestamp: number;
  count: number; // 同一錯誤累積次數
}

export interface PerformanceMark {
  id: string;
  name: string;
  durationMs: number;
  meta?: Record<string, any>;
  success: boolean;
  timestamp: number;
}

export interface StorageEvent {
  id: string;
  kind: 'read' | 'write' | 'export' | 'import' | 'error';
  bytes?: number;
  durationMs: number;
  success: boolean;
  error?: string;
  timestamp: number;
}

interface RingBuffer<T> {
  items: T[];
  capacity: number;
  push(item: T): void;
  getAll(): T[];
  clear(): void;
}

function createRingBuffer<T extends { id: string }>(capacity: number): RingBuffer<T> {
  const items: T[] = [];
  return {
    items,
    capacity,
    push(item: T) {
      items.push(item);
      if (items.length > capacity) {
        items.shift();
      }
    },
    getAll() {
      return [...items];
    },
    clear() {
      items.length = 0;
    },
  };
}

class MonitoringSystem {
  private metricsBuffer = createRingBuffer<Metric>(500);
  private errorsBuffer = createRingBuffer<ErrorEvent>(200);
  private perfBuffer = createRingBuffer<PerformanceMark>(500);
  private storageBuffer = createRingBuffer<StorageEvent>(200);

  private errorAggregator = new Map<string, ErrorEvent>();
  private listeners = new Set<() => void>();

  // ===== Metrics =====

  recordMetric(name: string, value: number, tags?: Record<string, string>) {
    this.metricsBuffer.push({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name,
      value,
      tags,
      timestamp: Date.now(),
    });
    this.notify();
  }

  /** 累加型 metric（用在計數器） */
  increment(name: string, by = 1, tags?: Record<string, string>) {
    this.recordMetric(name, by, tags);
  }

  getMetrics(name?: string, sinceMs?: number): Metric[] {
    let items = this.metricsBuffer.getAll();
    if (name) items = items.filter((m) => m.name === name);
    if (sinceMs !== undefined) {
      const cutoff = Date.now() - sinceMs;
      items = items.filter((m) => m.timestamp >= cutoff);
    }
    return items;
  }

  /** 對某 metric 做聚合統計 */
  aggregate(name: string, sinceMs: number): {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
  } | null {
    const items = this.getMetrics(name, sinceMs);
    if (items.length === 0) return null;
    const values = items.map((m) => m.value).sort((a, b) => a - b);
    const sum = values.reduce((s, v) => s + v, 0);
    return {
      count: values.length,
      sum,
      avg: sum / values.length,
      min: values[0],
      max: values[values.length - 1],
      p50: values[Math.floor(values.length * 0.5)],
      p95: values[Math.floor(values.length * 0.95)],
    };
  }

  // ===== Errors =====

  recordError(message: string, source: string, severity: Severity = 'error', context?: Record<string, any>, stack?: string) {
    // 同 source + message 5 秒內合併
    const key = `${source}:${message}`;
    const now = Date.now();
    const existing = this.errorAggregator.get(key);

    if (existing && now - existing.timestamp < 5000) {
      existing.count += 1;
      existing.timestamp = now;
      return;
    }

    const event: ErrorEvent = {
      id: `${now}-${Math.random().toString(36).substr(2, 6)}`,
      message,
      stack: stack || (context?.error instanceof Error ? context.error.stack : undefined),
      source,
      severity,
      context,
      timestamp: now,
      count: 1,
    };

    this.errorsBuffer.push(event);
    this.errorAggregator.set(key, event);
    this.notify();

    // 重要錯誤：打到 console + 持久化到 app_logs
    if (severity === 'error' || severity === 'fatal') {
      console.error(`[Monitor] ${source}: ${message}`, context || '');
      // 持久化（避免循環依賴，只 try）
      try {
        logError(
          severity === 'fatal' ? 'system' : 'system',
          message,
          source,
          context
        );
      } catch {}
    } else if (severity === 'warn') {
      try {
        logWarn('system', message, source, context);
      } catch {}
    }
  }

  getErrors(severity?: Severity, sinceMs?: number): ErrorEvent[] {
    let items = this.errorsBuffer.getAll();
    if (severity) items = items.filter((e) => e.severity === severity);
    if (sinceMs !== undefined) {
      const cutoff = Date.now() - sinceMs;
      items = items.filter((e) => e.timestamp >= cutoff);
    }
    return items.reverse(); // 最新在前
  }

  getErrorCount(sinceMs: number): { total: number; bySource: Record<string, number>; bySeverity: Record<Severity, number> } {
    const items = this.getErrors(undefined, sinceMs);
    const bySource: Record<string, number> = {};
    const bySeverity: Record<string, number> = { debug: 0, info: 0, warn: 0, error: 0, fatal: 0 };
    for (const e of items) {
      bySource[e.source] = (bySource[e.source] || 0) + e.count;
      bySeverity[e.severity] = (bySeverity[e.severity] || 0) + e.count;
    }
    return { total: items.reduce((s, e) => s + e.count, 0), bySource, bySeverity: bySeverity as Record<Severity, number> };
  }

  // ===== Performance =====

  /** 計時 helper：自動測量異步函式耗時 */
  async time<T>(name: string, fn: () => Promise<T>, meta?: Record<string, any>): Promise<T> {
    const start = performance.now();
    let success = true;
    try {
      const result = await fn();
      return result;
    } catch (err) {
      success = false;
      throw err;
    } finally {
      const durationMs = performance.now() - start;
      this.perfBuffer.push({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        name,
        durationMs,
        meta,
        success,
        timestamp: Date.now(),
      });
      this.notify();
    }
  }

  recordPerf(name: string, durationMs: number, success = true, meta?: Record<string, any>) {
    this.perfBuffer.push({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name,
      durationMs,
      meta,
      success,
      timestamp: Date.now(),
    });
    this.notify();
  }

  getPerformance(name?: string, sinceMs?: number): PerformanceMark[] {
    let items = this.perfBuffer.getAll();
    if (name) items = items.filter((p) => p.name === name);
    if (sinceMs !== undefined) {
      const cutoff = Date.now() - sinceMs;
      items = items.filter((p) => p.timestamp >= cutoff);
    }
    return items;
  }

  // ===== Storage =====

  recordStorage(event: Omit<StorageEvent, 'id' | 'timestamp'>) {
    this.storageBuffer.push({
      ...event,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: Date.now(),
    });
    this.notify();
  }

  getStorageEvents(sinceMs?: number): StorageEvent[] {
    let items = this.storageBuffer.getAll();
    if (sinceMs !== undefined) {
      const cutoff = Date.now() - sinceMs;
      items = items.filter((e) => e.timestamp >= cutoff);
    }
    return items.reverse();
  }

  // ===== Subscriptions =====

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    for (const cb of this.listeners) cb();
  }

  // ===== Stats =====

  getStats() {
    return {
      metricsCount: this.metricsBuffer.items.length,
      errorsCount: this.errorsBuffer.items.length,
      perfCount: this.perfBuffer.items.length,
      storageCount: this.storageBuffer.items.length,
    };
  }

  clear() {
    this.metricsBuffer.clear();
    this.errorsBuffer.clear();
    this.perfBuffer.clear();
    this.storageBuffer.clear();
    this.errorAggregator.clear();
    this.notify();
  }
}

export const monitor = new MonitoringSystem();
