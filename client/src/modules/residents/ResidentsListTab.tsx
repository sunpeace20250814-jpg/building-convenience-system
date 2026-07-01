/**
 * Residents 列表 Tab — Residents → Tabs[0]
 *
 * 從原 ResidentsModule 搬出來的列表邏輯（生樓表 / 表格視圖 / CSV 匯入匯出 / Modal）
 * 包含：
 *   - 搜尋、棟別過濾
 *   - 棟別書籤頁
 *   - 生樓表 vs 列表視圖切換
 *   - 棟別管理 Modal (BuildingSettings)
 *   - ResidentModal / ResidentDetail
 *   - CSV 匯入匯出 + ReportButton
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useResidentStore, useSettingsStore, useV1Store } from '@/stores';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ResidentModal } from './ResidentModal';
import { ResidentDetail } from './ResidentDetail';
import { ReportButton } from '@/components/ReportButton';
import { Grid3x3, List, Search, Plus, Users, MapPin, Phone, Trash2, Upload, Download, Building2, X } from 'lucide-react';
import { exportResidentsCSV, parseResidentsCSV, downloadCSV } from './csv';
import { BuildingSettings } from '@/modules/settings/BuildingSettings';

type ViewMode = 'grid' | 'list';

/**
 * 棟別書籤 tab
 */
