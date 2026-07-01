/**
 * Server 狀態指示器
 * 取代舊版 DatabaseStatus（V3 顯示 IndexedDB / FSA 儲存狀態）
 *
 * V4 Phase 9 重寫：
 * - 不再監聽 IndexedDB / FSA 狀態
 * - 只顯示 server 連線狀態
 * - 點擊可重新 pingBackend
 */

import { useEffect, useState } from 'react';
import { Server, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { pingBackend } from '@/lib/apiClient';

export function DatabaseStatus() {
  const [alive, setAlive] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const r = await pingBackend();
      if (!cancelled) setAlive(r);
    };
    check();
    // 每 30s 自動檢查
    const timer = setInterval(check, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const handleRecheck = async () => {
    setChecking(true);
    try {
      const r = await pingBackend();
      setAlive(r);
    } finally {
      setChecking(false);
    }
  };

  const statusIcon =
    alive === null ? (
      <RefreshCw className="w-3 h-3 text-gray-400 animate-spin" />
    ) : alive ? (
      <CheckCircle className="w-3 h-3 text-green-500" />
    ) : (
      <AlertCircle className="w-3 h-3 text-red-500" />
    );

  const statusText =
    alive === null
      ? '檢查中...'
      : alive
      ? '後端連線正常'
      : '無法連線到後端';

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 rounded-lg">
      <Server className="w-4 h-4 text-gray-500 flex-shrink-0" />
      <span className="flex items-center gap-1 text-xs text-gray-500 truncate min-w-0 flex-1">
        {statusIcon}
        <span className="truncate">{statusText}</span>
      </span>
      <button
        onClick={handleRecheck}
        disabled={checking}
        className="p-1 hover:bg-gray-100 rounded flex-shrink-0"
        title="重新檢查"
      >
        <RefreshCw className={`w-3 h-3 text-gray-400 ${checking ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
}
