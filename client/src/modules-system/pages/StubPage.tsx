/**
 * 簡化版頁面：路由佔位
 * 完整實作留作後續
 */
import type { ReactNode } from 'react';
import { Construction } from 'lucide-react';

export function StubPage({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div className="p-12 text-center">
      <Construction className="w-16 h-16 text-gray-300 mx-auto mb-4" />
      <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
      {description && <p className="text-sm text-gray-500 max-w-md mx-auto">{description}</p>}
      <p className="text-xs text-gray-400 mt-4">此頁面為模組啟用後的入口，完整功能開發中</p>
    </div>
  );
}
