/**
 * Tutorials Module - 影片教學區
 *
 * V4 Phase 9 重寫：
 * - 舊版直接用 queryAll/execute 讀本地 SQLite tutorials 表
 * - Phase 9 已移除本地 SQLite（見 ERR-014）
 * - server 端暫無 /api/tutorials 路由（屬未遷移 tech debt）
 * - 此頁先顯示「功能遷移中」placeholder，等待 server-side API 完成
 *
 * 詳細錯誤規則：見 V4/ERRORS.md ERR-014, ERR-017
 */

import { Video, Construction } from 'lucide-react';

export function TutorialsModule() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Video className="w-8 h-8 text-purple-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">影片教學區</h1>
          <p className="text-sm text-gray-500 mt-1">收集並整理你的教學影片</p>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 flex items-start gap-4">
        <Construction className="w-8 h-8 text-yellow-600 flex-shrink-0" />
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-yellow-900 mb-2">功能遷移中</h2>
          <p className="text-sm text-yellow-800 mb-3">
            V4 已從瀏覽器本地 SQLite 遷移到伺服器端儲存，
            影片教學區的新版 API 尚在規劃中（需搭配 server 端 <code className="bg-yellow-100 px-1 rounded">/api/tutorials</code> 路由）。
          </p>
          <p className="text-sm text-yellow-700">
            在此之前，教學影片資料仍存在舊版本地 DB（如有備份可匯出還原）。
            詳細狀態請見 <code className="bg-yellow-100 px-1 rounded">V4/ERRORS.md</code> ERR-017。
          </p>
        </div>
      </div>
    </div>
  );
}
