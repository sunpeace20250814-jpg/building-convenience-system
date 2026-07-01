/**
 * Backup Module - V1 BackupManager 完整移植
 * 功能：
 * - 三種格式：.db / .json / .json.gz
 * - 手動備份 / 還原 / 歷史記錄
 * - 自動排程（每 N 天）
 */

import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
  Database,
  Download,
  Upload,
  Trash2,
  Archive,
  Clock,
  FileText,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  createBackup, restoreFromFile, downloadBackup,
  listBackups, deleteBackupHistory, clearBackupHistory,
  BackupHistory,
} from '@/storage/backupManager';
// ★ Phase 9：getLocationDescription 已從 @/storage/database 移除
//   改為顯示 server backend 描述
import { formatBytes } from '@/utils/format';
import { getCurrentLanguage } from '@/i18n';


export function BackupModule() {
  const { t } = useTranslation();

  const FORMATS = [
    { value: 'db', label: t('backup.formatOptions.db') },
    { value: 'json', label: t('backup.formatOptions.json') },
    { value: 'gz', label: t('backup.formatOptions.gz') },
  ];

  const [history, setHistory] = useState<BackupHistory[]>([]);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [format, setFormat] = useState('json');
  const [note, setNote] = useState('');
  const [result, setResult] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [autoBackupDays, setAutoBackupDays] = useState('7');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastAutoBackupRef = useRef<string | null>(null);

  const refresh = () => setHistory(listBackups());

  useEffect(() => {
    refresh();
    const enabled = localStorage.getItem('v4-auto-backup-enabled') === '1';
    const days = localStorage.getItem('v4-auto-backup-days') || '7';
    const lastAuto = localStorage.getItem('v4-last-auto-backup');
    setAutoBackupEnabled(enabled);
    setAutoBackupDays(days);
    lastAutoBackupRef.current = lastAuto;
  }, []);

  // 自動備份檢查：開啟時若距離上次備份超過 N 天則自動備份
  useEffect(() => {
    if (!autoBackupEnabled) return;
    const checkInterval = setInterval(() => {
      const last = lastAutoBackupRef.current;
      const days = Number(autoBackupDays) || 7;
      const shouldBackup = !last ||
        (Date.now() - new Date(last).getTime()) > days * 24 * 60 * 60 * 1000;
      if (shouldBackup) {
        runBackup('gz', t('backup.autoNote'), true);
      }
    }, 60 * 1000); // 每分鐘檢查
    return () => clearInterval(checkInterval);
  }, [autoBackupEnabled, autoBackupDays]);

  const runBackup = async (fmt: string, noteText = '', isAuto = false) => {
    setCreating(true);
    setResult(null);
    try {
      const { blob, filename, size } = await createBackup(fmt, noteText);
      downloadBackup(blob, filename);
      if (!isAuto) {
        setResult({ kind: 'success', message: t('backup.success.backup', { filename, size: formatBytes(size) }) });
      }
      const now = new Date().toISOString();
      localStorage.setItem('v4-last-auto-backup', now);
      lastAutoBackupRef.current = now;
      refresh();
    } catch (err: any) {
      setResult({ kind: 'error', message: t('backup.error.backup', { message: err.message }) });
    } finally {
      setCreating(false);
    }
  };

  const handleBackup = () => {
    if (!note) return runBackup(format);
    runBackup(format, note);
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoring(true);
    setResult(null);
    try {
      const r = await restoreFromFile(file);
      const msg = r.format === 'db'
        ? t('backup.success.restoreDb')
        : t('backup.success.restoreJson', { tables: r.tables, rows: r.rows });
      setResult({ kind: 'success', message: msg });
      setShowRestoreModal(false);
      refresh();
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      setResult({ kind: 'error', message: t('backup.error.restore', { message: err.message }) });
    } finally {
      setRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleAutoBackup = (enabled: boolean) => {
    setAutoBackupEnabled(enabled);
    localStorage.setItem('v4-auto-backup-enabled', enabled ? '1' : '0');
    if (enabled && !lastAutoBackupRef.current) {
      localStorage.setItem('v4-last-auto-backup', new Date().toISOString());
      lastAutoBackupRef.current = new Date().toISOString();
    }
  };

  const setDays = (d: string) => {
    setAutoBackupDays(d);
    localStorage.setItem('v4-auto-backup-days', d);
  };

  const totalSize = history.reduce((sum, h) => sum + (h.size || 0), 0);
  const locDesc = '伺服器端 SQLite'; // Phase 9: 已無本地儲存
  const localeMap: Record<string, string> = { 'zh-TW': 'zh-TW', 'en': 'en-US' };
  const dateLocale = localeMap[getCurrentLanguage()] || 'zh-TW';

  return (
    <div className="p-6">
      <PageHeader
        title={t('backup.title')}
        description={t('backup.description')}
        actions={
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Database className="w-4 h-4" />
            <span>{locDesc || t('backup.storageLocation')}</span>
          </div>
        }
      />

      {/* 通知列 */}
      {result && (
        <div className={`mb-4 px-4 py-3 rounded-lg flex items-start gap-2 ${
          result.kind === 'success'
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {result.kind === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
          <div className="text-sm">{result.message}</div>
          <button onClick={() => setResult(null)} className="ml-auto text-gray-400 hover:text-gray-600">×</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* 手動備份 */}
        <Card>
          <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Download className="w-4 h-4 text-blue-600" />
            {t('backup.manualBackup')}
          </h3>
          <div className="space-y-3">
            <Select
              label={t('backup.format')}
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              options={FORMATS}
            />
            <Input
              label={t('backup.note')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('backup.notePlaceholder')}
            />
            <Button onClick={handleBackup} disabled={creating} className="w-full">
              {creating ? t('backup.backingUp') : t('backup.backupNow')}
            </Button>
          </div>
        </Card>

        {/* 還原 */}
        <Card>
          <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Upload className="w-4 h-4 text-green-600" />
            {t('backup.restore')}
          </h3>
          <p className="text-sm text-gray-500 mb-3">
            {t('backup.restoreHint')}
          </p>
          <Button onClick={() => setShowRestoreModal(true)} variant="secondary" className="w-full">
            {t('backup.selectFileToRestore')}
          </Button>
        </Card>

        {/* 排程 */}
        <Card>
          <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-purple-600" />
            {t('backup.autoSchedule')}
          </h3>
          <div className="space-y-3">
            <label className="flex items-center justify-between text-sm">
              <span>{t('backup.enableAuto')}</span>
              <input
                type="checkbox"
                checked={autoBackupEnabled}
                onChange={(e) => toggleAutoBackup(e.target.checked)}
                className="w-4 h-4"
              />
            </label>
            <Input
              label={t('backup.intervalDays')}
              type="number"
              min="1"
              value={autoBackupDays}
              onChange={(e) => setDays(e.target.value)}
              disabled={!autoBackupEnabled}
            />
            <p className="text-xs text-gray-500">
              {t('backup.lastBackup')}：{lastAutoBackupRef.current
                ? new Date(lastAutoBackupRef.current).toLocaleString(dateLocale)
                : t('backup.noBackupYet')}
            </p>
          </div>
        </Card>
      </div>

      {/* 歷史記錄 */}
      <Card padding="none">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="font-medium text-gray-900 flex items-center gap-2">
            <Archive className="w-4 h-4" />
            {t('backup.history', { count: history.length, size: formatBytes(totalSize) })}
          </h3>
          {history.length > 0 && (
            <Button size="sm" variant="danger" onClick={() => {
              if (confirm(t('backup.clearAllConfirm'))) {
                clearBackupHistory();
                refresh();
              }
            }}>
              <Trash2 className="w-3.5 h-3.5 mr-1" />{t('backup.clearAll')}
            </Button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <FileText className="w-12 h-12 mb-3" />
            <p>{t('backup.noHistory')}</p>
            <p className="text-sm mt-1">{t('backup.noHistoryHint')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-gray-500">{t('backup.tableHeaders.filename')}</th>
                <th className="px-6 py-3 text-center font-medium text-gray-500">{t('backup.tableHeaders.format')}</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500">{t('backup.tableHeaders.size')}</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">{t('backup.tableHeaders.createdAt')}</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">{t('backup.tableHeaders.note')}</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500">{t('backup.tableHeaders.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {history.map((h) => (
                <tr key={h.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    {h.filename}
                  </td>
                  <td className="px-6 py-3 text-center">
                    <Badge variant="info" size="sm">{h.format}</Badge>
                  </td>
                  <td className="px-6 py-3 text-right text-gray-700">{formatBytes(h.size)}</td>
                  <td className="px-6 py-3 text-gray-600">{new Date(h.createdAt).toLocaleString(dateLocale)}</td>
                  <td className="px-6 py-3 text-gray-500 text-xs">{h.note || '-'}</td>
                  <td className="px-6 py-3 text-right">
                    <Button size="sm" variant="danger" onClick={() => {
                      if (confirm(t('backup.deleteOneConfirm'))) {
                        deleteBackupHistory(h.id);
                        refresh();
                      }
                    }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* 還原 Modal */}
      {showRestoreModal && (
        <Modal
          isOpen
          onClose={() => setShowRestoreModal(false)}
          title={t('backup.restoreModalTitle')}
          size="md"
          footer={
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setShowRestoreModal(false)}>{t('common.cancel')}</Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">{t('backup.warning')}</p>
                <p className="mt-1">{t('backup.warningHint')}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('backup.restoreFile')}</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".db,.json,.gz"
                onChange={handleRestoreFile}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">{t('backup.restoreFormats')}</p>
            </div>

            {restoring && (
              <div className="text-sm text-blue-600 flex items-center gap-2">
                <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                {t('backup.restoring')}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}