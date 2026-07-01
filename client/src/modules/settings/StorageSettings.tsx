/**
 * ServerSettings - 後端連線狀態
 *
 * V4 Phase 9 重寫：
 * - 取代舊版 StorageSettings（IndexedDB / FSA 切換）
 * - V4 已無本地儲存切換概念，全部走 server
 * - 此頁只顯示 server 連線狀態 + 環境資訊
 *
 * 詳細錯誤規則：見 V4/ERRORS.md ERR-014
 */

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Server, CheckCircle, AlertCircle, RefreshCw, Database, Cloud, Info } from 'lucide-react';
import { pingBackend } from '@/lib/apiClient';
import { detectEnvironment, type Environment } from '@/lib/environment';

export function StorageSettings() {
  const [alive, setAlive] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [env, setEnv] = useState<Environment | null>(null);

  const refresh = async () => {
    setChecking(true);
    try {
      const [r, e] = await Promise.all([pingBackend(), detectEnvironment()]);
      setAlive(r);
      setEnv(e);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const cloudDrives = env?.cloudDrives.filter((d) => d.available && d.mountPath) || [];

  return (
    <div className="space-y-6">
      {/* 後端連線狀態 */}
      <Card className={alive ? 'border-green-200 bg-green-50/30' : 'border-red-200 bg-red-50/30'}>
        <div className="flex items-start gap-3">
          {alive === null ? (
            <RefreshCw className="w-5 h-5 text-gray-400 mt-0.5 animate-spin" />
          ) : alive ? (
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          )}
          <div className="flex-1">
            <h3 className="font-medium text-gray-900">後端連線狀態</h3>
            <p className="text-sm text-gray-700 mt-1">
              {alive === null ? (
                '檢查中...'
              ) : alive ? (
                <>
                  <strong className="text-green-700">已連線</strong> — V4 server (Fastify + SQLite) 正常運作
                </>
              ) : (
                <>
                  <strong className="text-red-700">無法連線</strong> — 請確認 server 已在 port 3001 運行
                </>
              )}
            </p>
            <div className="mt-3">
              <Button size="sm" variant="secondary" onClick={refresh} disabled={checking}>
                <RefreshCw className={`w-4 h-4 mr-1 ${checking ? 'animate-spin' : ''}`} />
                重新檢查
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* 架構說明 */}
      <Card>
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-medium text-gray-900 mb-2">V4 儲存架構</h3>
            <div className="space-y-2 text-sm text-gray-700">
              <div className="flex items-start gap-2">
                <Server className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>伺服器端 SQLite</strong> — 所有用戶資料由 Fastify server 管理，集中備份、跨瀏覽器一致
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Database className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>不再使用 IndexedDB / FSA</strong> — 舊版 V3 瀏覽器本地 SQLite 已完全移除
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 雲端偵測（保留向後相容 UI） */}
      {cloudDrives.length > 0 && (
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
          <div className="flex items-start gap-3">
            <Cloud className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">偵測到的雲端硬碟</h3>
              <p className="text-xs text-blue-700 mb-3">
                V4 不再需要雲端硬碟鏡像資料夾（資料已在 server），
                以下資訊僅供參考：
              </p>
              <div className="space-y-1.5">
                {cloudDrives.map((d) => (
                  <div key={d.mountPath || d.name} className="flex items-center gap-2 text-sm bg-white/70 rounded px-2 py-1">
                    <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                    <span className="font-medium text-gray-900">{d.name}</span>
                    <code className="text-xs text-gray-500 truncate flex-1">{d.mountPath}</code>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
