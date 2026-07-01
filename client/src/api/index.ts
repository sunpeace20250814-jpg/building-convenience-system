/**
 * API 統一入口 — 所有 V4 資源的 fetch 契約
 *
 * 使用方式：
 *   import { api } from '@/api';
 *   const buildings = await api.buildings.list();
 *
 * 加新資源：
 *   1. 在 server/src/routes/ 加 route + 註冊到 index.ts
 *   2. 在 client/src/api/ 加同名檔（如 holidays.ts）
 *   3. 在這裡 export + 加到 api 物件
 */

export * from './buildings';
export * from './residents';
export * from './resident-parking';
export * from './resident-emergency-contacts';
export * from './decoration-records';
export * from './expenses';
export * from './expense-budgets';
export * from './allowance-holders';
export * from './allowance-records';
export * from './schedule';
export * from './employees';
export * from './shifts';
export * from './schedule-holidays';
export * from './schedule-notes';
export * from './holidays';
export * from './holiday-categories';
export * from './training';
export * from './parking-spots';
export * from './parking-binding';
export * from './parking-statuses';
export * from './status-options';
export * from './house-statuses';
export * from './floors';
export * from './facilities';
export * from './facility-bookings';
export * from './home-tabs';
export * from './home-records';
export * from './calendar-events';
export * from './backup-history';
// Sprint 5: 會計 API + 會計報表
export * from './accounting';
export * from './accounting-reports';

import { buildingsApi } from './buildings';
import { residentsApi } from './residents';
import { residentParkingApi } from './resident-parking';
import { residentEmergencyContactsApi } from './resident-emergency-contacts';
import { decorationRecordsApi } from './decoration-records';
import { expensesApi } from './expenses';
import { expenseBudgetsApi } from './expense-budgets';
import { allowanceHoldersApi } from './allowance-holders';
import { allowanceRecordsApi } from './allowance-records';
import { scheduleApi } from './schedule';
import { employeesApi } from './employees';
import { shiftsApi } from './shifts';
import { scheduleHolidaysApi } from './schedule-holidays';
import { scheduleNotesApi } from './schedule-notes';
import { holidaysApi } from './holidays';
import { holidayCategoriesApi } from './holiday-categories';
import { trainingApi } from './training';
import { parkingSpotsApi } from './parking-spots';
import { parkingBindingApi } from './parking-binding';
import { parkingStatusesApi } from './parking-statuses';
import { statusOptionsApi } from './status-options';
import { houseStatusesApi } from './house-statuses';
import { floorsApi } from './floors';
import { facilitiesApi } from './facilities';
import { facilityBookingsApi } from './facility-bookings';
import { homeTabsApi } from './home-tabs';
import { homeRecordsApi } from './home-records';
import { calendarEventsApi } from './calendar-events';
import { backupHistoryApi } from './backup-history';
// Sprint 5: 會計
import { accountingApi } from './accounting';
import { accountingReportsApi } from './accounting-reports';

/**
 * 統一 api 物件 — 所有資源的便捷入口
 *
 *   await api.buildings.list()
 *   await api.residents.create(data)
 *   await api.holidays.list()
 */
export const api = {
  buildings: buildingsApi,
  residents: residentsApi,
  residentParking: residentParkingApi,
  residentEmergencyContacts: residentEmergencyContactsApi,
  decorationRecords: decorationRecordsApi,
  expenses: expensesApi,
  expenseBudgets: expenseBudgetsApi,
  allowanceHolders: allowanceHoldersApi,
  allowanceRecords: allowanceRecordsApi,
  schedule: scheduleApi,
  employees: employeesApi,
  shifts: shiftsApi,
  scheduleHolidays: scheduleHolidaysApi,
  scheduleNotes: scheduleNotesApi,
  holidays: holidaysApi,
  holidayCategories: holidayCategoriesApi,
  training: trainingApi,
  parkingSpots: parkingSpotsApi,
  parkingBinding: parkingBindingApi,
  parkingStatuses: parkingStatusesApi,
  statusOptions: statusOptionsApi,
  houseStatuses: houseStatusesApi,
  floors: floorsApi,
  facilities: facilitiesApi,
  facilityBookings: facilityBookingsApi,
  homeTabs: homeTabsApi,
  homeRecords: homeRecordsApi,
  calendarEvents: calendarEventsApi,
  backupHistory: backupHistoryApi,
  // Sprint 5
  accounting: accountingApi,
  accountingReports: accountingReportsApi,
} as const;