/**
 * i18n 初始化
 *
 * 設計原則：
 * 1. 預設語言偵測順序：localStorage 'v4-lang' → navigator.language → zh-TW
 * 2. fallback 鏈：當前語言 → zh-TW（避免顯示空白）
 * 3. 變更即時生效：react-i18next 透過 useTranslation hook 自動 re-render
 * 4. localStorage key: 'v4-lang'，存 'zh-TW' | 'en'
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import zhTW from './locales/zh-TW.json';
import en from './locales/en.json';

export const SUPPORTED_LANGUAGES = ['zh-TW', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANG_STORAGE_KEY = 'v4-lang';

/**
 * 偵測預設語言
 * 優先順序：localStorage → navigator.language → zh-TW
 */
function detectInitialLanguage(): SupportedLanguage {
  // 1. localStorage
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved && (SUPPORTED_LANGUAGES as readonly string[]).includes(saved)) {
      return saved as SupportedLanguage;
    }
  } catch {
    // localStorage 可能在 SSR 或隱私模式失敗，忽略
  }

  // 2. navigator.language
  if (typeof navigator !== 'undefined' && navigator.language) {
    const lang = navigator.language.toLowerCase();
    // 繁體中文家族（zh-tw, zh-hk, zh-mo 等）→ zh-TW
    if (lang === 'zh-tw' || lang === 'zh-hant' || lang === 'zh-hk' || lang === 'zh-mo'
        || lang.startsWith('zh-tw') || lang.startsWith('zh-hk') || lang.startsWith('zh-mo')
        || lang.startsWith('zh-hant')) {
      return 'zh-TW';
    }
    // 簡體中文（zh-cn, zh-hans, zh 等）→ 也用繁中（避免顯示簡中）
    if (lang === 'zh' || lang === 'zh-cn' || lang === 'zh-hans' || lang.startsWith('zh-')) {
      return 'zh-TW';
    }
    // 英文（含 en, en-us, en-gb 等）→ en
    if (lang === 'en' || lang.startsWith('en-')) {
      return 'en';
    }
  }

  // 3. fallback
  return 'zh-TW';
}

const initialLanguage = detectInitialLanguage();

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'zh-TW': { translation: zhTW },
      'en': { translation: en },
    },
    lng: initialLanguage,
    fallbackLng: 'zh-TW',
    interpolation: {
      escapeValue: false, // React 已經處理 XSS
    },
    detection: {
      // 自訂偵測順序，避免瀏覽器語言覆蓋 localStorage
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANG_STORAGE_KEY,
      caches: ['localStorage'],
      lookupFromPathIndex: 0,
      lookupFromSubdomainIndex: 0,
    },
    returnEmptyString: false,
    saveMissing: false, // 不自動寫入新 key，避免污染
  });

/**
 * 切換語言（會自動寫入 localStorage）
 */
export function changeLanguage(lng: SupportedLanguage): void {
  if (!(SUPPORTED_LANGUAGES as readonly string[]).includes(lng)) {
    console.warn(`[i18n] Unsupported language: ${lng}`);
    return;
  }
  i18n.changeLanguage(lng);
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lng);
  } catch {
    // ignore
  }
}

/**
 * 取得目前語言
 */
export function getCurrentLanguage(): SupportedLanguage {
  const cur = i18n.language;
  if ((SUPPORTED_LANGUAGES as readonly string[]).includes(cur)) {
    return cur as SupportedLanguage;
  }
  return 'zh-TW';
}

export default i18n;
