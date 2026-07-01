/**
 * 模組管理頁面
 * 列出所有模組、啟用狀態、開關、依賴說明
 */

import { useState, useEffect } from 'react';
import { modules, type ModuleManifest, type ModuleCategory } from '@/modules-system/registry';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Settings, AlertCircle, CheckCircle2, Power, Lock } from 'lucide-react';

const CATEGORY_LABEL: Record<ModuleCategory, string> = {
  core: '核心',
  accounting: '會計',
  tax: '稅務',
  banking: '銀行',
  reporting: '報表',
  productivity: '生產力',
  integration: '整合',
};

const CATEGORY_COLOR: Record<ModuleCategory, string> = {
  core: 'bg-gray-100 text-gray-700',
  accounting: 'bg-blue-100 text-blue-700',
  tax: 'bg-purple-100 text-purple-700',
  banking: 'bg-green-100 text-green-700',
  reporting: 'bg-orange-100 text-orange-700',
  productivity: 'bg-pink-100 text-pink-700',
  integration: 'bg-cyan-100 text-cyan-700',
};

export function ModulesPage() {
  const [, force] = useState(0);
  const [filter, setFilter] = useState<ModuleCategory | 'all'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    modules.loadFromStorage();
    return modules.subscribe(() => force((n) => n + 1));
  }, []);

  const all = modules.all();
  const filtered = filter === 'all' ? all : all.filter((m) => m.category === filter);

  // 依 category 分組
  const byCategory = new Map<ModuleCategory, ModuleManifest[]>();
  for (const m of all) {
    if (!byCategory.has(m.category)) byCategory.set(m.category, []);
    byCategory.get(m.category)!.push(m);
  }

  const enabledCount = all.filter((m) => modules.isEnabled(m.id)).length;

  async function handleToggle(m: ModuleManifest) {
    setBusyId(m.id);
    setError(null);
      try {
      const result = modules.isEnabled(m.id)
        ? modules.disable(m.id)
        : modules.enable(m.id);
      if (!result.ok) {
        setError(result.error || '操作失敗');
      } else if ('cascaded' in result && result.cascaded && result.cascaded.length > 0) {
        // 提示連帶啟用
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="模組管理"
        description={`已啟用 ${enabledCount} / ${all.length} 個模組。關閉不需要的功能可讓介面更簡潔。`}
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              if (confirm('重置所有模組設定？')) modules.reset();
            }}
          >
            <Settings className="w-4 h-4 mr-2" />
            重置為預設
          </Button>
        }
      />

      <div className="flex gap-2 flex-wrap">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
          全部 ({all.length})
        </FilterChip>
        {Array.from(byCategory.entries()).map(([cat, ms]) => (
          <FilterChip
            key={cat}
            active={filter === cat}
            onClick={() => setFilter(cat)}
          >
            {CATEGORY_LABEL[cat]} ({ms.length})
          </FilterChip>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((m) => (
          <ModuleCard
            key={m.id}
            manifest={m}
            enabled={modules.isEnabled(m.id)}
            onToggle={() => handleToggle(m)}
            busy={busyId === m.id}
          />
        ))}
      </div>
    </div>
  );
}

function FilterChip({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
        active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

function ModuleCard({ manifest, enabled, onToggle, busy }: { manifest: ModuleManifest; enabled: boolean; onToggle: () => void; busy: boolean }) {
  return (
    <Card className={enabled ? 'ring-2 ring-blue-200' : ''}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold text-gray-900">{manifest.name}</h3>
            <Badge variant={enabled ? 'success' : 'default'} size="sm">
              {enabled ? '已啟用' : '已停用'}
            </Badge>
            {manifest.core && (
              <Badge variant="info" size="sm">
                <Lock className="w-3 h-3 mr-1 inline" />
                核心
              </Badge>
            )}
          </div>
          <span className={`inline-block text-xs px-2 py-0.5 rounded ${CATEGORY_COLOR[manifest.category]}`}>
            {CATEGORY_LABEL[manifest.category]}
          </span>
        </div>
        <button
          onClick={onToggle}
          disabled={busy || manifest.core}
          className={`ml-3 p-2 rounded-lg transition-colors ${
            enabled ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          } ${manifest.core ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={enabled ? '停用' : '啟用'}
        >
          {enabled ? <CheckCircle2 className="w-5 h-5" /> : <Power className="w-5 h-5" />}
        </button>
      </div>

      <p className="text-sm text-gray-600 mb-3">{manifest.description}</p>

      {manifest.requires && manifest.requires.length > 0 && (
        <div className="text-xs text-gray-500 mb-2">
          <span className="font-medium">依賴：</span>
          {manifest.requires.join(', ')}
        </div>
      )}

      {manifest.routes && manifest.routes.length > 0 && (
        <div className="text-xs text-blue-600">
          → {manifest.routes.length} 個頁面
        </div>
      )}
    </Card>
  );
}
