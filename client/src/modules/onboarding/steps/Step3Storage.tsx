/**
 * 首次啟動精靈 — 步驟 3：儲存位置
 *
 * V4 Phase 9 重寫：
 * - V4 已無 IndexedDB / FSA 切換概念（全部走 server-side SQLite）
 * - 此步驟保留向後相容 + 顯示說明，自動選用 server backend
 * - 原本的 db.switchToFileSystem / db.switchToIndexedDB 已移除
 */

import { useEffect, useState } from 'react';
import { Database, Cloud, Server, ShieldCheck, Info } from 'lucide-react';
import { detectEnvironment, type Environment } from '@/lib/environment';

interface Step3StorageProps {
  /** 已棄用：保留向後相容（呼叫端不再需要實際值） */
  value: 'indexeddb' | 'filesystem' | null;
  onChange: (value: 'indexeddb' | 'filesystem') => void;
}

export function Step3Storage({ onChange }: Step3StorageProps) {
  const [env, setEnv] = useState<Environment | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const e = await detectEnvironment();
        setEnv(e);
        // 預設選 server（V4 唯一支援）
        onChange('indexeddb'); // 保留舊值向後相容
      } catch {
        // 環境偵測失敗不影響流程
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
          <Database className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">資料儲存位置</h2>
          <p className="text-sm text-gray-500">V4 採用前後端分離架構</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-900 mb-2">V4 已自動管理儲存位置</p>
          <p className="text-sm text-blue-700">
            V4 採用前後端分離架構，用戶資料由 Fastify server 管理（SQLite），
            不再需要選擇 IndexedDB 或本地資料夾。
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="w-full p-4 rounded-lg border-2 border-blue-500 bg-blue-50">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Server className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">伺服器端 SQLite</h3>
                <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                  預設
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                用戶資料由 Fastify server 管理，跨瀏覽器、跨裝置一致。
              </p>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-green-500" />
                  集中備份
                </span>
                <span>•</span>
                <span>無需設定</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 雲端偵測結果（保留向後相容 UI） */}
      {env && env.cloudDrives.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <Cloud className="w-4 h-4" />
            偵測到你的雲端硬碟（V4 已不再需要）
          </h4>
          <p className="text-xs text-gray-500">
            V4 資料由伺服器管理，不再依賴本地端雲端硬碟鏡像。
          </p>
        </div>
      )}

      <p className="text-xs text-gray-400">
        之後可在「設定」中檢視 server 狀態
      </p>
    </div>
  );
}
