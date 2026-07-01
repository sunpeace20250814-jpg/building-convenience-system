/**
 * 啟動狀態偵測
 * 判斷 V4 是否首次啟動、是否需要顯示精靈
 *
 * V4 Phase 9 重寫：
 * - 移除 queryAll/execute（不再讀本地 SQLite app_settings）
 * - 純 localStorage 為 source of truth（少量偏好設定）
 * - 未來可考慮 server-side /api/app-settings/onboarding-status 取代（見 ERR-017 tech debt）
 *
 * 詳細錯誤規則：見 V4/ERRORS.md ERR-014
 */

const STORAGE_KEYS = {
  onboardingCompleted: 'v4-onboarding-completed',
  onboardingSkippedAt: 'v4-onboarding-skipped-at',
  cloudBindingPrompted: 'v4-cloud-binding-prompted',
  moduleTourShown: 'v4-module-tour-shown',
} as const;

export interface OnboardingStatus {
  isFirstRun: boolean;
  isCompleted: boolean;
  wasSkipped: boolean;
  skipCount: number;
}

/**
 * 檢查是否需要顯示首次啟動精靈
 *
 * Phase 9：純 localStorage 為 source of truth
 * - 簡單、零依賴
 * - 缺點：換瀏覽器 / 無痕模式會 reset（但 V4 也無本地資料，重設也無妨）
 */
export function getOnboardingStatus(): OnboardingStatus {
  const completed = localStorage.getItem(STORAGE_KEYS.onboardingCompleted);
  const skippedAt = localStorage.getItem(STORAGE_KEYS.onboardingSkippedAt);

  let skipCount = 0;
  if (skippedAt) {
    skipCount = Number.parseInt(skippedAt, 10) || 0;
  }

  return {
    isFirstRun: completed !== '1' && skipCount === 0,
    isCompleted: completed === '1',
    wasSkipped: completed !== '1' && skipCount > 0,
    skipCount,
  };
}

/**
 * 標記精靈已完成
 */
export function markOnboardingCompleted(): void {
  localStorage.setItem(STORAGE_KEYS.onboardingCompleted, '1');
  localStorage.setItem(STORAGE_KEYS.onboardingSkippedAt, '0');
}

/**
 * 標記精靈被跳過
 */
export function markOnboardingSkipped(): void {
  const currentStr = localStorage.getItem(STORAGE_KEYS.onboardingSkippedAt) || '0';
  const next = String((Number.parseInt(currentStr, 10) || 0) + 1);
  localStorage.setItem(STORAGE_KEYS.onboardingSkippedAt, next);
}

/**
 * 重設精靈狀態（讓使用者可以重新跑精靈）
 */
export function resetOnboardingStatus(): void {
  localStorage.removeItem(STORAGE_KEYS.onboardingCompleted);
  localStorage.removeItem(STORAGE_KEYS.onboardingSkippedAt);
}

/**
 * 檢查雲端綁定提示是否已顯示
 */
export function shouldShowCloudBindingPrompt(): boolean {
  return localStorage.getItem(STORAGE_KEYS.cloudBindingPrompted) !== '1';
}

/**
 * 標記雲端綁定提示已顯示
 */
export function markCloudBindingPrompted(): void {
  localStorage.setItem(STORAGE_KEYS.cloudBindingPrompted, '1');
}

/**
 * 檢查模組教學是否已顯示
 */
export function shouldShowModuleTour(moduleId: string): boolean {
  const key = `${STORAGE_KEYS.moduleTourShown}-${moduleId}`;
  return localStorage.getItem(key) !== '1';
}

/**
 * 標記模組教學已顯示
 */
export function markModuleTourShown(moduleId: string): void {
  const key = `${STORAGE_KEYS.moduleTourShown}-${moduleId}`;
  localStorage.setItem(key, '1');
}

export const ONBOARDING_STORAGE_KEYS = STORAGE_KEYS;
