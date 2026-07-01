/**
 * 監測系統初始化
 * - 攔截全域 JS 錯誤
 * - 攔截 Promise rejection
 * - 計算頁面可見性 / unload 事件
 * - 定期收集 runtime 資訊
 */

import { monitor } from './core';

let initialized = false;
let sessionStart = Date.now();

export function initMonitoring() {
  if (initialized) return;
  initialized = true;
  sessionStart = Date.now();

  // 未捕獲錯誤
  window.addEventListener('error', (e) => {
    monitor.recordError(
      e.message || 'Unknown error',
      'window.onerror',
      'error',
      {
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
        error: e.error,
      }
    );
  });

  // 未捕獲 Promise rejection
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    monitor.recordError(
      `Unhandled promise rejection: ${message}`,
      'unhandledrejection',
      'error',
      { reason, error: reason }
    );
  });

  // 資源載入錯誤（img, script, css）
  window.addEventListener(
    'error',
    (e) => {
      const target = e.target as HTMLElement;
      if (target && target !== (window as any)) {
        monitor.recordError(
          `Resource load failed: ${target.tagName} ${(target as any).src || (target as any).href || ''}`,
          'resource',
          'warn'
        );
      }
    },
    true // capture phase 才能攔到資源錯誤
  );

  // 頁面可見性
  document.addEventListener('visibilitychange', () => {
    monitor.increment('page.visibility', 1, { state: document.hidden ? 'hidden' : 'visible' });
  });

  // 頁面卸載前
  window.addEventListener('beforeunload', () => {
    monitor.increment('page.unload', 1);
  });

  // 定期收集 runtime metric
  startRuntimeMetrics();
}

function startRuntimeMetrics() {
  setInterval(() => {
    const mem = (performance as any).memory;
    if (mem) {
      monitor.recordMetric('memory.usedJSHeapSize', mem.usedJSHeapSize);
      monitor.recordMetric('memory.totalJSHeapSize', mem.totalJSHeapSize);
      monitor.recordMetric('memory.jsHeapSizeLimit', mem.jsHeapSizeLimit);
    }

    monitor.recordMetric('session.uptimeMs', Date.now() - sessionStart);
    monitor.recordMetric('document.hidden', document.hidden ? 1 : 0);
  }, 10_000); // 每 10 秒
}
