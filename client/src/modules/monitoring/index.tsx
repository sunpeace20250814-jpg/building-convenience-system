/**
 * 監測儀表板頁面
 * 顯示：
 * - 系統狀態（uptime, error counts）
 * - SQL 查詢效能（p50/p95/avg）
 * - 儲存事件（寫入/讀取/失敗）
 * - 錯誤清單
 * - 壓力測試工具
 */

import { useState, useMemo } from 'react';
import { useMonitoring, useMonitoringTick } from '@/monitoring/hooks';
import { monitor } from '@/monitoring/core';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { runStressTest, type StressTestResult } from '@/monitoring/stress-test';
import { Activity, AlertTriangle, Database, Clock, Trash2, Zap, Play } from 'lucide-react';
// ★ Phase 9：getDb() 已從 @/storage/database 移除（V4 不再有本地 SQLite）
//   改用 server-side 統計（見 monitoring/core.ts）

type Tab = 'overview' | 'errors' | 'performance' | 'storage' | 'stress';

export function MonitoringModule() {
  const [tab, setTab] = useState<Tab>('overview');
  useMonitoringTick(2000);
  const { errorStats, clear } = useMonitoring();

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="監測系統"
        description="系統健康、效能、儲存狀態即時監控"
        actions={
          <Button variant="secondary" onClick={clear}>
            <Trash2 className="w-4 h-4 mr-2" />
            清除全部
          </Button>
        }
      />

      <div className="flex gap-1 border-b">
        {(['overview', 'errors', 'performance', 'storage', 'stress'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {{
              overview: '總覽',
              errors: `錯誤 (${errorStats.total})`,
              performance: '效能',
              storage: '儲存',
              stress: '壓力測試',
            }[t]}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab />}
      {tab === 'errors' && <ErrorsTab />}
      {tab === 'performance' && <PerformanceTab />}
      {tab === 'storage' && <StorageTab />}
      {tab === 'stress' && <StressTab />}
    </div>
  );
}

function OverviewTab() {
  const { errorStats, stats } = useMonitoring();
  const [dbStats, setDbStats] = useState<{ tables: Record<string, number>; total: number } | null>(null);

  useMonitoringTick(5000);
  useMemo(() => {
    // ★ Phase 9：本地 SQLite DB 已移除，無法直接讀取 table counts
    //   此功能需要 server-side 統計 API 補上（見 ERR-017 tech debt）
    setDbStats(null);
  }, [stats.metricsCount]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="資料筆數"
          value={dbStats?.total ?? 0}
          icon={<Database className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          label="錯誤數 (24h)"
          value={errorStats.total}
          icon={<AlertTriangle className="w-5 h-5" />}
          color={errorStats.total > 0 ? 'red' : 'green'}
        />
        <StatCard
          label="Metrics 緩衝"
          value={stats.metricsCount}
          icon={<Activity className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          label="Perf 記錄"
          value={stats.perfCount}
          icon={<Clock className="w-5 h-5" />}
          color="blue"
        />
      </div>

      <Card>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">錯誤來源分佈（24 小時內）</h3>
        {Object.keys(errorStats.bySource).length === 0 ? (
          <p className="text-sm text-gray-500">尚無錯誤</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(errorStats.bySource)
              .sort((a, b) => b[1] - a[1])
              .map(([source, count]) => {
                const max = Math.max(...Object.values(errorStats.bySource));
                const pct = (count / max) * 100;
                return (
                  <div key={source}>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700">{source}</span>
                      <span className="text-gray-500">{count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded mt-1">
                      <div
                        className="h-2 bg-red-500 rounded"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </Card>

      {dbStats && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">資料表統計</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(dbStats.tables)
              .sort((a, b) => b[1] - a[1])
              .map(([table, count]) => (
                <div key={table} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
                  <span className="text-xs text-gray-600">{table}</span>
                  <Badge variant={count > 0 ? 'info' : 'default'}>{count}</Badge>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: 'blue' | 'red' | 'green' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    green: 'bg-green-50 text-green-600',
  };
  return (
    <Card>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </Card>
  );
}

function ErrorsTab() {
  const { errors } = useMonitoring();

  if (errors.length === 0) {
    return (
      <Card>
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">太棒了，目前沒有任何錯誤！</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="space-y-3">
        {errors.map((err) => (
          <div
            key={err.id}
            className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge
                    variant={err.severity === 'fatal' ? 'danger' : err.severity === 'error' ? 'danger' : 'warning'}
                  >
                    {err.severity}
                  </Badge>
                  <span className="text-xs text-gray-500">{err.source}</span>
                  {err.count > 1 && (
                    <Badge variant="info">×{err.count}</Badge>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-900">{err.message}</p>
                {err.context && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-500 cursor-pointer">Context</summary>
                    <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                      {JSON.stringify(err.context, null, 2)}
                    </pre>
                  </details>
                )}
                {err.stack && (
                  <details className="mt-1">
                    <summary className="text-xs text-gray-500 cursor-pointer">Stack</summary>
                    <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                      {err.stack}
                    </pre>
                  </details>
                )}
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap ml-3">
                {new Date(err.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PerformanceTab() {
  const allPerf = monitor.getPerformance();
  const groups = useMemo(() => {
    const map = new Map<string, typeof allPerf>();
    for (const p of allPerf) {
      if (!map.has(p.name)) map.set(p.name, []);
      map.get(p.name)!.push(p);
    }
    return Array.from(map.entries());
  }, [allPerf.length]);

  return (
    <div className="space-y-4">
      {groups.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-500 text-center py-8">尚無效能資料，請執行一些操作</p>
        </Card>
      ) : (
        groups.map(([name, samples]) => {
          const durations = samples.map((s) => s.durationMs).sort((a, b) => a - b);
          const sum = durations.reduce((s, d) => s + d, 0);
          const stats = {
            count: durations.length,
            avg: sum / durations.length,
            min: durations[0],
            max: durations[durations.length - 1],
            p50: durations[Math.floor(durations.length * 0.5)],
            p95: durations[Math.floor(durations.length * 0.95)],
            successRate: samples.filter((s) => s.success).length / samples.length,
          };
          return (
            <Card key={name}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">{name}</h3>
                <Badge variant={stats.successRate === 1 ? 'success' : 'danger'}>
                  成功率 {(stats.successRate * 100).toFixed(0)}%
                </Badge>
              </div>
              <div className="grid grid-cols-6 gap-3 text-center">
                <div>
                  <p className="text-xs text-gray-500">次數</p>
                  <p className="text-lg font-semibold text-gray-900">{stats.count}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">平均</p>
                  <p className="text-lg font-semibold text-gray-900">{stats.avg.toFixed(1)}ms</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">P50</p>
                  <p className="text-lg font-semibold text-gray-900">{stats.p50.toFixed(1)}ms</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">P95</p>
                  <p className={`text-lg font-semibold ${stats.p95 > 100 ? 'text-orange-600' : 'text-gray-900'}`}>
                    {stats.p95.toFixed(1)}ms
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Min</p>
                  <p className="text-lg font-semibold text-gray-900">{stats.min.toFixed(1)}ms</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Max</p>
                  <p className={`text-lg font-semibold ${stats.max > 1000 ? 'text-red-600' : 'text-gray-900'}`}>
                    {stats.max.toFixed(1)}ms
                  </p>
                </div>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}

function StorageTab() {
  const events = monitor.getStorageEvents();

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">儲存事件</h3>
        {events.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">尚無儲存事件</p>
        ) : (
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {events.slice(0, 100).map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between text-sm py-1 px-2 hover:bg-gray-50 rounded"
              >
                <div className="flex items-center gap-3">
                  <Badge variant={e.success ? 'success' : 'danger'} size="sm">
                    {e.kind}
                  </Badge>
                  {e.bytes !== undefined && (
                    <span className="text-xs text-gray-500">{(e.bytes / 1024).toFixed(1)} KB</span>
                  )}
                  <span className="text-xs text-gray-500">{e.durationMs.toFixed(1)}ms</span>
                  {e.error && <span className="text-xs text-red-600">{e.error}</span>}
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(e.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StressTab() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<StressTestResult | null>(null);

  async function handleRun() {
    if (!confirm('壓力測試會插入大量資料，可能會讓資料庫膨脹。繼續？')) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await runStressTest(500);
      setResult(res);
    } finally {
      setRunning(false);
    }
  }

  async function handleClean() {
    if (!confirm('確定要清空所有測試資料？')) return;
    try {
      // ★ Phase 9：本地 SQLite DB 已移除，無法直接 DELETE
      //   此功能需要 server-side 路由支援（見 ERR-017 tech debt）
      monitor.recordMetric('stress.cleanup', 1, { status: 'noop', reason: 'local-db-removed' });
      console.warn('[monitoring] handleClean: 本地 SQLite 已移除，需 server-side 路由支援');
    } catch (err: any) {
      monitor.recordError('Stress cleanup failed', 'stress-test', 'error', { error: err.message });
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">壓力測試</h3>
        <p className="text-xs text-gray-500 mb-4">
          自動產生 500 筆合成資料，測量寫入、查詢效能，找出瓶頸。
        </p>
        <div className="flex gap-2">
          <Button onClick={handleRun} disabled={running}>
            {running ? (
              <>
                <Zap className="w-4 h-4 mr-2 animate-pulse" />
                執行中...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                開始壓力測試
              </>
            )}
          </Button>
          <Button variant="secondary" onClick={handleClean}>
            <Trash2 className="w-4 h-4 mr-2" />
            清空測試資料
          </Button>
        </div>
      </Card>

      {result && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">測試結果</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500">總耗時</p>
              <p className="text-2xl font-bold text-gray-900">{(result.totalMs / 1000).toFixed(2)}s</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">寫入筆數</p>
              <p className="text-2xl font-bold text-gray-900">{result.written}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">寫入速率</p>
              <p className="text-2xl font-bold text-gray-900">
                {Math.round(result.written / (result.totalMs / 1000))} <span className="text-sm font-normal text-gray-500">筆/s</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">平均查詢延遲</p>
              <p className="text-2xl font-bold text-gray-900">{result.avgQueryMs.toFixed(1)}ms</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">P95 查詢延遲</p>
              <p className={`text-2xl font-bold ${result.p95QueryMs > 100 ? 'text-orange-600' : 'text-gray-900'}`}>
                {result.p95QueryMs.toFixed(1)}ms
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">DB 大小</p>
              <p className="text-2xl font-bold text-gray-900">
                {(result.dbSizeBytes / 1024).toFixed(1)} <span className="text-sm font-normal text-gray-500">KB</span>
              </p>
            </div>
          </div>
          {result.bottlenecks.length > 0 && (
            <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-sm font-semibold text-orange-900 mb-1">發現瓶頸：</p>
              <ul className="text-xs text-orange-800 space-y-1">
                {result.bottlenecks.map((b, i) => (
                  <li key={i}>• {b}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
