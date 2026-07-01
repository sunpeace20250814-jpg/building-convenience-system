/**
 * useTraining — React Hook 封裝 training_records 資料讀取 + CRUD
 *
 * 對應 api/training.ts
 */

import { useEffect, useState, useCallback } from 'react';
import {
  trainingApi,
  type TrainingRecordDTO,
  type CreateTrainingRecordInput,
  type UpdateTrainingRecordInput,
} from '@/api/training';

// Re-export 型別給 consumer 直接從 hook 拿
export type { TrainingRecordDTO };

interface UseTrainingState {
  records: TrainingRecordDTO[];
  isLoading: boolean;
  error: string | null;
}

interface UseTrainingActions {
  load: () => Promise<void>;
  loadByEmployee: (employeeId: string) => Promise<TrainingRecordDTO[]>;
  create: (data: CreateTrainingRecordInput) => Promise<TrainingRecordDTO>;
  update: (id: string, data: UpdateTrainingRecordInput) => Promise<TrainingRecordDTO>;
  remove: (id: string) => Promise<void>;
}

export function useTraining(autoLoad = true): UseTrainingState & UseTrainingActions {
  const [records, setRecords] = useState<TrainingRecordDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await trainingApi.list();
      setRecords(data);
    } catch (e: any) {
      setError(e?.message ?? '載入失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadByEmployee = useCallback(async (employeeId: string) => {
    return trainingApi.listByEmployee(employeeId);
  }, []);

  const create = useCallback(async (data: CreateTrainingRecordInput) => {
    const created = await trainingApi.create(data);
    setRecords((prev) => [...prev, created]);
    return created;
  }, []);

  const update = useCallback(async (id: string, data: UpdateTrainingRecordInput) => {
    const updated = await trainingApi.update(id, data);
    setRecords((prev) => prev.map((r) => (r.id === id ? updated : r)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await trainingApi.remove(id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }, []);

  useEffect(() => {
    if (autoLoad) void load();
  }, [autoLoad, load]);

  return { records, isLoading, error, load, loadByEmployee, create, update, remove };
}
