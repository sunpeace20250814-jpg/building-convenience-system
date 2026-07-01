/**
 * APP 系統紀錄頁面
 */

import { useEffect, useState } from 'react';
import { Trash2, Search, Filter, RefreshCw, Shield, Info, AlertTriangle, AlertCircle, Bug } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { getLogs, clearLogs, logInfo, getLogStats, type AppLog, type LogLevel, type LogSource } from '@/storage/appLog';

const LEVEL_META: Record<LogLevel, { label: string; icon: any; color: string; bg: string }> = {
  info: { label: '資訊', icon: Info, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  warn: { label: '警告', icon: AlertTriangle, color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
  error: { label: '錯誤', icon: AlertCircle, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  debug: { label: '除錯', icon: Bug, color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' },
};

export function AuditLogPage() {
  const [logs, setLogs] = useState<AppLog[]>([]);
  const [stats, setStats] = useState<{ total: number; byLevel: Record<string, number>; bySource: Record<string, number> }>({ total: 0, byLevel: {}, bySource: {} });
  const [filterLevel, setFilterLevel] = useState<LogLevel | 'all'>('all');
  const [filterSource, setFilterSource] = useState<LogSource | 'all'>('all');
  const [search, setSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const refresh = async () => {
    const [nextLogs, nextStats] = await Promise.all([
      getLogs({
        level: filterLevel === 'all' ? undefined : filterLevel,
        source: filterSource === 'all' ? undefined : filterSource,
        search: search || undefined,
        limit: 200,
      }),
      getLogStats(),
    ]);
    setLogs(nextLogs);
    setStats(nextStats);
  };

  useEffect(() => {
    refresh();
    // 自動寫入一筆「使用者進入此頁」紀錄
    logInfo('user', '開啟 APP 系統紀錄頁面');
  }, []);

  useEffect(() => {
    refresh();
  }, [filterLevel, filterSource, search]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [autoRefresh, filterLevel, filterSource, search]);

  const handleClear = async () => {
    if (!confirm('確定清空所有系統紀錄？')) return;
    await clearLogs();
    refresh();
    logInfo('user', '清空系統紀錄');
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-indigo-600" />
            APP 系統紀錄
          </h1>
          <p className="text-sm text-gray-500 mt-1">所有重要事件的歷史紀錄（啟動、模組操作、AI 呼叫、備份等）</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setAutoRefresh(!autoRefresh)}>
            {autoRefresh ? '自動刷新 ✓' : '自動刷新'}
          </Button>
          <Button variant="secondary" size="sm" onClick={refresh}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            重新整理
          </Button>
          <Button variant="danger" size="sm" onClick={handleClear}>
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            清空
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-4">
        <Card padding="md" className="text-center">
          <p className="text-xs text-gray-500">總計</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </Card>
        <Card padding="md" className="text-center">
          <p className="text-xs text-blue-600">info</p>
          <p className="text-2xl font-bold text-blue-700">{stats.byLevel.info || 0}</p>
        </Card>
        <Card padding="md" className="text-center">
          <p className="text-xs text-yellow-600">warn</p>
          <p className="text-2xl font-bold text-yellow-700">{stats.byLevel.warn || 0}</p>
        </Card>
        <Card padding="md" className="text-center">
          <p className="text-xs text-red-600">error</p>
          <p className="text-2xl font-bold text-red-700">{stats.byLevel.error || 0}</p>
        </Card>
        <Card padding="md" className="text-center">
          <p className="text-xs text-gray-600">debug</p>
          <p className="text-2xl font-bold text-gray-700">{stats.byLevel.debug || 0}</p>
        </Card>
        <Card padding="md" className="text-center">
          <p className="text-xs text-indigo-600">來源數</p>
          <p className="text-2xl font-bold text-indigo-700">{Object.keys(stats.bySource).length}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card padding="md" className="mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋動作或訊息..."
              className="w-full pl-10 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value as any)}
              className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
            >
              <option value="all">全部層級</option>
              <option value="info">資訊</option>
              <option value="warn">警告</option>
              <option value="error">錯誤</option>
              <option value="debug">除錯</option>
            </select>
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value as any)}
              className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
            >
              <option value="all">全部來源</option>
              <option value="system">系統</option>
              <option value="user">使用者</option>
              <option value="ai">AI</option>
              <option value="backup">備份</option>
              <option value="storage">儲存</option>
              <option value="module">模組</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Logs list */}
      {logs.length === 0 ? (
        <Card className="text-center py-12">
          <Shield className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">沒有符合的紀錄</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const meta = LEVEL_META[log.level];
            const Icon = meta.icon;
            let details = null;
            try {
              details = log.details ? JSON.parse(log.details) : null;
            } catch {}
            return (
              <div
                key={log.id}
                className={`border rounded-lg p-3 ${meta.bg}`}
              >
                <div className="flex items-start gap-3">
                  <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${meta.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${meta.color}`}>
                        {meta.label}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded">
                        {log.source}
                      </span>
                      <span className="text-xs text-gray-500 font-mono">
                        {new Date(log.timestamp).toLocaleString('zh-TW')}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-900">{log.action}</p>
                    {log.message && <p className="text-xs text-gray-700 mt-0.5">{log.message}</p>}
                    {details && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-500 cursor-pointer">技術細節</summary>
                        <pre className="mt-1 text-xs text-gray-600 whitespace-pre-wrap font-mono bg-white p-2 rounded border">
                          {JSON.stringify(details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}