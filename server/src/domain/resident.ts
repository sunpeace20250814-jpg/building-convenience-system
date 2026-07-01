/**
 * Domain — Resident（住戶）
 *
 * AI 友善說明：
 * - 純函式，無副作用
 * - 處理住戶狀態判斷、空屋判定、顯示名稱
 * - 不依賴 database，不寫 SQL
 *
 * 為什麼抽這層？
 * - 「空屋 / 出租 / 正常」判定在多處出現（list 顯示 / 報表 / 排序）
 * - 統一定義後，未來 V5 改規則只改一處
 */

/** Resident 領域物件（精簡版） */
export interface ResidentLike {
  id?: string;
  name: string;
  ownerName?: string | null;
  renterName?: string | null;
  phone?: string | null;
  status?: string | null;
  statusId?: string | null;
  moveInDate?: string | null;
  moveOutDate?: string | null;
  memberCount?: number | null;
}

/** 住戶狀態分類（V4 對齊 client DEFAULT_STATUSES） */
export type ResidentStatusCategory =
  | 'vacant'   // 空屋
  | 'rental'   // 出租中
  | 'sold'     // 已出售
  | 'normal'   // 正常
  | 'unknown'; // 無法歸類

/**
 * 由 status 字串判斷類別
 *
 * 規則（對齊 client DEFAULT_STATUSES 的 id）：
 * - "vacant" / "空屋" / "空置" → vacant
 * - "rental" / "出租中" / "出租" → rental
 * - "sold" / "已出售" → sold
 * - "normal" / "正常" / "active" → normal
 * - 其他 / null → unknown
 */
export function classifyStatus(status: string | null | undefined): ResidentStatusCategory {
  if (!status) return 'unknown';
  const s = String(status).trim().toLowerCase();
  if (!s) return 'unknown';
  if (s === 'vacant' || s.includes('空屋') || s.includes('空置')) return 'vacant';
  if (s === 'rental' || s.includes('出租')) return 'rental';
  if (s === 'sold' || s.includes('已出售') || s.includes('出售')) return 'sold';
  if (s === 'normal' || s === 'active' || s.includes('正常')) return 'normal';
  return 'unknown';
}

/**
 * 是否為空屋（含分類判斷 + 退租日判斷）
 *
 * 規則：
 * - 狀態 = vacant（明顯空屋）
 * - 或 moveOutDate < 今天（已退租 → 空屋）
 */
export function isVacant(resident: ResidentLike, now: Date = new Date()): boolean {
  if (classifyStatus(resident.status) === 'vacant') return true;
  if (resident.moveOutDate) {
    const moveOut = new Date(resident.moveOutDate);
    if (!Number.isNaN(moveOut.getTime()) && moveOut.getTime() < now.getTime()) {
      return true;
    }
  }
  return false;
}

/**
 * 取得住戶顯示名稱（顯示在 UI 上的代表姓名）
 *
 * 規則：
 * - 有 ownerName → 用 ownerName（區權人）
 * - 有 renterName → 用 renterName（承租人）
 * - fallback → name
 */
export function displayName(resident: ResidentLike): string {
  return (
    resident.ownerName?.trim() ||
    resident.renterName?.trim() ||
    resident.name?.trim() ||
    ''
  );
}

/**
 * 取得完整住戶描述（含承租人 if any）
 *
 * @example
 *   fullDescription({ ownerName: '王小明', renterName: '李大華', ... })
 *   // → "王小明 (租客: 李大華)"
 */
export function fullDescription(resident: ResidentLike): string {
  const owner = resident.ownerName?.trim();
  const renter = resident.renterName?.trim();
  if (owner && renter) return `${owner} (租客: ${renter})`;
  if (owner) return owner;
  if (renter) return renter;
  return resident.name?.trim() || '';
}

/**
 * 計算實際成員數（含 fallback）
 *
 * 規則：優先用 memberCount 欄位（管理者手動填）；若無則傳 0
 */
export function effectiveMemberCount(resident: ResidentLike, fallback: number = 0): number {
  if (resident.memberCount != null && Number.isFinite(resident.memberCount)) {
    return Math.max(0, Number(resident.memberCount));
  }
  return Math.max(0, fallback);
}

/**
 * 住戶關鍵字搜尋比對（用於 /api/residents/search?q=）
 *
 * 規則：name / ownerName / renterName / phone / floor 任一包含 q（case-insensitive）
 */
export function matchesQuery(resident: ResidentLike, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  const fields = [
    resident.name,
    resident.ownerName,
    resident.renterName,
    resident.phone,
  ];
  return fields.some((f) => f && String(f).toLowerCase().includes(needle));
}

/**
 * 排序住戶（依 floorIndex 升冪，再依 unitNumber）
 * 用於 /api/residents list
 */
export function compareResidents(a: ResidentLike & { floorIndex?: number | null; unitNumber?: string | null }, b: ResidentLike & { floorIndex?: number | null; unitNumber?: string | null }): number {
  const ai = a.floorIndex ?? 0;
  const bi = b.floorIndex ?? 0;
  if (ai !== bi) return ai - bi;
  return String(a.unitNumber ?? '').localeCompare(String(b.unitNumber ?? ''));
}
