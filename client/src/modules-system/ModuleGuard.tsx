/**
 * 模組守衛：未啟用時自動導向模組管理頁
 */

import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { modules } from './registry';
import { AlertTriangle } from 'lucide-react';

export function ModuleGuard({ moduleId, children }: { moduleId: string; children: ReactNode }) {
  if (!modules.get(moduleId)) {
    return (
      <div className="p-12 text-center">
        <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">模組「{moduleId}」不存在</p>
      </div>
    );
  }

  if (!modules.isEnabled(moduleId)) {
    return <Navigate to="/modules" replace />;
  }

  return <>{children}</>;
}
