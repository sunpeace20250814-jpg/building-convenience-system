/**
 * Service — Schedule（班表）
 *
 * AI 友善說明：
 * - 業務邏輯層：呼叫 domain + repositories
 * - schedule_entries（班表記錄）+ employees（員工）+ shifts（班別）
 *
 * 職責：
 * - 員工 / 班別 / 班表記錄的 CRUD
 * - 班表衝突檢查（addScheduleEntry / updateScheduleEntry）
 * - 排程時間範圍合理性檢查
 */

import { repositories } from '../db/repository.js';
import { notFound, snakeRowToCamel } from '../db/repository.js';
import { db } from '../db/index.js';
import {
  detectConflicts,
  isValidScheduleDate,
  sortShifts,
  validateTimeRange,
  type ScheduleEntryLike,
  type ShiftLike,
} from '../domain/schedule.js';

// ============================================================
// Employees（員工）
// ============================================================

export function listEmployees(includeInactive: boolean = false) {
  return includeInactive
    ? repositories.employees.findBy('1=1', [], 'name')
    : repositories.employees.findBy('is_active = 1', [], 'name');
}

export function getEmployee(id: string) {
  const r = repositories.employees.getById(id);
  if (!r) throw notFound('找不到員工');
  return r;
}

export function createEmployee(input: {
  name: string;
  phone?: string;
  lineId?: string;
  isActive?: boolean;
  notes?: string;
}) {
  return repositories.employees.create({
    ...input,
    isActive: input.isActive ?? true,
  });
}

export function updateEmployee(id: string, input: Record<string, unknown>) {
  const updated = repositories.employees.update(id, input);
  if (!updated) throw notFound('找不到員工');
  return updated;
}

export function deleteEmployee(id: string) {
  // 先清掉該員工的所有排班（schedule_entries 沒有 FK CASCADE，要手動刪）
  repositories.schedule_entries
    .findBy('assignee_id = ?', [id])
    .forEach((entry) => {
      const e = entry as unknown as { id: string };
      repositories.schedule_entries.delete(String(e.id));
    });
  const ok = repositories.employees.delete(id);
  if (!ok) throw notFound('找不到員工');
  return { success: true };
}

// ============================================================
// Shifts（班別）
// ============================================================

export function listShifts() {
  const rows = repositories.shifts.getAll('order_index');
  return sortShifts(rows as unknown as ShiftLike[]);
}

export function getShift(id: string) {
  const r = repositories.shifts.getById(id);
  if (!r) throw notFound('找不到班別');
  return r;
}

export function createShift(input: {
  name: string;
  color: string;
  orderIndex?: number;
  notes?: string;
}) {
  return repositories.shifts.create({
    ...input,
    orderIndex: input.orderIndex ?? 0,
  });
}

export function updateShift(id: string, input: Record<string, unknown>) {
  const updated = repositories.shifts.update(id, input);
  if (!updated) throw notFound('找不到班別');
  return updated;
}

export function deleteShift(id: string) {
  const ok = repositories.shifts.delete(id);
  if (!ok) throw notFound('找不到班別');
  return { success: true };
}

// ============================================================
// Schedule Entries（班表記錄）
// ============================================================

export interface ScheduleEntryInput {
  date: string;
  shiftId: string;
  assigneeId?: string | null;
  notes?: string;
}

export interface ScheduleConflictError {
  statusCode: 409;
  message: string;
  conflicts: ScheduleEntryLike[];
}

/**
 * 取得班表（含 join shift_label / assignee_name）
 */
export function listScheduleEntries() {
  return db
    .prepare(
      `SELECT se.*, ss.name as shift_label, ss.color as shift_color, e.name as assignee_name
       FROM schedule_entries se
       LEFT JOIN shifts ss ON se.shift_id = ss.id
       LEFT JOIN employees e ON se.assignee_id = e.id
       ORDER BY se.date DESC, se.created_at DESC`,
    )
    .all()
    .map(snakeRowToCamel);
}

export function listScheduleEntriesByDate(date: string) {
  return db
    .prepare(
      `SELECT se.*, ss.name as shift_label, ss.color as shift_color, e.name as assignee_name
       FROM schedule_entries se
       LEFT JOIN shifts ss ON se.shift_id = ss.id
       LEFT JOIN employees e ON se.assignee_id = e.id
       WHERE se.date = ?
       ORDER BY se.created_at`,
    )
    .all(date)
    .map(snakeRowToCamel);
}

