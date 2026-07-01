/**
 * Service — Resident（住戶）
 *
 * AI 友善說明：
 * - 業務邏輯層：呼叫 domain 純函式 + repositories
 * - 不依賴 Fastify
 * - 直接 throw Error / { statusCode, message }，由 route 處理
 *
 * 職責：
 * - 住戶 CRUD（純代理 repo）
 * - 關鍵字搜尋（呼叫 domain.matchesQuery）
 * - 自動標記空屋（用 domain.isVacant）
 * - 批量刪除（用 transaction）
 */

import { repositories } from '../db/repository.js';
import { notFound } from '../db/repository.js';
import {
  compareResidents,
  displayName,
  isVacant,
  matchesQuery,
  type ResidentLike,
} from '../domain/resident.js';
import { assertValidResidentStatus } from '../domain/residentFsm.js';

// ============================================================
// Residents（住戶主表）
// ============================================================

export interface ResidentInput {
  buildingId: string;
  floor: string;
  name: string;
  property?: string;
  floorId?: string;
  floorIndex?: number;
  unitNumber?: string;
  unitType?: 'normal' | 'rental' | 'whole_floor';
  ownerName?: string;
  renterName?: string;
  phone?: string;
  email?: string;
  parkingId?: string;
  memberCount?: number;
  deposit?: number;
  monthlyRent?: number;
  moveInDate?: string;
  moveOutDate?: string;
  statusId?: string;
  status?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  note?: string;
  notes?: string;
}

export function listResidents() {
  const rows = repositories.residents.findBy('1=1', [], 'floor_index, unit_number');
  return (rows as unknown as ResidentLike[]).sort(compareResidents as (a: ResidentLike, b: ResidentLike) => number);
}

export function listResidentsByBuilding(buildingId: string) {
  const rows = repositories.residents.findBy(
    'building_id = ?',
    [buildingId],
    'floor_index, unit_number',
  );
  return (rows as unknown as ResidentLike[]).sort(compareResidents as (a: ResidentLike, b: ResidentLike) => number);
}

export function searchResidents(q: string) {
  const rows = repositories.residents.findBy(
    '1=1',
    [],
    'floor_index, unit_number',
  );
  const filtered = (rows as unknown as ResidentLike[]).filter((r) => matchesQuery(r, q));
  return filtered.sort(compareResidents as (a: ResidentLike, b: ResidentLike) => number);
}

export function getResident(id: string) {
  const r = repositories.residents.getById(id);
  if (!r) throw notFound('找不到住戶');
  return r;
}

export function createResident(input: ResidentInput) {
  // M-20 修復：FSM 驗證
  assertValidResidentStatus(input.status);
  // M-21 修復：FK 存在性檢查（building/floor）
  if (!repositories.buildings.getById(input.buildingId)) {
    throw { statusCode: 400, message: `buildingId 不存在: ${input.buildingId}` };
  }
  if (input.floorId && !repositories.floors.getById(input.floorId)) {
    throw { statusCode: 400, message: `floorId 不存在: ${input.floorId}` };
  }
  return repositories.residents.create({
    ...input,
    unitType: input.unitType ?? 'normal',
    memberCount: input.memberCount ?? 0,
    status: input.status ?? '正常',
  });
}

export function updateResident(id: string, input: Partial<ResidentInput>) {
  // M-20 修復：FSM 驗證
  assertValidResidentStatus(input.status);
  const updated = repositories.residents.update(id, input as Record<string, unknown>);
  if (!updated) throw notFound('找不到住戶');
  return updated;
}

export function deleteResident(id: string) {
  const ok = repositories.residents.delete(id);
  if (!ok) throw notFound('找不到住戶');
  return { success: true };
}

// ============================================================
// Members / Keycards（住戶成員 + 鑰匙卡）
// ============================================================

export function listMembers(residentId: string) {
  return repositories.resident_members.findBy(
    'resident_id = ?',
    [residentId],
    'name',
  );
}

export function createMember(residentId: string, input: Record<string, unknown>) {
  return repositories.resident_members.create({
    ...input,
    residentId,
  });
}

export function updateMember(memberId: string, input: Record<string, unknown>) {
  const updated = repositories.resident_members.update(memberId, input);
  if (!updated) throw notFound('找不到成員');
  return updated;
}

export function deleteMember(memberId: string) {
  const ok = repositories.resident_members.delete(memberId);
  if (!ok) throw notFound('找不到成員');
  return { success: true };
}

export function listKeycards(residentId: string) {
  return repositories.resident_keycards.findBy(
    'resident_id = ?',
    [residentId],
    'created_at',
  );
}

export function createKeycard(residentId: string, cardNumber: string, note?: string) {
  return repositories.resident_keycards.create({
    residentId,
    cardNumber,
    note: note ?? null,
  });
}

export function updateKeycard(keycardId: string, input: Record<string, unknown>) {
  const updated = repositories.resident_keycards.update(keycardId, input);
  if (!updated) throw notFound('找不到鑰匙卡');
  return updated;
}

export function deleteKeycard(keycardId: string) {
  const ok = repositories.resident_keycards.delete(keycardId);
  if (!ok) throw notFound('找不到鑰匙卡');
  return { success: true };
}

// ============================================================
// 業務邏輯：標記空屋 / 統計
// ============================================================

/**
 * 掃描所有住戶，找出已退租或狀態為空的住戶，更新為「空屋」
 * 用於「批次整理」功能
 *
 * 回傳：被標記的數量
 */
export function refreshVacantFlags(now: Date = new Date()): {
  updated: number;
} {
  const rows = repositories.residents.getAll();
  let updated = 0;
  for (const r of rows) {
    const vacant = isVacant(r as unknown as ResidentLike, now);
    const currentStatus = String(r.status ?? '').toLowerCase();
    const isAlreadyVacant = currentStatus === 'vacant' || currentStatus.includes('空屋');
    if (vacant && !isAlreadyVacant) {
      repositories.residents.update(r.id, { status: '空屋' });
      updated++;
    } else if (!vacant && isAlreadyVacant) {
      // 自動反向恢復（謹慎：只在「日期驅動」的情境下做）
      repositories.residents.update(r.id, { status: '正常' });
    }
  }
  return { updated };
}

/**
 * 取得建築物的住戶摘要（含空屋 / 出租中 / 正常等分類）
 */
export interface ResidentSummary {
  buildingId: string;
  total: number;
  vacant: number;
  rental: number;
  sold: number;
  normal: number;
  unknown: number;
}

export function summarizeResidentsByBuilding(buildingId: string): ResidentSummary {
  const rows = repositories.residents.findBy(
    'building_id = ?',
    [buildingId],
  );
  const summary: ResidentSummary = {
    buildingId,
    total: rows.length,
    vacant: 0,
    rental: 0,
    sold: 0,
    normal: 0,
    unknown: 0,
  };
  for (const r of rows) {
    const s = String(r.status ?? '').toLowerCase();
    if (s === 'vacant' || s.includes('空屋') || s.includes('空置')) summary.vacant++;
    else if (s === 'rental' || s.includes('出租')) summary.rental++;
    else if (s === 'sold' || s.includes('已出售')) summary.sold++;
    else if (s === 'normal' || s.includes('正常')) summary.normal++;
    else summary.unknown++;
  }
  return summary;
}

/**
 * 取得顯示名稱（給前端快速取用）
 */
export function getDisplayName(residentId: string): string {
  const r = repositories.residents.getById(residentId);
  if (!r) return '';
  return displayName(r as unknown as ResidentLike);
}
