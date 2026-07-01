/**
 * 首次啟動精靈 — 步驟 2：選擇語言
 */

import { Languages, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const LANGUAGES = [
  { code: 'zh-TW', label: '繁體中文', flag: '🇹🇼', sample: '歡迎使用 V4' },
  { code: 'en', label: 'English', flag: '🇺🇸', sample: 'Welcome to V4' },
] as const;

interface Step2LanguageProps {
  value: string;
  onChange: (lang: string) => void;
}

export function Step2Language({ value, onChange }: Step2LanguageProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
          <Languages className="w-6 h-6 text-purple-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">選擇語言</h2>
          <p className="text-sm text-gray-500">之後可在設定中隨時變更</p>
        </div>
      </div>

      <div className="space-y-2">
        {LANGUAGES.map((lang) => {
          const selected = value === lang.code;
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => onChange(lang.code)}
              className={cn(
                'w-full p-4 rounded-lg border-2 transition-all text-left flex items-center gap-4',
                selected
                  ? 'border-blue-500 bg-blue-50 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              )}
            >
              <div className="text-3xl">{lang.flag}</div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">{lang.label}</div>
                <div className="text-sm text-gray-500 mt-0.5">{lang.sample}</div>
              </div>
              {selected && (
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-gray-400">
        變更語言後介面文字會立即切換，無需重啟
      </p>
    </div>
  );
}