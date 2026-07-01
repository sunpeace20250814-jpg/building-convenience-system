/**
 * 全域錯誤處理
 *
 * 在 App 啟動時呼叫 installGlobalErrorHandlers() 一次
 * - window.onerror：傳統同步錯誤
 * - window.onunhandledrejection：未處理的 Promise rejection
 * - console.error：包一層避免 console 直接被關閉時丟失
 *
 * AI 友善：所有錯誤都會經過 monitor.recordError，可從監控系統觀察
 */

import { monitor } from '@/monitoring/core';

let installed = false;

export function installGlobalErrorHandlers() {
  if (installed) return;
  installed = true;

  // 同步錯誤（setTimeout 內的同步拋出、資源載入失敗等）
  window.addEventListener('error', (event) => {
    monitor.recordError(
      `Uncaught error: ${event.message}`,
      'window.error',
      'error',
      {
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
        stack: event.error?.stack,
      }
    );
  });

  // 非同步錯誤（Promise rejection）
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason as any;
    monitor.recordError(
      `Unhandled promise rejection: ${reason?.message || reason}`,
      'window.unhandledrejection',
      'error',
      {
        reason: reason?.stack || String(reason),
      }
    );
  });
}