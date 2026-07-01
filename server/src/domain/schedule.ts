/**
 * Domain — Schedule（班表）
 *
 * AI 友善說明：
 * - 純函式，無副作用
 * - 處理班表時間衝突、shift 配對、日期有效性
 *
 * 為什麼抽這層？
 * - V4 UI 不希望同一個員工同一天被排兩個班（至少要警告）
 * - 「時間範圍合理性」是純計算（end > start），可獨立測試
 */

/** Schedule entry 領域物件 */
export interface ScheduleEntryLike {
  id?: string;
  date: string;            // YYYY-MM-DD
  shiftId: string;
  assigneeId?: string | null;
  notes?: string | null;
}

/** Shift 領域物件 */
export interface ShiftLike {
  id: string;
  name: string;
  color?: string;
  orderIndex?: number;
  notes?: string | null;
}

/** 衝突結果 */
export interface ConflictResult {
  hasConflict: boolean;
  conflicts: ScheduleEntryLike[];
}

/**
 * 檢查新排班是否與既有排班衝突
 *
 * 規則（同員工同日不應被排兩個不同班；同員工同日同班 = idempotent 允許）：
 * - 同 date + 同 assigneeId + 不同 shiftId → 衝突
 * - 同 date + 同 assigneeId + 同 shiftId → 視為更新（不衝突）
 * - 不同 assigneeId → 不衝突
 * - assigneeId 為 null（公共班）→ 不檢查（不限定誰）
 */
export function detectConflicts(
  candidate: ScheduleEntryLike,
  existing: ScheduleEntryLike[],
  excludeId?: string,
): ConflictResult {
  const sameDate = existing.filter((e) => e.date === candidate.date);
  const conflicting = sameDate.filter((e) => {
    if (excludeId && e.id === excludeId) return false;
    if (!candidate.assigneeId) return false;
    if (!e.assigneeId) return false;
    if (e.assigneeId !== candidate.assigneeId) return false;
    // 同一班別更新 → 允許
    if (e.shiftId === candidate.shiftId) return false;
    return true;
  });
  return {
    hasConflict: conflicting.length > 0,
    conflicts: conflicting,
  };
}

/**
 * 驗證時間範圍合理性（end > start）
 *
 * @example
 *   validateTimeRange('09:00', '18:00') → { valid: true }
 *   validateTimeRange('18:00', '09:00') → { valid: false, reason: '結束時間需大於開始時間' }
 */
export function validateTimeRange(start: string, end: string): {
  valid: boolean;
  reason?: string;
} {
  if (!start || !end) return { valid: false, reason: '需要 start 和 end' };
  // 接受 "HH:MM" 或 "HH:MM:SS"
  const tToMinutes = (t: string): number | null => {
    const parts = t.split(':');
    if (parts.length < 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return h * 60 + m;
  };
  const s = tToMinutes(start);
  const e = tToMinutes(end);
  if (s == null) return { valid: false, reason: `開始時間格式錯誤: ${start}` };
  if (e == null) return { valid: false, reason: `結束時間格式錯誤: ${end}` };
  if (e <= s) return { valid: false, reason: '結束時間需大於開始時間' };
  return { valid: true };
}

/**
 * 驗證日期字串（YYYY-MM-DD）
 */
export function isValidScheduleDate(d: string): boolean {
  if (!d) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const date = new Date(d + 'T00:00:00Z');
  if (Number.isNaN(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === d;
}

/**
 * 排序班別（依 orderIndex 升冪，無值則排最後）
 */
export function sortShifts<T extends ShiftLike>(shifts: T[]): T[] {
  return [...shifts].sort((a, b) => {
    const ai = a.orderIndex ?? Number.MAX_SAFE_INTEGER;
    const bi = b.orderIndex ?? Number.MAX_SAFE_INTEGER;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });
}

/**
 * 計算兩個 schedule entries 是否指向同一人同日
 */
export function sameSlot(
  a: ScheduleEntryLike,
  b: ScheduleEntryLike,
): boolean {
  if (a.date !== b.date) return false;
  if (!a.assigneeId || !b.assigneeId) return false;
  return a.assigneeId === b.assigneeId;
}
