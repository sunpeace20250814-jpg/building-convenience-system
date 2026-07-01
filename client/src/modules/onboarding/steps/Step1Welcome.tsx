/**
 * 首次啟動精靈 — 步驟 1：歡迎
 */

import { Building2, Sparkles } from 'lucide-react';

export function Step1Welcome() {
  return (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="relative">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg">
            <Building2 className="w-12 h-12 text-white" />
          </div>
          <div className="absolute -top-2 -right-2">
            <Sparkles className="w-8 h-8 text-yellow-400" />
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">歡迎使用 V4</h2>
        <p className="text-gray-600">
          大樓住戶管理系統 — 純本地、零雲端費用、AI 友善
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left space-y-2">
        <h3 className="font-semibold text-blue-900">這個精靈會幫你完成：</h3>
        <ul className="text-sm text-blue-800 space-y-1.5 list-disc list-inside">
          <li>選擇介面語言</li>
          <li>設定資料儲存位置</li>
          <li>設定每日自動備份（建議）</li>
          <li>快速帶你認識 V4 主要功能</li>
        </ul>
        <p className="text-xs text-blue-700 mt-3 pt-3 border-t border-blue-200">
          ⏱ 預估時間：3 分鐘
        </p>
      </div>

      <p className="text-xs text-gray-400">
        所有資料都存在你的電腦，不會上傳到任何地方
      </p>
    </div>
  );
}