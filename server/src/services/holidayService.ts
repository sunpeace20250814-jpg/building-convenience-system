/**
 * Service — Holiday（國定假日 + 排班假日）
 *
 * AI 友善說明：
 * - 業務邏輯層：呼叫 domain + repositories
 * - holidays 表（國定假日）+ schedule_holidays 表（排班假日 + 補班）
 *
 * 職責：
 * - 兩表的 CRUD（純代理 repo）
 * - 跨表合併查詢（給前端行事曆 / 班表用）
 * - 自動檢查 date UNIQUE 衝突
 */

import { repositories } from '../db/repository.js';
import { notFound } from '../db/repository.js';
import {
  filterByYear,
  holidayName,
  isHoliday,
  isValidDateString,
  mergeHolidaysForRange,
  type HolidayLike,
  type MergedDateInfo,
  type ScheduleHolidayLike,
} from '../domain/holiday.js';

// ============================================================
// Holidays（國定假日表）
// ============================================================

export interface HolidayInput {
  date: string;
  name: string;
  categoryId?: string;
  color?: string;
  notes?: string;
}

export function listHolidays() {
  return repositories.holidays.findBy('1=1', [], 'date');
}

export function listHolidaysByYear(year: number | string) {
  const rows = repositories.holidays.getAll('date');
  return filterByYear(rows as unknown as HolidayLike[], year);
}

export function getHolidayByDate(date: string) {
  if (!isValidDateString(date)) {
    const err: { statusCode: number; message: string } = {
      statusCode: 400,
      message: '日期格式錯誤，需為 YYYY-MM-DD',
    };
    throw err;
  }
  const r = repositories.holidays.findOneBy('date = ?', [date]);
  if (!r) throw notFound('找不到假日');
  return r;
}

export function getHoliday(id: string) {
  const r = repositories.holidays.getById(id);
  if (!r) throw notFound('找不到假日');
  return r;
}

export function createHoliday(input: HolidayInput) {
  if (!isValidDateString(input.date)) {
    const err: { statusCode: number; message: string } = {
      statusCode: 400,
      message: '日期格式錯誤，需為 YYYY-MM-DD',
    };
    throw err;
  }
  // UNIQUE(date) check
  const existing = repositories.holidays.findOneBy('date = ?', [input.date]);
  if (existing) {
    const err: { statusCode: number; message: string } = {
      statusCode: 409,
      message: `該日期已有假日：${String((existing as unknown as Record<string, unknown>).name ?? '')}`,
    };
    throw err;
  }
  return repositories.holidays.create(input as unknown as Record<string, unknown>);
}

export function updateHoliday(id: string, input: Partial<HolidayInput>) {
  const updated = repositories.holidays.update(id, input as Record<string, unknown>);
  if (!updated) throw notFound('找不到假日');
  return updated;
}

export function deleteHoliday(id: string) {
  const ok = repositories.holidays.delete(id);
  if (!ok) throw notFound('找不到假日');
  return { success: true };
}

// ============================================================
// Schedule Holidays（排班假日表）
// ============================================================

export interface ScheduleHolidayInput {
  date: string;
  name: string;
  isWorkDay?: boolean;
  notes?: string;
}

export function listScheduleHolidays() {
  return repositories.schedule_holidays.getAll('date');
}

export function listScheduleHolidaysByYear(year: number | string) {
  const rows = repositories.schedule_holidays.getAll('date');
  return filterByYear(rows as unknown as ScheduleHolidayLike[], year);
}

export function getScheduleHolidayByDate(date: string) {
  if (!isValidDateString(date)) {
    const err: { statusCode: number; message: string } = {
      statusCode: 400,
      message: '日期格式錯誤',
    };
    throw err;
  }
  const r = repositories.schedule_holidays.findOneBy('date = ?', [date]);
  if (!r) throw notFound('找不到排班假日');
  return r;
}

export function createScheduleHoliday(input: ScheduleHolidayInput) {
  if (!isValidDateString(input.date)) {
    const err: { statusCode: number; message: string } = {
      statusCode: 400,
      message: '日期格式錯誤',
    };
    throw err;
  }
  const existing = repositories.schedule_holidays.findOneBy('date = ?', [input.date]);
  if (existing) {
    const err: { statusCode: number; message: string } = {
      statusCode: 409,
      message: `該日期已有排班假日：${existing.name}`,
    };
    throw err;
  }
  return repositories.schedule_holidays.create({
    date: input.date,
    name: input.name,
    isWorkDay: input.isWorkDay ? 1 : 0,
    notes: input.notes ?? null,
  });
}

export function updateScheduleHoliday(id: string, input: Partial<ScheduleHolidayInput>) {
  const data: Record<string, unknown> = { ...input };
  if ('isWorkDay' in data && data.isWorkDay != null) {
    data.isWorkDay = data.isWorkDay ? 1 : 0;
  }
  const updated = repositories.schedule_holidays.update(id, data);
  if (!updated) throw notFound('找不到排班假日');
  return updated;
}

export function deleteScheduleHoliday(id: string) {
  const ok = repositories.schedule_holidays.delete(id);
  if (!ok) throw notFound('找不到排班假日');
  return { success: true };
}

// ============================================================
// 合併視角（給前端行事曆）
// ============================================================

/**
 * 取得某日期範圍的合併特殊日資訊
 *
 * 對應 `/api/holidays/range?start=&end=`（擴充端點，非破壞性）
 */
export function getMergedDateRange(start: string, end: string): MergedDateInfo[] {
  if (!isValidDateString(start) || !isValidDateString(end)) {
    const err: { statusCode: number; message: string } = {
      statusCode: 400,
      message: '日期格式錯誤',
    };
    throw err;
  }
  if (start > end) {
    const err: { statusCode: number; message: string } = {
      statusCode: 400,
      message: 'start 需 <= end',
    };
    throw err;
  }
  const holidays = repositories.holidays.findBy(
    'date BETWEEN ? AND ?',
    [start, end],
    'date',
  );
  const scheduleHolidays = repositories.schedule_holidays.findBy(
    'date BETWEEN ? AND ?',
    [start, end],
    'date',
  );
  return mergeHolidaysForRange(
    start,
    end,
    holidays as unknown as HolidayLike[],
    scheduleHolidays as unknown as ScheduleHolidayLike[],
  );
}

/**
 * 判斷某日期是否為假日（holidays + schedule_holidays）
 * 對應 `/api/holidays/check?date=`（擴充端點）
 */
export function checkIsHoliday(date: string): {
  date: string;
  isHoliday: boolean;
  name: string | null;
} {
  if (!isValidDateString(date)) {
    const err: { statusCode: number; message: string } = {
      statusCode: 400,
      message: '日期格式錯誤',
    };
    throw err;
  }
  const holidays = repositories.holidays.findBy('date = ?', [date]);
  const scheduleHolidays = repositories.schedule_holidays.findBy('date = ?', [date]);
  return {
    date,
    isHoliday: isHoliday(
      date,
      holidays as unknown as HolidayLike[],
      scheduleHolidays as unknown as ScheduleHolidayLike[],
    ),
    name: holidayName(
      date,
      holidays as unknown as HolidayLike[],
      scheduleHolidays as unknown as ScheduleHolidayLike[],
    ),
  };
}
