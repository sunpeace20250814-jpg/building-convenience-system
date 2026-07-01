/**
 * useScheduleNotes — React Hook 封裝 schedule_notes 資料讀取 + CRUD
 *
 * 對應 api/schedule-notes.ts（calendar module 使用的個人筆記/待辦/日記）
 */

import { useEffect, useState, useCallback } from 'react';
import {
  scheduleNotesApi,
  type ScheduleNoteDTO,
  type ScheduleNoteType,
  type CreateScheduleNoteInput,
  type UpdateScheduleNoteInput,
} from '@/api/schedule-notes';

// Re-export 型別給 consumer 直接從 hook 拿
export type { ScheduleNoteDTO, ScheduleNoteType };

interface UseScheduleNotesState {
  notes: ScheduleNoteDTO[];
  isLoading: boolean;
  error: string | null;
}

interface UseScheduleNotesActions {
  load: () => Promise<void>;
  create: (data: CreateScheduleNoteInput) => Promise<ScheduleNoteDTO>;
  update: (id: string, data: UpdateScheduleNoteInput) => Promise<ScheduleNoteDTO>;
  remove: (id: string) => Promise<void>;
}

export function useScheduleNotes(autoLoad = true): UseScheduleNotesState & UseScheduleNotesActions {
  const [notes, setNotes] = useState<ScheduleNoteDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await scheduleNotesApi.list();
      setNotes(data);
    } catch (e: any) {
      setError(e?.message ?? '載入失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const create = useCallback(async (data: CreateScheduleNoteInput) => {
    const created = await scheduleNotesApi.create(data);
    setNotes((prev) => [...prev, created]);
    return created;
  }, []);

  const update = useCallback(async (id: string, data: UpdateScheduleNoteInput) => {
    const updated = await scheduleNotesApi.update(id, data);
    setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await scheduleNotesApi.remove(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  useEffect(() => {
    if (autoLoad) void load();
  }, [autoLoad, load]);

  return { notes, isLoading, error, load, create, update, remove };
}
