/**
 * Hooks 統一入口 — 所有 V4 資源的 React Hook
 *
 * 使用方式：
 *   import { useBuildings } from '@/hooks';
 *   const { buildings, isLoading, load, create, update, remove } = useBuildings();
 */

export * from './useBuildings';
export * from './useResidents';
export * from './useParkingSpots';
export * from './useStatusOptions';
export * from './useHouseStatuses';
export * from './useParkingStatuses';
export * from './useFloors';
export * from './useFacilities';
export * from './useFacilityBookings';
export * from './useExpenses';
export * from './useExpenseBudgets';
export * from './useAllowanceHolders';
export * from './useAllowanceRecords';
export * from './useSchedule';
export * from './useEmployees';
export * from './useShifts';
export * from './useScheduleNotes';
export * from './useHolidays';
export * from './useHolidayCategories';
export * from './useTraining';
export * from './useHomeTabs';
export * from './useHomeRecords';
export * from './useCalendarEvents';
export * from './useBackupHistory';