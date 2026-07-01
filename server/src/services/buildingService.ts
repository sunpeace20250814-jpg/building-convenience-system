/**
 * Service — Building（棟別 / 樓層 / 自動生成住戶）
 *
 * AI 友善說明：
 * - 業務邏輯層：呼叫 domain 純函式 + repositories
 * - 不依賴 Fastify（不 import FastifyInstance / Reply）
 * - 直接 throw Error 或 { statusCode, message }，由 route 處理
 *
 * 職責：
 * - 棟別 CRUD（純代理，repo 已提供）
 * - 樓層自動生成（generateFloors）：從 building.normalFloorCount / rooftopFloorCount / basementFloorCount 算出所有樓層
 * - 住戶自動生成（generateResidents）：為每個樓層的每個單位建立「空屋」placeholder
 *
 * 為什麼是 service 而非 route？
 * - 計算邏輯可單元測試（不需要 mock HTTP）
 * - 同邏輯可在 CLI / Phase 7 排程 / 未來 import 工具中重複使用
 */

import { repositories } from '../db/repository.js';
import { notFound } from '../db/repository.js';
import {
  generateFloorLabels,
  generateEmptyResidentsForBuilding,
  parseFloorLabel,
  sortFloors,
  totalFloorCount,
  type BuildingLike,
  type FloorLike,
} from '../domain/building.js';

// ============================================================
// Buildings（棟別）
// ============================================================

export interface BuildingInput {
  name: string;
  normalFloorCount?: number;
  rooftopFloorCount?: number;
  basementFloorCount?: number;
  unitsPerFloor?: number;
  unitArea?: number;
  unitNamePattern?: string;
  notes?: string;
}

export function listBuildings() {
  return repositories.buildings.findBy('1=1', [], 'name');
}

export function getBuilding(id: string) {
  const r = repositories.buildings.getById(id);
  if (!r) throw notFound('找不到建築物');
  return r;
}

export function createBuilding(input: BuildingInput) {
  return repositories.buildings.create({
    name: input.name,
    normalFloorCount: input.normalFloorCount ?? 0,
    rooftopFloorCount: input.rooftopFloorCount ?? 0,
    basementFloorCount: input.basementFloorCount ?? 0,
    unitsPerFloor: input.unitsPerFloor ?? 4,
    unitArea: input.unitArea ?? 30,
    unitNamePattern: input.unitNamePattern ?? '{building}-{floor}F-{unit}',
    notes: input.notes ?? null,
  });
}

export function updateBuilding(id: string, input: Partial<BuildingInput>) {
  const updated = repositories.buildings.update(id, input as Record<string, unknown>);
  if (!updated) throw notFound('找不到建築物');
  return updated;
}

export function deleteBuilding(id: string) {
  const building = repositories.buildings.getById(id);
  if (!building) throw notFound('找不到建築物');

  // 手動 cascade：DB schema 沒建 FK CASCADE 在 residents/parking_spots 上
  // 1. 先刪 residents（會 cascade 到 sub-resources：members/keycards/emergency_contacts/parking/decoration）
  const residents = repositories.residents.findBy('building_id = ?', [id]);
  for (const r of residents as Array<Record<string, unknown>>) {
    repositories.residents.delete(String(r.id));
  }
  // 2. 刪 parking_spots（building_id 沒 FK 但孤兒也沒用）
  const spots = repositories.parking_spots.findBy('building_id = ?', [id]);
  for (const s of spots as Array<Record<string, unknown>>) {
    repositories.parking_spots.delete(String(s.id));
  }
  // 3. 刪建築本身（floors/facilities/parking_spots-rest 有 FK CASCADE 自動清）
  repositories.buildings.delete(id);
  return { success: true };
}

// ============================================================
// Floors（樓層）
// ============================================================

export function listFloors() {
  return repositories.floors.getAll('building_id, floor_index');
}

export function listFloorsByBuilding(buildingId: string) {
  return repositories.floors.findBy(
    'building_id = ?',
    [buildingId],
    'floor_index',
  );
}

export function getFloor(id: string) {
  const r = repositories.floors.getById(id);
  if (!r) throw notFound('找不到樓層');
  return r;
}

