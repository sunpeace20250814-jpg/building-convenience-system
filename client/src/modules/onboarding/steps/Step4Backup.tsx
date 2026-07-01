/**
 * 首次啟動精靈 — 步驟 4：設定每日備份
 */

import { useEffect, useState } from 'react';
import { Save, Clock, FolderOpen, Check, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { detectEnvironment, type Environment } from '@/lib/environment';
import { cn } from '@/lib/utils';

interface Step4BackupProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  backupDir: string;
  onBackupDirChange: (dir: string) => void;
  keepCount: number;
  onKeepCountChange: (count: number) => void;
  scheduleHour: number;
  onScheduleHourChange: (hour: number) => void;
}

export function Step4Backup({
  enabled,
  onEnabledChange,
  backupDir,
  onBackupDirChange,
  keepCount,
  onKeepCountChange,
  scheduleHour,
  onScheduleHourChange,
}: Step4BackupProps) {
  const toast = useToast();
  const [env, setEnv] = useState<Environment | null>(null);
  const [, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const e = await detectEnvironment();
        setEnv(e);

        // 自動建議備份位置
        if (!backupDir && e.v4InstallPath) {
          const suggested = `${e.v4InstallPath}\\backups`;
          onBackupDirChange(suggested);
        } else if (!backupDir) {
          onBackupDirChange('backups');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleTest = async () => {
    if (!backupDir) return;
    setTesting(true);
    setTestResult(null);
    try {
      // 透過 PowerShell server 測試資料夾可寫入
      const resp = await fetch('/api/test-backup-dir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: backupDir }),
      });
      const data = await resp.json();
      if (data.ok) {
        setTestResult({ ok: true, msg: '備份位置可寫入 ✓' });
        toast.addToast('備份位置測試成功', 'success');
      } else {
        setTestResult({ ok: false, msg: data.error || '測試失敗' });
      }
    } catch (err: any) {
      setTestResult({ ok: false, msg: err?.message || '無法連線到 server' });
    } finally {
      setTesting(false);
    }
  };

  const handleBrowse = async () => {
    // 透過 PowerShell server 開啟資料夾選擇對話框
    try {
      const resp = await fetch('/api/pick-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialPath: backupDir }),
      });
      const data = await resp.json();
      if (data.path) {
        onBackupDirChange(data.path);
        setTestResult(null);
      }
    } catch (err: any) {
      toast.addToast('無法開啟資料夾選擇器：' + (err?.message || '未知錯誤'), 'error');
    }
  };

  const cloudDrives = env?.cloudDrives.filter((d) => d.available) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
          <Save className="w-6 h-6 text-amber-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">設定每日自動備份</h2>
          <p className="text-sm text-gray-500">
            建議開啟 — 萬一資料損壞可還原
          </p>
        </div>
      </div>

      {/* 開關 */}
      <label className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
        <div>
          <div className="font-medium text-gray-900">啟用每日自動備份</div>
          <div className="text-sm text-gray-500 mt-0.5">
            每天自動匯出資料庫到指定資料夾
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => onEnabledChange(!enabled)}
          className={cn(
            'relative w-12 h-6 rounded-full transition-colors',
            enabled ? 'bg-blue-600' : 'bg-gray-300'
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
              enabled && 'translate-x-6'
            )}
          />
        </button>
      </label>

      {enabled && (
        <div className="space-y-4 pl-4 border-l-2 border-blue-200">
          {/* 備份位置 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              備份位置
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={backupDir}
                onChange={(e) => {
                  onBackupDirChange(e.target.value);
                  setTestResult(null);
                }}
                placeholder="例如：D:\V4-Backups 或 G:\我的雲端硬碟\V4\backups"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <Button variant="secondary" size="md" onClick={handleBrowse}>
                <FolderOpen className="w-4 h-4 mr-1" />
                瀏覽
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={handleTest}
                disabled={testing || !backupDir}
              >
                {testing ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-1" />
                )}
                測試
              </Button>
            </div>
            {testResult && (
              <p
                className={cn(
                  'text-xs mt-1.5 flex items-center gap-1',
                  testResult.ok ? 'text-green-600' : 'text-red-600'
                )}
              >
                {testResult.ok ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <AlertCircle className="w-3 h-3" />
                )}
                {testResult.msg}
              </p>
            )}

            {/* 雲端建議 */}
            {cloudDrives.length > 0 && (
              <div className="mt-2 text-xs text-gray-600">
                💡 已偵測到雲端硬碟，建議放：
                {cloudDrives.map((d) => (
                  <button
                    key={d.type}
                    onClick={() => {
                      if (d.mountPath) {
                        onBackupDirChange(`${d.mountPath}\\V4 住戶管理\\backups`);
                        setTestResult(null);
                      }
                    }}
                    className="ml-1 text-blue-600 hover:underline"
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 保留份數 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              保留份數（自動清掉太舊的）
            </label>
            <input
              type="number"
              min={1}
              max={365}
              value={keepCount}
              onChange={(e) => onKeepCountChange(Number.parseInt(e.target.value, 10) || 30)}
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <span className="ml-2 text-xs text-gray-500">份</span>
          </div>

          {/* 排程時間 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              備份時間
            </label>
            <select
              value={scheduleHour}
              onChange={(e) => onScheduleHourChange(Number.parseInt(e.target.value, 10))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>
                  {i.toString().padStart(2, '0')}:00
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              建議 02:00 — 凌晨沒人在用
            </p>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400">
        備份設定之後可在「備份」模組中變更
      </p>
    </div>
  );
}