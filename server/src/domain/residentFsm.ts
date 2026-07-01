/**
 * Status FSM — 住戶狀態轉移規則（M-20 修復）
 *
 * 為什麼需要 FSM？
 * - 現況 status 是 free-form string，可寫入任意值（"hello", "123", ...）
 * - status_id 與 status 兩欄位無交叉驗證
 * - 用戶誤填導致資料不一致
 *
 * 規則：
 * - status 必須是合法狀態之一（從 status_options 取 type='resident'）
 * - 允許的值（向後相容 fallback）：normal / rental / vacant / sold / decoration
 * - 暫停 FSM 規則（轉移限制）以免阻擋既有業務流程，但保留「必須是合法值」的硬檢查
 *
 * 設計選擇：
 * - 不強制 status === statusOptions.label，因為舊資料可能兩者不一致
 * - 改為：status 必須 IN (default_statuses) 才接受
 */

export const ALLOWED_RESIDENT_STATUSES = new Set([
  'normal',         // 正常
  'rental',         // 出租中
  'vacant',         // 空屋
  'sold',           // 已售
  'decoration',     // 裝潢中
  'moved_out',      // 已遷出
]);

/** 判斷 resident status 是否合法 */
export function isValidResidentStatus(status: unknown): boolean {
  if (status === null || status === undefined) return true; // optional
  if (typeof status !== 'string') return false;
  return ALLOWED_RESIDENT_STATUSES.has(status);
}

/**
 * 規範化 resident status 寫入前檢查
 * @throws 400 if invalid
 */
export function assertValidResidentStatus(status: unknown): void {
  if (status === null || status === undefined) return;
  if (!isValidResidentStatus(status)) {
    throw {
      statusCode: 400,
      message: `無效的住戶狀態: "${String(status)}"。允許值: ${Array.from(ALLOWED_RESIDENT_STATUSES).join(', ')}`,
    };
  }
}