export function createFloor(input: {
  buildingId: string;
  floorLabel: string;
  floorIndex?: number;
  floorArea?: number;
  unitArea?: number;
  unitCount?: number;
  isBasement?: boolean;
  isRooftop?: boolean;
  notes?: string;
}) {
  // 若未傳 floorIndex，由 domain 自動解析
  let floorIndex = input.floorIndex;
  let isBasement = input.isBasement;
  let isRooftop = input.isRooftop;
  if (floorIndex == null) {
    const parsed = parseFloorLabel(input.floorLabel);
    floorIndex = parsed.floorIndex;
    if (isBasement == null) isBasement = parsed.isBasement;
    if (isRooftop == null) isRooftop = parsed.isRooftop;
  }
  return repositories.floors.create({
    buildingId: input.buildingId,
    floorLabel: input.floorLabel,
    floorIndex,
    floorArea: input.floorArea ?? null,
    unitArea: input.unitArea ?? null,
    unitCount: input.unitCount ?? null,
    isBasement: isBasement ? 1 : 0,
    isRooftop: isRooftop ? 1 : 0,
    notes: input.notes ?? null,
  });
}

export function updateFloor(id: string, input: Record<string, unknown>) {
  const updated = repositories.floors.update(id, input);
  if (!updated) throw notFound('找不到樓層');
  return updated;
}

export function deleteFloor(id: string) {
  const ok = repositories.floors.delete(id);
  if (!ok) throw notFound('找不到樓層');
  return { success: true };
}

/**
 * 自動生成樓層（從 building 的 floorCount 設定）
 *
 * 邏輯：
 * - 用 domain.generateFloorLabels 算出所有樓層
 * - 跳過已存在的 floorLabel（同 building 內 unique by label）
 * - 回傳「新增的樓層」陣列
 *
 * 這個 endpoint 對應 `/api/settings/buildings/:id/generate-floors`
 */
export function generateFloorsForBuilding(buildingId: string) {
  const building = repositories.buildings.getById(buildingId);
  if (!building) throw notFound('找不到建築物');
  const b = building as unknown as Record<string, unknown>;
  const buildingLike: BuildingLike = {
    id: String(b.id),
    name: String(b.name),
    normalFloorCount: Number(b.normalFloorCount) || 0,
    rooftopFloorCount: Number(b.rooftopFloorCount) || 0,
    basementFloorCount: Number(b.basementFloorCount) || 0,
  };

  const labels = generateFloorLabels(buildingLike);
  const existing = repositories.floors.findBy(
    'building_id = ?',
    [buildingId],
    'floor_index',
  );
  const existingSet = new Set(existing.map((f) => f.floorLabel));

  const created: unknown[] = [];
  for (const f of labels) {
    if (existingSet.has(f.floorLabel)) continue; // skip duplicate
    created.push(
      repositories.floors.create({
        buildingId,
        floorLabel: f.floorLabel,
        floorIndex: f.floorIndex,
        isBasement: f.isBasement ? 1 : 0,
        isRooftop: f.isRooftop ? 1 : 0,
      }),
    );
  }
  return {
    buildingId,
    totalPlanned: labels.length,
    skipped: labels.length - created.length,
    createdCount: created.length,
    created,
  };
}

/**
 * 自動生成住戶（為建築物每個樓層每單位建立「空屋」placeholder）
 *
 * 邏輯：
 * - 用 domain.generateEmptyResidentsForBuilding 算出所有住戶預設
 * - 跳過已存在的（name 衝突）
 * - 預設 status = 空屋（vacant）
 *
 * 這個 endpoint 對應 `/api/settings/buildings/:id/generate-residents`
 */
export interface GenerateResidentsOptions {
  unitsPerFloor: number;
  vacantLabel?: string;
  overwriteExisting?: boolean;
}

