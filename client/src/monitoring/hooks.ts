/**
 * React hook 訂閱 monitoring 變化
 */

import { useEffect, useState } from 'react';
import { monitor, ErrorEvent, Metric, PerformanceMark, StorageEvent } from './core';

export function useMonitoring() {
  const [, force] = useState(0);
  useEffect(() => monitor.subscribe(() => force((n) => n + 1)), []);

  return {
    metrics: monitor.getMetrics(),
    errors: monitor.getErrors(),
    performance: monitor.getPerformance(),
    storage: monitor.getStorageEvents(),
    errorStats: monitor.getErrorCount(24 * 60 * 60 * 1000),
    stats: monitor.getStats(),
    clear: () => monitor.clear(),
  };
}

export function useMonitoringTick(intervalMs = 2000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}

export type { Metric, ErrorEvent, PerformanceMark, StorageEvent };
