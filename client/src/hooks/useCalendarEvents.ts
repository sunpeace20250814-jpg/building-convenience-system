/**
 * useCalendarEvents — React Hook 封裝 calendar_events 資料讀取 + CRUD
 *
 * 對應 api/calendar-events.ts
 */

import { useEffect, useState, useCallback } from 'react';
import {
  calendarEventsApi,
  type CalendarEventDTO,
  type CreateCalendarEventInput,
  type UpdateCalendarEventInput,
} from '@/api/calendar-events';

interface UseCalendarEventsState {
  events: CalendarEventDTO[];
  isLoading: boolean;
  error: string | null;
}

interface UseCalendarEventsActions {
  load: () => Promise<void>;
  loadByRange: (start: string, end: string) => Promise<CalendarEventDTO[]>;
  loadByDate: (date: string) => Promise<CalendarEventDTO[]>;
  create: (data: CreateCalendarEventInput) => Promise<CalendarEventDTO>;
  update: (id: string, data: UpdateCalendarEventInput) => Promise<CalendarEventDTO>;
  remove: (id: string) => Promise<void>;
}

export function useCalendarEvents(autoLoad = true): UseCalendarEventsState & UseCalendarEventsActions {
  const [events, setEvents] = useState<CalendarEventDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await calendarEventsApi.list();
      setEvents(data);
    } catch (e: any) {
      setError(e?.message ?? '載入行事曆事件失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadByRange = useCallback(async (start: string, end: string) => {
    return calendarEventsApi.listByRange(start, end);
  }, []);

  const loadByDate = useCallback(async (date: string) => {
    return calendarEventsApi.listByDate(date);
  }, []);

  const create = useCallback(async (data: CreateCalendarEventInput) => {
    const created = await calendarEventsApi.create(data);
    setEvents((prev) => [created, ...prev]);
    return created;
  }, []);

  const update = useCallback(async (id: string, data: UpdateCalendarEventInput) => {
    const updated = await calendarEventsApi.update(id, data);
    setEvents((prev) => prev.map((e) => (e.id === id ? updated : e)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await calendarEventsApi.remove(id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  useEffect(() => {
    if (autoLoad) void load();
  }, [autoLoad, load]);

  return {
    events,
    isLoading,
    error,
    load,
    loadByRange,
    loadByDate,
    create,
    update,
    remove,
  };
}