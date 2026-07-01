/**
 * useEmployees — React Hook 封裝 employees 資料讀取 + CRUD
 *
 * ★ Go-style 設計：
 *   - 元件呼叫這個 hook，不直接呼叫 api.employees
 *   - hook 內部管 loading / error / data 狀態
 *   - 之後若改用 React Query / SWR 只要改這個檔
 */

import { useEffect, useState, useCallback } from 'react';
import {
  employeesApi,
  type EmployeeDTO,
  type CreateEmployeeInput,
  type UpdateEmployeeInput,
} from '@/api/employees';

interface UseEmployeesState {
  employees: EmployeeDTO[];
  isLoading: boolean;
  error: string | null;
}

interface UseEmployeesActions {
  load: (includeInactive?: boolean) => Promise<void>;
  create: (data: CreateEmployeeInput) => Promise<EmployeeDTO>;
  update: (id: string, data: UpdateEmployeeInput) => Promise<EmployeeDTO>;
  remove: (id: string) => Promise<void>;
}

export function useEmployees(autoLoad = true, includeInactive = false): UseEmployeesState & UseEmployeesActions {
  const [employees, setEmployees] = useState<EmployeeDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (incl = includeInactive) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await employeesApi.list(incl);
      setEmployees(data);
    } catch (e: any) {
      setError(e?.message ?? '載入失敗');
    } finally {
      setIsLoading(false);
    }
  }, [includeInactive]);

  const create = useCallback(async (data: CreateEmployeeInput) => {
    const created = await employeesApi.create(data);
    setEmployees((prev) => [...prev, created]);
    return created;
  }, []);

  const update = useCallback(async (id: string, data: UpdateEmployeeInput) => {
    const updated = await employeesApi.update(id, data);
    setEmployees((prev) => prev.map((e) => (e.id === id ? updated : e)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await employeesApi.remove(id);
    setEmployees((prev) => prev.filter((e) => e.id !== id));
  }, []);

  useEffect(() => {
    if (autoLoad) void load();
  }, [autoLoad, load]);

  return { employees, isLoading, error, load, create, update, remove };
}
