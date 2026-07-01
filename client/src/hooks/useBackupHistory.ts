/**
 * useBackupHistory — React Hook 封裝 backup_history 資料讀取 + CRUD
 *
 * 對應 api/backup-history.ts
 *
 * 注意：真正備份（createBackup/restoreFromFile）仍走 client-side @/storage/backupManager
 * 因為需要瀏覽器 FileSystem Access API 操作本機 OPFS。
 * 本 hook 僅負責「備份歷史紀錄」的伺服器端鏡像（多裝置同步用）。
 */

import { useEffect, useState, useCallback } from 'react';
import {
  backupHistoryApi,
  type BackupHistoryDTO,
  type CreateBackupHistoryInput,
  type UpdateBackupHistoryInput,
} from '@/api/backup-history';

interface UseBackupHistoryState {
  history: BackupHistoryDTO[];
  isLoading: boolean;
  error: string | null;
}

interface UseBackupHistoryActions {
  load: () => Promise<void>;
  create: (data: CreateBackupHistoryInput) => Promise<BackupHistoryDTO>;
  update: (id: string, data: UpdateBackupHistoryInput) => Promise<BackupHistoryDTO>;
  remove: (id: string) => Promise<void>;
}

export function useBackupHistory(autoLoad = true): UseBackupHistoryState & UseBackupHistoryActions {
  const [history, setHistory] = useState<BackupHistoryDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await backupHistoryApi.list();
      setHistory(data);
    } catch (e: any) {
      setError(e?.message ?? '載入備份歷史失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const create = useCallback(async (data: CreateBackupHistoryInput) => {
    const created = await backupHistoryApi.create(data);
    setHistory((prev) => [created, ...prev]);
    return created;
  }, []);

  const update = useCallback(async (id: string, data: UpdateBackupHistoryInput) => {
    const updated = await backupHistoryApi.update(id, data);
    setHistory((prev) => prev.map((h) => (h.id === id ? updated : h)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await backupHistoryApi.remove(id);
    setHistory((prev) => prev.filter((h) => h.id !== id));
  }, []);

  useEffect(() => {
    if (autoLoad) void load();
  }, [autoLoad, load]);

  return { history, isLoading, error, load, create, update, remove };
}