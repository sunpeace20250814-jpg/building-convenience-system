/**
 * Domain — Holiday（國定假日 + 排班假日）
 *
 * AI 友善說明：
 * - 純函式，無副作用
 * - holidays 與 schedule_holidays 是兩張表但功能相似（都是「特殊日」標記）
 *   → 需一個 merge function 合併兩者視角
 *
 * 為什麼抽這層？
 * - V4 UI（行事曆、班表）需要「某日期的假日資訊」同時含兩個來源
 * - 「補班日」邏輯（schedule_holidays.isWorkDay）要能在 service 層組合使用
 */

/** Holiday 領域物件（holidays 表） */
export interface HolidayLike {
  id: string;
  date: string;            // YYYY-MM-DD
  name: string;
  categoryId?: string | null;
  color?: string | null;
  notes?: string | null;
}

/** ScheduleHoliday 領域物件（schedule_holidays 表） */
export interface ScheduleHolidayLike {
  id: string;
  date: string;            // YYYY-MM-DD
  name: string;
  isWorkDay?: number | null;  // SQLite INTEGER 0/1
  notes?: string | null;
}

/** 合併後的日期特殊狀態 */
export type DateSpecialKind = 'holiday' | 'work_day' | 'normal';

/** 合併後的單日資訊（給前端行事曆用） */
export interface MergedDateInfo {
  date: string;
  kind: DateSpecialKind;
  name: string | null;
  color: string | null;
  source: 'holiday' | 'schedule_holiday' | 'merged' | null;
}

/**
 * 兩表合併：holidays 為主，若同日也有 schedule_holidays 則 isWorkDay = 1（補班）
 *
 * 規則：
 * - 同日兩表都有：kind 為 holiday（節日為主），但同時記下 isWorkDay = 補班
 * - 只有 holidays：kind = holiday
 * - 只有 schedule_holidays 且 isWorkDay=1：kind = work_day
 * - 只有 schedule_holidays 且 isWorkDay=0：kind = holiday
 */
export function mergeHolidaysForRange(
  start: string,
  end: string,
  holidays: HolidayLike[],
  scheduleHolidays: ScheduleHolidayLike[],
): MergedDateInfo[] {
  const inRange = (d: string) => d >= start && d <= end;
  const holMap = new Map<string, HolidayLike>();
  for (const h of holidays) if (inRange(h.date)) holMap.set(h.date, h);

  const schMap = new Map<string, ScheduleHolidayLike>();
  for (const s of scheduleHolidays) if (inRange(s.date)) schMap.set(s.date, s);

  const allDates = new Set<string>([...holMap.keys(), ...schMap.keys()]);
  const result: MergedDateInfo[] = [];

  for (const date of [...allDates].sort()) {
    const h = holMap.get(date);
    const s = schMap.get(date);
    if (h && s) {
      result.push({
        date,
        kind: 'holiday',
        name: h.name,
        color: h.color ?? null,
        source: 'merged',
      });
    } else if (h) {
      result.push({
        date,
        kind: 'holiday',
        name: h.name,
        color: h.color ?? null,
        source: 'holiday',
      });
    } else if (s) {
      const isWorkDay = Number(s.isWorkDay ?? 0) === 1;
      result.push({
        date,
        kind: isWorkDay ? 'work_day' : 'holiday',
        name: s.name,
        color: null,
        source: 'schedule_holiday',
      });
    }
  }

  return result;
}

/**
 * 判斷某日期是否為假日（holidays + schedule_holidays 中任一標記為 holiday）
 */
export function isHoliday(
  date: string,
  holidays: HolidayLike[],
  scheduleHolidays: ScheduleHolidayLike[],
): boolean {
  if (holidays.some((h) => h.date === date)) return true;
  const sh = scheduleHolidays.find((s) => s.date === date);
  if (sh && Number(sh.isWorkDay ?? 0) !== 1) return true;
  return false;
}

/**
 * 取得某日期的假日名稱（優先 holidays 表）
 */
export function holidayName(
  date: string,
  holidays: HolidayLike[],
  scheduleHolidays: ScheduleHolidayLike[],
): string | null {
  const h = holidays.find((x) => x.date === date);
  if (h) return h.name;
  const s = scheduleHolidays.find((x) => x.date === date);
  if (s) return s.name;
  return null;
}

/**
 * 依年份過濾（給 /api/holidays/year/:year 用）
 */
export function filterByYear<T extends { date: string }>(items: T[], year: number | string): T[] {
  const yStr = String(year);
  return items.filter((item) => item.date.startsWith(`${yStr}-`));
}

/**
 * 驗證日期字串格式（YYYY-MM-DD）
 */
export function isValidDateString(d: string): boolean {
  if (!d) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const date = new Date(d + 'T00:00:00Z');
  if (Number.isNaN(date.getTime())) return false;
  // 防呆：拒絕 "2026-02-31" 之類（Date 會 silent overflow）
  return date.toISOString().slice(0, 10) === d;
}