export function generateResidentsForBuilding(
  buildingId: string,
  options: GenerateResidentsOptions,
) {
  if (!options.unitsPerFloor || options.unitsPerFloor < 1) {
    const err: { statusCode: number; message: string } = {
      statusCode: 400,
      message: 'unitsPerFloor 必須 >= 1',
    };
    throw err;
  }
  const building = repositories.buildings.getById(buildingId);
  if (!building) throw notFound('找不到建築物');
  const b2 = building as unknown as Record<string, unknown>;

  const buildingLike: BuildingLike = {
    id: String(b2.id),
    name: String(b2.name),
    normalFloorCount: Number(b2.normalFloorCount) || 0,
    rooftopFloorCount: Number(b2.rooftopFloorCount) || 0,
    basementFloorCount: Number(b2.basementFloorCount) || 0,
  };

  const planned = generateEmptyResidentsForBuilding(buildingLike, {
    unitsPerFloor: options.unitsPerFloor,
    vacantLabel: options.vacantLabel ?? '空屋',
  });

  // 先建立 / 查找 floors（給 resident.floorId 用）
  const floorResult = generateFloorsForBuilding(buildingId);
  const allFloors = repositories.floors.findBy(
    'building_id = ?',
    [buildingId],
    'floor_index',
  );
  const floorByLabel = new Map<string, { id: string }>();
  for (const f of allFloors) {
    const fr = f as unknown as Record<string, unknown>;
    floorByLabel.set(String(fr.floorLabel), { id: String(fr.id) });
  }

  // 既有 residents（用來 skip duplicate）
  const existingResidents = repositories.residents.findBy(
    'building_id = ?',
    [buildingId],
    'floor_index, unit_number',
  );
  const existingKey = new Set(
    existingResidents.map((r) => {
      const rr = r as unknown as Record<string, unknown>;
      return `${String(rr.floor)}::${String(rr.unitNumber ?? '')}`;
    }),
  );

  const created: unknown[] = [];
  let skipped = 0;
  for (const p of planned) {
    const key = `${p.floor}::${p.unitNumber}`;
    if (!options.overwriteExisting && existingKey.has(key)) {
      skipped++;
      continue;
    }
    const floorRef = floorByLabel.get(p.floor);
    created.push(
      repositories.residents.create({
        buildingId: p.buildingId,
        floorId: floorRef?.id ?? null,
        floor: p.floor,
        floorIndex: p.floorIndex,
        unitNumber: p.unitNumber,
        unitType: p.unitType,
        name: p.name,
        status: p.status,
      }),
    );
  }

  return {
    buildingId,
    unitsPerFloor: options.unitsPerFloor,
    totalPlanned: planned.length,
    createdCount: created.length,
    skipped,
    floorsGenerated: floorResult.createdCount,
    created,
  };
}

// ============================================================
// Building 統計
// ============================================================

export interface BuildingSummary {
  building: ReturnType<typeof repositories.buildings.getById>;
  totalFloors: number;
  floorCount: { basement: number; normal: number; rooftop: number };
  residentCount: number;
  vacantCount: number;
}

export function summarizeBuilding(buildingId: string): BuildingSummary {
  const building = repositories.buildings.getById(buildingId);
  if (!building) throw notFound('找不到建築物');
  const floors = repositories.floors.findBy(
    'building_id = ?',
    [buildingId],
    'floor_index',
  );
  const residents = repositories.residents.findBy(
    'building_id = ?',
    [buildingId],
    'floor_index',
  );
  const total = totalFloorCount(building as unknown as BuildingLike);
  const sortedFloors: FloorLike[] = sortFloors(
    floors.map((f) => {
      const fr = f as unknown as Record<string, unknown>;
      return {
        id: String(fr.id),
        buildingId: fr.buildingId == null ? undefined : String(fr.buildingId),
        floorLabel: String(fr.floorLabel),
        floorIndex: Number(fr.floorIndex ?? 0),
        isBasement: !!fr.isBasement,
        isRooftop: !!fr.isRooftop,
      };
    }),
  );
  const basement = sortedFloors.filter((f) => f.isBasement).length;
  const rooftop = sortedFloors.filter((f) => f.isRooftop).length;
  const normal = sortedFloors.length - basement - rooftop;
  const vacant = residents.filter((r) => {
    const s = String(r.status ?? '').toLowerCase();
    return s === 'vacant' || s.includes('空屋') || s.includes('空置');
  }).length;
  return {
    building,
    totalFloors: total,
    floorCount: { basement, normal, rooftop },
    residentCount: residents.length,
    vacantCount: vacant,
  };
}
