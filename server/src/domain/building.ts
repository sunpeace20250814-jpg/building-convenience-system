/**
 * Domain — Building（棟別 / 樓層）
 *
 * AI 友善說明：
 * - 純函式，無副作用（不 import database / fs / 任何 IO）
 * - V4 棟別模型：name + normalFloorCount + rooftopFloorCount + basementFloorCount
 *   → 樓層 label 生成邏輯（B1, 1F, 2F, ..., RF）
 *
 * 為什麼抽這層？
 * - V4 UI 顯示與排序的邏輯（"B1" 要排 1F 之前）需要在多處複用
 * - 樓層計算是純計算，與 DB / HTTP 完全無關 → 適合 domain
 */

/** Building 領域物件（型別精簡版，避免直接綁定 schema 變動） */
export interface BuildingLike {
  id?: string;
  name: string;
  normalFloorCount: number;
  rooftopFloorCount?: number | null;
  basementFloorCount?: number | null;
}

/** Floor 領域物件 */
export interface FloorLike {
  id?: string;
  buildingId?: string;
  floorLabel: string;
  floorIndex: number;
  isBasement?: boolean;
  isRooftop?: boolean;
}

/** Resident 領域物件（精簡版，只用於「空屋預設」邏輯） */
export interface ResidentLike {
  id?: string;
  name: string;
  status?: string | null;
  statusId?: string | null;
  moveInDate?: string | null;
  moveOutDate?: string | null;
}

/**
 * 計算建築物總樓層數（地下 + 一般 + 頂樓）
 */
export function totalFloorCount(building: BuildingLike): number {
  const normal = Math.max(0, Number(building.normalFloorCount) || 0);
  const roof = Math.max(0, Number(building.rooftopFloorCount) || 0);
  const base = Math.max(0, Number(building.basementFloorCount) || 0);
  return normal + roof + base;
}

/**
 * 產生建築物的所有樓層 label
 *
 * @example
 *   generateFloorLabels({ name: 'A棟', normalFloorCount: 12, rooftopFloorCount: 1, basementFloorCount: 2 })
 *   // → [
 *   //   { floorLabel: 'B2', floorIndex: -2, isBasement: true, isRooftop: false },
 *   //   { floorLabel: 'B1', floorIndex: -1, isBasement: true, isRooftop: false },
 *   //   { floorLabel: '1F', floorIndex: 1, isBasement: false, isRooftop: false },
 *   //   ...
 *   //   { floorLabel: '12F', floorIndex: 12, isBasement: false, isRooftop: false },
 *   //   { floorLabel: 'RF', floorIndex: 99, isBasement: false, isRooftop: true },
 *   // ]
 */
export function generateFloorLabels(building: BuildingLike): Array<{
  floorLabel: string;
  floorIndex: number;
  isBasement: boolean;
  isRooftop: boolean;
}> {
  const normal = Math.max(0, Number(building.normalFloorCount) || 0);
  const roof = Math.max(0, Number(building.rooftopFloorCount) || 0);
  const base = Math.max(0, Number(building.basementFloorCount) || 0);

  const floors: Array<{
    floorLabel: string;
    floorIndex: number;
    isBasement: boolean;
    isRooftop: boolean;
  }> = [];

  // 1. 地下樓（B? 由深到淺）
  for (let i = base; i >= 1; i--) {
    floors.push({
      floorLabel: `B${i}`,
      floorIndex: -i,
      isBasement: true,
      isRooftop: false,
    });
  }

  // 2. 一般樓層（1F ~ NF）
  for (let i = 1; i <= normal; i++) {
    floors.push({
      floorLabel: `${i}F`,
      floorIndex: i,
      isBasement: false,
      isRooftop: false,
    });
  }

  // 3. 屋頂突出層（RF）
  for (let i = 1; i <= roof; i++) {
    floors.push({
      floorLabel: i === 1 ? 'RF' : `RF${i}`,
      floorIndex: 90 + i, // RF 在 1F 之上但與一般樓層分區（90 起跳避免撞到 20F+）
      isBasement: false,
      isRooftop: true,
    });
  }

  return floors;
}

/**
 * 樓層排序比較器：B2 → B1 → 1F → 2F → ... → RF
 */
export function compareFloors(a: FloorLike, b: FloorLike): number {
  return a.floorIndex - b.floorIndex;
}

/**
 * 將樓層陣列排序（依照 domain 規則：B? → 1F → 2F → ... → RF）
 */
export function sortFloors<T extends FloorLike>(floors: T[]): T[] {
  return [...floors].sort(compareFloors);
}

/**
 * 從 floorLabel 解析出 floorIndex（B2 → -2, B1 → -1, 1F → 1, RF → 99）
 * 用於解析既有資料（避免 user 在 UI 改了 label 後 floorIndex 跑掉）
 */
export function parseFloorLabel(label: string): {
  floorIndex: number;
  isBasement: boolean;
  isRooftop: boolean;
} {
  const trimmed = (label || '').trim();
  if (!trimmed) {
    return { floorIndex: 0, isBasement: false, isRooftop: false };
  }
  // RF → 99（屋頂）
  if (/^RF\d*$/.test(trimmed)) {
    const suffix = trimmed.slice(2);
    const n = suffix ? parseInt(suffix, 10) : 1;
    return { floorIndex: 90 + (Number.isFinite(n) ? n : 1), isBasement: false, isRooftop: true };
  }
  // B? → 負數
  const bMatch = /^B(\d+)$/.exec(trimmed);
  if (bMatch) {
    const n = parseInt(bMatch[1], 10);
    return { floorIndex: -n, isBasement: true, isRooftop: false };
  }
  // 數字F → 正數
  const fMatch = /^(\d+)(F)?$/.exec(trimmed);
  if (fMatch) {
    return { floorIndex: parseInt(fMatch[1], 10), isBasement: false, isRooftop: false };
  }
  // 解析失敗 → fallback
  return { floorIndex: 0, isBasement: false, isRooftop: false };
}

/**
 * 為建築物批次產生「住戶空屋」預設資料
 *
 * @example
 *   generateEmptyResidentsForBuilding(building, { floorCount: 2, unitsPerFloor: 4 })
 *   // → [
 *   //   { floorLabel: '1F', unitNumber: '1-A', name: '1F-1-A', status: '空屋' },
 *   //   ...
 *   // ]
 */
export function generateEmptyResidentsForBuilding(
  building: BuildingLike,
  options: { unitsPerFloor: number; vacantLabel?: string },
): Array<{
  buildingId: string;
  floorId?: string | null;
  floor: string;
  floorIndex: number;
  unitNumber: string;
  unitType: 'normal';
  name: string;
  status: string;
}> {
  if (!building.id) {
    throw new Error('building.id 必填');
  }
  const vacantLabel = options.vacantLabel ?? '空屋';
  const floors = generateFloorLabels(building).filter((f) => !f.isRooftop);
  const residents: Array<{
    buildingId: string;
    floorId?: string | null;
    floor: string;
    floorIndex: number;
    unitNumber: string;
    unitType: 'normal';
    name: string;
    status: string;
  }> = [];

  for (const f of floors) {
    for (let u = 1; u <= options.unitsPerFloor; u++) {
      const unitNumber = `${u}-A`;
      residents.push({
        buildingId: building.id,
        floorId: null,
        floor: f.floorLabel,
        floorIndex: f.floorIndex,
        unitNumber,
        unitType: 'normal',
        name: `${f.floorLabel}-${unitNumber}`,
        status: vacantLabel,
      });
    }
  }

  return residents;
}
