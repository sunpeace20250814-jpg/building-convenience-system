/**
 * Residents Module - V4 Tab 容器
 *
 * V4.1 模組重組後，住戶模組整合了 4 個子分頁：
 *   - Tabs[0] 住戶（ResidentsListTab）：生樓表 / 表格視圖 / CSV / 棟別管理
 *   - Tabs[1] 裝潢記錄（DecorationRecordsTab）：跨住戶列出所有裝潢記錄
 *   - Tabs[2] 車位管理（ParkingTab）：車位 CRUD + 住戶雙向綁定（從 settings/ParkingSettings 搬入）
 *   - Tabs[3] 狀態管理（StatusTab）：住戶狀態 + 車位狀態（從 settings/StatusSettings 搬入）
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { Users, Hammer, Car, Tag } from 'lucide-react';
import { ResidentsListTab } from './ResidentsListTab';
import { DecorationRecordsTab } from './DecorationRecordsTab';
import { ParkingTab } from './ParkingTab';
import { StatusTab } from './StatusTab';

type Tab = 'residents' | 'decorations' | 'parking' | 'status';

interface TabDef {
  id: Tab;
  labelKey: string;
  icon: React.ReactNode;
}

const TABS: TabDef[] = [
  { id: 'residents', labelKey: 'residents.tabResidents', icon: <Users className="w-4 h-4" /> },
  { id: 'decorations', labelKey: 'residents.tabDecorations', icon: <Hammer className="w-4 h-4" /> },
  { id: 'parking', labelKey: 'residents.tabParking', icon: <Car className="w-4 h-4" /> },
  { id: 'status', labelKey: 'residents.tabStatus', icon: <Tag className="w-4 h-4" /> },
];

export function ResidentsModule() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('residents');

  return (
    <div className="p-6">
      <PageHeader
        title={t('residents.title')}
        description={t('residents.description')}
      />

      {/* Module-level Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 mb-4">
        {TABS.map((tdef) => (
          <TabButton
            key={tdef.id}
            label={t(tdef.labelKey)}
            icon={tdef.icon}
            active={tab === tdef.id}
            onClick={() => setTab(tdef.id)}
          />
        ))}
      </div>

      {tab === 'residents' && <ResidentsListTab />}
      {tab === 'decorations' && <DecorationRecordsTab />}
      {tab === 'parking' && <ParkingTab />}
      {tab === 'status' && <StatusTab />}
    </div>
  );
}

function TabButton({ label, icon, active, onClick }: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-blue-600 text-blue-700'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}