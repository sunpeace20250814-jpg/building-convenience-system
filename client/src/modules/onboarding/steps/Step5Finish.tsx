/**
 * 首次啟動精靈 — 步驟 5：完成
 */

import { useEffect, useState } from 'react';
import { CheckCircle, ArrowRight, Sparkles, Database, Save, Globe } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface OnboardingSummary {
  language: string;
  storage: 'indexeddb' | 'filesystem';
  backupEnabled: boolean;
  backupDir: string;
  keepCount: number;
  scheduleHour: number;
}

interface Step5FinishProps {
  summary: OnboardingSummary;
  onEnterApp: () => void;
}

export function Step5Finish({ summary, onEnterApp }: Step5FinishProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    setShowConfetti(true);
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-6 text-center">
      {/* 慶祝動畫 */}
      <div className="relative flex justify-center">
        <div className="relative">
          <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-lg">
            <CheckCircle className="w-12 h-12 text-white" />
          </div>
          {showConfetti && (
            <>
              <Sparkles className="absolute top-0 left-0 w-6 h-6 text-yellow-400 animate-ping" />
              <Sparkles className="absolute top-2 right-2 w-5 h-5 text-yellow-400 animate-ping" style={{ animationDelay: '0.2s' }} />
              <Sparkles className="absolute bottom-0 left-2 w-4 h-4 text-yellow-400 animate-ping" style={{ animationDelay: '0.4s' }} />
            </>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">設定完成！</h2>
        <p className="text-gray-600">V4 已經準備就緒，可以開始使用了</p>
      </div>

      {/* 設定摘要 */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-5 text-left space-y-3">
        <h3 className="font-semibold text-blue-900 text-center mb-3">你的設定</h3>

        <SummaryRow
          icon={<Globe className="w-4 h-4" />}
          label="語言"
          value={languageLabel(summary.language)}
        />

        <SummaryRow
          icon={<Database className="w-4 h-4" />}
          label="儲存位置"
          value={summary.storage === 'indexeddb' ? '瀏覽器內建' : '本地資料夾'}
        />

        <SummaryRow
          icon={<Save className="w-4 h-4" />}
          label="每日備份"
          value={
            summary.backupEnabled
              ? `啟用 — 每天 ${summary.scheduleHour.toString().padStart(2, '0')}:00`
              : '關閉'
          }
          subValue={summary.backupEnabled ? summary.backupDir : undefined}
        />
      </div>

      <Button size="lg" onClick={onEnterApp} className="px-8">
        開始使用 V4
        <ArrowRight className="w-5 h-5 ml-2" />
      </Button>

      <p className="text-xs text-gray-400">
        隨時可在「設定」中變更這些選項
      </p>
    </div>
  );
}

function SummaryRow({
  icon,
  label,
  value,
  subValue,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-blue-600 flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-blue-700">{label}</div>
        <div className="text-sm font-medium text-gray-900 mt-0.5">{value}</div>
        {subValue && (
          <div className="text-xs text-gray-500 mt-0.5 truncate">{subValue}</div>
        )}
      </div>
    </div>
  );
}

function languageLabel(code: string): string {
  switch (code) {
    case 'zh-TW': return '繁體中文';
    case 'en': return 'English';
    default: return code;
  }
}