function BuildingTab({ label, count, active, onClick }: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors relative ${
        active
          ? 'text-blue-600 border-b-2 border-blue-600'
          : 'text-gray-600 hover:text-gray-900 border-b-2 border-transparent'
      }`}
    >
      {label}
      {count !== undefined && (
        <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
          active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

export function ResidentsListTab() {
  const { t } = useTranslation();
  const { residents, loadResidents, deleteResident, createResident } = useResidentStore();
  const { buildings, loadBuildings, loadStatuses } = useSettingsStore();
  const { floors, loadFloors, houseStatuses, loadHouseStatuses } = useV1Store();

  const [view, setView] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('');
  const [selectedResident, setSelectedResident] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResident, setEditingResident] = useState<any | null>(null);
  const [buildingModalOpen, setBuildingModalOpen] = useState(false);

  useEffect(() => {
    loadResidents();
    loadBuildings();
    loadStatuses();
    loadFloors();
    loadHouseStatuses();
  }, []);

  const filteredResidents = residents.filter((r) => {
    if (buildingFilter && r.buildingId !== buildingFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (r.name || '').toLowerCase().includes(q) ||
        (r.ownerName || '').toLowerCase().includes(q) ||
        (r.renterName || '').toLowerCase().includes(q) ||
        (r.phone || '').includes(q) ||
        (r.floor || '').toLowerCase().includes(q) ||
        (r.unitNumber || '').toLowerCase().includes(q) ||
        (r.property || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleDelete = (resident: any) => {
    if (window.confirm(t('residents.deleteConfirm', { name: resident.name || resident.ownerName }))) {
      deleteResident(resident.id);
    }
  };

  const handleEdit = (resident: any) => {
    setEditingResident(resident);
    setIsModalOpen(true);
  };

  const handleNew = (prefill?: any) => {
    setEditingResident(prefill || null);
    setIsModalOpen(true);
  };

  // 匯出 CSV
  const handleExport = () => {
    const csv = exportResidentsCSV(filteredResidents);
    downloadCSV(csv, `residents_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // 匯入 CSV
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseResidentsCSV(reader.result as string);
        if (rows.length === 0) {
          alert(t('residents.csvEmpty'));
          return;
        }
        if (!confirm(t('residents.csvImportConfirm', { count: rows.length }))) return;
        rows.forEach((row) => {
          if (!row.property || !row.name) return;
          const [, floorStr, unitStr] = row.property.split('-');
          const floorIdx = Number(floorStr) || 1;
          const floorMap: any = { 1: '1F', 2: '2F', 3: '3F', 4: '4F', 5: '5F', '-1': 'B1', '-2': 'B2' };
          const floorLabel = floorMap[floorIdx] || String(floorIdx) + 'F';
          createResident({
            property: row.property,
            floor: floorLabel,
            floorIndex: floorIdx,
            unitNumber: unitStr || '',
            name: row.name,
            phone: row.phone,
            email: row.email,
            memberCount: Number(row.memberCount) || 0,
            status: row.status,
            notes: row.notes,
            unitType: 'normal',
            buildingId: buildings[0]?.id || 'default',
            moveInDate: new Date().toISOString().split('T')[0],
          });
        });
        alert(t('residents.csvImportDone', { count: rows.length }));
        loadResidents();
      } catch (err: any) {
        alert(t('residents.csvImportFailed', { message: err.message }));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ============== 生樓表視圖 ==============
  const renderBuildingGrid = (building: any) => {
    const buildingFloors = floors
      .filter((f: any) => f.buildingId === building.id)
      .sort((a: any, b: any) => a.floorIndex - b.floorIndex);
    const buildingResidents = residents.filter((r) => r.buildingId === building.id);

    if (buildingFloors.length === 0) {
      return (
        <Card key={building.id} className="text-center py-8 text-gray-400">
          {t('residents.emptyBuilding', { name: building.name })}
        </Card>
      );
    }

    return (
      <Card key={building.id} className="mb-6">
        <div className="flex items-center justify-between mb-4 pb-3 border-b">
          <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-600" />
            {building.name}
          </h3>
          <div className="text-xs text-gray-500">
            {t('residents.floorCount', { count: buildingFloors.length, occupied: buildingResidents.length })}
          </div>
        </div>

        <div className="space-y-3">
          {buildingFloors.map((floor: any) => {
            const floorResidents = buildingResidents.filter(
              (r) => r.floor === floor.floorLabel || r.floorId === floor.id
            );
            const units = Array.from({ length: floor.unitCount || 0 }, (_, i) => i + 1);
            const isBasement = floor.isBasement;
            const isRooftop = floor.isRooftop;

            return (
              <div key={floor.id} className={`flex items-center gap-3 p-2 rounded-lg ${
                isBasement ? 'bg-orange-50' : isRooftop ? 'bg-purple-50' : 'bg-gray-50'
              }`}>
                <div className="w-16 flex-shrink-0 text-sm font-medium text-gray-700 text-center">
                  {floor.floorLabel}
                  <div className="text-xs text-gray-400">{t('common.unitCount', { count: units.length })}</div>
                </div>
                <div className="flex flex-wrap gap-2 flex-1">
                  {units.map((unitNo) => {
                    const unitResident = floorResidents.find((r) => r.unitNumber === String(unitNo) || r.unitNumber === String(unitNo).padStart(2, '0'));
                    const filled = !!unitResident;
                    const property = `${building.id.slice(0, 4)}-${floor.floorIndex}-${String(unitNo).padStart(2, '0')}`;
                    const status = houseStatuses.find((s: any) => s.id === unitResident?.statusId);

                    if (filled && unitResident) {
                      return (
                        <button
                          key={unitNo}
                          onClick={() => setSelectedResident(unitResident)}
                          className="w-20 h-20 border-2 rounded-lg p-2 text-left transition-all hover:shadow-md"
                          style={{ borderColor: status?.color || '#22c55e', backgroundColor: (status?.color || '#22c55e') + '10' }}
                          title={`${unitResident.name || unitResident.ownerName} (${unitResident.phone || '-'})`}
                        >
                          <div className="text-xs font-medium text-gray-900 truncate">
                            {unitResident.name || unitResident.ownerName}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5 truncate">
                            {unitResident.phone}
                          </div>
                          <div className="text-xs mt-1" style={{ color: status?.color }}>
                            {status?.label || '正常'}
                          </div>
                        </button>
                      );
                    }

                    return (
                      <button
                        key={unitNo}
                        onClick={() => handleNew({
                          buildingId: building.id,
                          floorId: floor.id,
                          floor: floor.floorLabel,
                          floorIndex: floor.floorIndex,
                          unitNumber: String(unitNo).padStart(2, '0'),
                          property,
                          unitType: 'normal',
                          status: '正常',
                        })}
                        className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg p-2 text-center text-gray-400 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                      >
                        <div className="text-xs">{property.split('-').pop()}</div>
                        <div className="text-xs mt-1">+ {t('residents.stats.vacant')}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    );
  };

  // ============== 列表視圖 ==============
  const renderList = () => (
    <Card padding="none">
      {filteredResidents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <Users className="w-12 h-12 mb-3" />
          <p className="text-lg font-medium">{t('residents.noResidents')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('residents.listHeaders.property')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('residents.listHeaders.owner')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('residents.listHeaders.renter')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('residents.listHeaders.phone')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('residents.listHeaders.type')}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('residents.listHeaders.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredResidents.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{r.property || `${r.floor}-${r.unitNumber}`}</p>
                        <p className="text-xs text-gray-500">{r.floor} {r.unitNumber && `戶 ${r.unitNumber}`}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium">{r.name || r.ownerName}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{r.renterName || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{r.phone ? <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-gray-400" />{r.phone}</span> : '-'}</td>
                  <td className="px-6 py-4"><Badge variant={r.unitType === 'rental' ? 'warning' : 'info'} size="sm">{r.unitType === 'rental' ? t('residents.typeRental') : t('residents.typeNormal')}</Badge></td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setSelectedResident(r)}>{t('common.details')}</Button>
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(r)}>{t('common.edit')}</Button>
                      <Button size="sm" variant="danger" onClick={() => handleDelete(r)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );

  const filteredBuildings = buildingFilter
    ? buildings.filter((b) => b.id === buildingFilter)
    : buildings;

  return (
    <div className="space-y-4">
      {/* Toolbar + Action bar（Tab 0 專屬） */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder={t('residents.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            value={buildingFilter}
            onChange={(e) => setBuildingFilter(e.target.value)}
            options={[{ value: '', label: t('residents.allBuildings') }, ...buildings.map((b) => ({ value: b.id, label: b.name }))]}
            className="w-40"
          />
          <div className="flex border rounded-lg overflow-hidden">
            <button
              onClick={() => setView('grid')}
              className={`px-3 py-2 text-sm ${view === 'grid' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700'}`}
              title={t('residents.gridView')}
            >
              <Grid3x3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-3 py-2 text-sm ${view === 'list' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700'}`}
              title={t('residents.listView')}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t">
          <Button variant="secondary" onClick={() => setBuildingModalOpen(true)}>
            <Building2 className="w-4 h-4 mr-2" />棟別管理
          </Button>
          <ReportButton
            label={t('residents.exportReport')}
            generate={() => ({
              title: t('residents.title'),
              subtitle: `${t('residents.stats.totalUnits')} ${residents.length}`,
              filename: `residents_${new Date().toISOString().slice(0, 10)}`,
              columns: [
                { key: 'property', label: t('residents.listHeaders.property'), width: 12 },
                { key: 'floor', label: 'floor', width: 8 },
                { key: 'unitNumber', label: 'unit', width: 8 },
                { key: 'name', label: t('residents.listHeaders.owner'), width: 15 },
                { key: 'phone', label: t('residents.listHeaders.phone'), width: 15 },
                { key: 'unitType', label: t('residents.listHeaders.type'), width: 10, format: (v: any) => v === 'rental' ? t('residents.typeRental') : t('residents.typeNormal') },
                { key: 'moveInDate', label: 'moveIn', width: 12 },
              ],
              rows: filteredResidents,
            })}
          />
          <Button variant="secondary" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />{t('residents.exportCsv')}
          </Button>
          <label className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 text-sm">
            <Upload className="w-4 h-4 mr-2" />{t('residents.importCsv')}
            <input type="file" accept=".csv" className="hidden" onChange={handleImport} />
          </label>
          <Button onClick={() => handleNew()}>
            <Plus className="w-4 h-4 mr-2" />
            {t('residents.addResident')}
          </Button>
        </div>

        {/* 統計 */}
        <div className="flex gap-4 mt-3 pt-3 border-t text-sm">
          <span className="text-gray-500">{t('residents.stats.totalUnits')}：<span className="font-medium text-gray-900">{residents.length}</span></span>
          <span className="text-gray-500">{t('residents.stats.totalMembers')}：<span className="font-medium text-gray-900">{residents.reduce((sum, r) => sum + (r.memberCount || 0), 0)}</span></span>
          <span className="text-gray-500">{t('residents.stats.vacantUnits')}：<span className="font-medium text-gray-900">{(() => {
            const totalUnits = floors.reduce((sum, f) => sum + (f.unitCount || 0), 0);
            return Math.max(0, totalUnits - residents.length);
          })()}</span></span>
        </div>
      </Card>

      {/* 棟別書籤頁 */}
      {buildings.length > 0 && (
        <div className="mb-4 border-b border-gray-200">
          <div className="flex items-center gap-1 overflow-x-auto pb-px">
            <BuildingTab
              label="全部"
              count={buildings.length}
              active={!buildingFilter}
              onClick={() => setBuildingFilter('')}
            />
            {buildings.map((b: any) => {
              const count = residents.filter((r) => r.buildingId === b.id).length;
              return (
                <BuildingTab
                  key={b.id}
                  label={b.name}
                  count={count}
                  active={buildingFilter === b.id}
                  onClick={() => setBuildingFilter(b.id)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Content */}
      {view === 'grid' ? (
        <div>
          {buildings.length === 0 ? (
            <Card className="text-center py-12 text-gray-400">
              <MapPin className="w-12 h-12 mx-auto mb-3" />
              <p>{t('residents.noBuildings')}</p>
              <p className="text-sm mt-2">請到「設定 → 棟別」新增並生成住戶</p>
            </Card>
          ) : filteredBuildings.length === 0 ? (
            <Card className="text-center py-12 text-gray-400">
              <p>{t('residents.noBuildingData')}</p>
            </Card>
          ) : (
            filteredBuildings.map(renderBuildingGrid)
          )}
        </div>
      ) : (
        renderList()
      )}

      {/* Modals */}
      {isModalOpen && (
        <ResidentModal
          resident={editingResident}
          onClose={() => {
            setIsModalOpen(false);
            setEditingResident(null);
          }}
        />
      )}

      {buildingModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                棟別管理
              </h2>
              <button
                onClick={() => setBuildingModalOpen(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <BuildingSettings />
            </div>
          </div>
        </div>
      )}

      {selectedResident && (
        <ResidentDetail
          resident={selectedResident}
          onClose={() => setSelectedResident(null)}
        />
      )}
    </div>
  );
}