export function listScheduleEntriesByRange(start: string, end: string) {
  return db
    .prepare(
      `SELECT se.*, ss.name as shift_label, ss.color as shift_color, e.name as assignee_name
       FROM schedule_entries se
       LEFT JOIN shifts ss ON se.shift_id = ss.id
       LEFT JOIN employees e ON se.assignee_id = e.id
       WHERE se.date BETWEEN ? AND ?
       ORDER BY se.date, se.created_at`,
    )
    .all(start, end)
    .map(snakeRowToCamel);
}

export function getScheduleEntry(id: string) {
  const r = repositories.schedule_entries.getById(id);
  if (!r) throw notFound('找不到班表記錄');
  return r;
}

/**
 * 新增班表記錄（含衝突檢查）
 */
export function addScheduleEntry(input: ScheduleEntryInput) {
  if (!isValidScheduleDate(input.date)) {
    const err: { statusCode: number; message: string } = {
      statusCode: 400,
      message: '日期格式錯誤，需為 YYYY-MM-DD',
    };
    throw err;
  }
  if (!input.shiftId) {
    const err: { statusCode: number; message: string } = {
      statusCode: 400,
      message: 'shiftId 必填',
    };
    throw err;
  }
  // FK check
  const shift = repositories.shifts.getById(input.shiftId);
  if (!shift) {
    const err: { statusCode: number; message: string } = {
      statusCode: 404,
      message: '找不到班別',
    };
    throw err;
  }
  if (input.assigneeId) {
    const emp = repositories.employees.getById(input.assigneeId);
    if (!emp) {
      const err: { statusCode: number; message: string } = {
        statusCode: 404,
        message: '找不到員工',
      };
      throw err;
    }
  }
  // 衝突檢查
  const existing = repositories.schedule_entries.findBy('date = ?', [input.date]);
  const candidate: ScheduleEntryLike = {
    date: input.date,
    shiftId: input.shiftId,
    assigneeId: input.assigneeId ?? null,
  };
  const result = detectConflicts(candidate, existing as unknown as ScheduleEntryLike[]);
  if (result.hasConflict) {
    const err: ScheduleConflictError = {
      statusCode: 409,
      message: `員工 ${input.assigneeId} 在 ${input.date} 已有其他班別`,
      conflicts: result.conflicts,
    };
    throw err;
  }
  return repositories.schedule_entries.create({
    date: input.date,
    shiftId: input.shiftId,
    assigneeId: input.assigneeId ?? null,
    notes: input.notes ?? null,
  });
}

/**
 * 更新班表記錄（含衝突檢查）
 */
export function updateScheduleEntry(id: string, input: Partial<ScheduleEntryInput>) {
  const existing = repositories.schedule_entries.getById(id);
  if (!existing) throw notFound('找不到班表記錄');
  const ex = existing as unknown as Record<string, unknown>;

  const merged: ScheduleEntryLike = {
    id: String(ex.id),
    date: String(input.date ?? ex.date ?? ''),
    shiftId: String(input.shiftId ?? ex.shiftId ?? ''),
    assigneeId: (input.assigneeId ?? ex.assigneeId) == null ? null : String(input.assigneeId ?? ex.assigneeId),
    notes: (input.notes ?? ex.notes) == null ? null : String(input.notes ?? ex.notes),
  };
  if (!isValidScheduleDate(merged.date)) {
    const err: { statusCode: number; message: string } = {
      statusCode: 400,
      message: '日期格式錯誤',
    };
    throw err;
  }
  // 衝突檢查（排除自己）
  const siblings = repositories.schedule_entries.findBy(
    'date = ? AND id != ?',
    [merged.date, id],
  );
  const result = detectConflicts(merged, siblings as unknown as ScheduleEntryLike[], id);
  if (result.hasConflict) {
    const err: ScheduleConflictError = {
      statusCode: 409,
      message: `員工 ${merged.assigneeId} 在 ${merged.date} 已有其他班別`,
      conflicts: result.conflicts,
    };
    throw err;
  }
  const updated = repositories.schedule_entries.update(id, input as Record<string, unknown>);
  return updated;
}

export function deleteScheduleEntry(id: string) {
  const ok = repositories.schedule_entries.delete(id);
  if (!ok) throw notFound('找不到班表記錄');
  return { success: true };
}

// ============================================================
// 時間範圍驗證 helper（給其他 service / future route 使用）
// ============================================================

export function checkTimeRange(start: string, end: string) {
  const result = validateTimeRange(start, end);
  if (!result.valid) {
    const err: { statusCode: number; message: string } = {
      statusCode: 400,
      message: result.reason ?? '時間範圍錯誤',
    };
    throw err;
  }
  return { valid: true };
}
