/**
 * useFacilityBookings — React Hook 封裝 facility_bookings 資料讀取 + CRUD
 *
 * 對應 api/facility-bookings.ts
 *
 * 注意：server route 待 sibling task 提供；目前 404 不影響 typecheck/build。
 */

import { useEffect, useState, useCallback } from 'react';
import {
  facilityBookingsApi,
  type FacilityBookingDTO,
  type CreateFacilityBookingInput,
  type UpdateFacilityBookingInput,
} from '@/api/facility-bookings';

interface UseFacilityBookingsState {
  bookings: FacilityBookingDTO[];
  isLoading: boolean;
  error: string | null;
}

interface UseFacilityBookingsActions {
  load: () => Promise<void>;
  loadByDate: (date: string) => Promise<FacilityBookingDTO[]>;
  loadByMonth: (year: number, month: number) => Promise<FacilityBookingDTO[]>;
  create: (data: CreateFacilityBookingInput) => Promise<FacilityBookingDTO>;
  update: (id: string, data: UpdateFacilityBookingInput) => Promise<FacilityBookingDTO>;
  remove: (id: string) => Promise<void>;
  togglePaid: (id: string) => Promise<void>;
}

export function useFacilityBookings(autoLoad = true): UseFacilityBookingsState & UseFacilityBookingsActions {
  const [bookings, setBookings] = useState<FacilityBookingDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await facilityBookingsApi.list();
      setBookings(data);
    } catch (e: any) {
      setError(e?.message ?? '載入借用紀錄失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadByDate = useCallback(async (date: string) => {
    return facilityBookingsApi.listByDate(date);
  }, []);

  const loadByMonth = useCallback(async (year: number, month: number) => {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return facilityBookingsApi.listByRange(start, end);
  }, []);

  const create = useCallback(async (data: CreateFacilityBookingInput) => {
    const created = await facilityBookingsApi.create(data);
    setBookings((prev) => [created, ...prev]);
    return created;
  }, []);

  const update = useCallback(async (id: string, data: UpdateFacilityBookingInput) => {
    const updated = await facilityBookingsApi.update(id, data);
    setBookings((prev) => prev.map((b) => (b.id === id ? updated : b)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await facilityBookingsApi.remove(id);
    setBookings((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const togglePaid = useCallback(async (id: string) => {
    const existing = bookings.find((b) => b.id === id);
    if (!existing) return;
    const newPaid = existing.paid ? 0 : 1;
    await facilityBookingsApi.update(id, { paid: newPaid });
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, paid: newPaid } : b)));
  }, [bookings]);

  useEffect(() => {
    if (autoLoad) void load();
  }, [autoLoad, load]);

  return {
    bookings,
    isLoading,
    error,
    load,
    loadByDate,
    loadByMonth,
    create,
    update,
    remove,
    togglePaid,
  };
}