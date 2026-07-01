/**
 * Settings Module - 精簡版（V4.1）
 * V4.1 模組重組後，部分分頁已搬入其他模組：
 *   - 公設（facility）→ 公設紀錄（原 facility-booking）
 *   - 停車位 → 住戶管理
 *   - 狀態 → 住戶管理
 *
 * SettingsModule 目前保留：
 *   - 棟別管理 (BuildingSettings) — 仍可從「設定」進入
 *   - 樓層設定 (FloorSettings)
 *   - 假期管理 (HolidaySettings) — holidayStore 統一管理
 *   - 儲存設定 (StorageSettings)
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Settings as SettingsIcon } from 'lucide-react';
import { BuildingSettings } from './BuildingSettings';
import { FloorSettings } from './FloorSettings';
import { HolidaySettings } from './HolidaySettings';
import { StorageSettings } from './StorageSettings';

type Section = 'buildings' | 'floors' | 'holidays' | 'storage';

const TAB_IDS: Section[] = ['buildings', 'floors', 'holidays', 'storage'];
const TAB_ICONS: Record<Section, string> = {
  buildings: '🏢',
  floors: '🏗️',
  holidays: '📅',
  storage: '💾',
};

export function SettingsModule() {
  const { t } = useTranslation();
  const [section, setSection] = useState<Section>('buildings');

  useEffect(() => {
    // Load any required data on mount
  }, []);

  return (
    <div className="p-6">
      <PageHeader
        title={t('settings.title')}
        description={t('settings.description')}
        actions={
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <SettingsIcon className="w-4 h-4" />
            <span>{t('settings.label')}</span>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b overflow-x-auto">
        {TAB_IDS.map((id) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              section === id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="mr-2">{TAB_ICONS[id]}</span>
            {t(`settings.tabs.${id}`)}
          </button>
        ))}
      </div>

      {/* Content */}
      <Card padding="lg">
        {section === 'buildings' && <BuildingSettings />}
        {section === 'floors' && <FloorSettings />}
        {section === 'holidays' && <HolidaySettings />}
        {section === 'storage' && <StorageSettings />}
      </Card>
    </div>
  );
}