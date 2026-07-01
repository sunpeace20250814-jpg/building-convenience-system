/**
 * 公設紀錄 Module（原 公設借用）
 * V4.1 模組重組後整合 4 個分頁：
 *   1. 月曆       - 點日期查看/新增當日借用
 *   2. 記錄表     - 表格列出所有借用，可編輯/刪除
 *   3. 管理報表   - 報表 / 公設使用率排行 / 付款統計
 *   4. 公設管理   - 新增：公設（facility）資料維護（從 settings/FacilitySettings 搬入）
 *
 * 注意：模組顯示名稱從「公設借用」改成「公設紀錄」（facilityBooking.title i18n key 變更）
 */

import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Plus, Trash2, Check, Clock, User, Building, DollarSign, Edit, BarChart3, Calendar, List as ListIcon, Dumbbell } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { HolidayCell } from '@/components/HolidayCell';
import { useFacilityBookingStore, type FacilityBooking } from '@/stores/facilityBookingStore';
import { useResidentStore } from '@/stores/residentStore';
import { useV1Store } from '@/stores';
import { FacilityManagementTab } from './FacilityManagementTab';

type Tab = 'calendar' | 'list' | 'manage' | 'facilities';

export function FacilityBookingModule() {
  const toast = useToast();
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('calendar');

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Building className="w-6 h-6 text-blue-600" />
          {t('facilityBooking.title')}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{t('facilityBooking.description')}</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 mb-4">
        <TabButton
          label={t('facilityBooking.tabCalendar')}
          icon={<Calendar className="w-4 h-4" />}
          active={tab === 'calendar'}
          onClick={() => setTab('calendar')}
        />
        <TabButton
          label={t('facilityBooking.tabList')}
          icon={<ListIcon className="w-4 h-4" />}
          active={tab === 'list'}
          onClick={() => setTab('list')}
        />
        <TabButton
          label="管理報表"
          icon={<BarChart3 className="w-4 h-4" />}
          active={tab === 'manage'}
          onClick={() => setTab('manage')}
        />
        <TabButton
          label={t('facilityBooking.tabFacilities')}
          icon={<Dumbbell className="w-4 h-4" />}
          active={tab === 'facilities'}
          onClick={() => setTab('facilities')}
        />
      </div>

      {tab === 'calendar' && <CalendarTab toast={toast} />}
      {tab === 'list' && <ListTab toast={toast} />}
      {tab === 'manage' && <ManageTab />}
      {tab === 'facilities' && <FacilityManagementTab />}
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

// =========================================================
// 分頁 1：月曆
// =========================================================
function CalendarTab({ toast }: { toast: any }) {
  const {
    bookings,
    loadBookings,
    createBooking,
    updateBooking,
    deleteBooking,
    togglePaid,
  } = useFacilityBookingStore();
  const { residents } = useResidentStore();
  const { facilities, loadFacilities } = useV1Store();

  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    loadBookings();
    loadFacilities();
  }, []);

  // 從 store 既有 bookings 篩選當月（fetch 已一次拉回，client-side filter）
  const monthBookings = useMemo(() => {
    const prefix = `${year}-${String(month).padStart(2, '0')}-`;
    return bookings.filter((b) => b.date.startsWith(prefix));
  }, [bookings, year, month]);

  const bookingsByDate = useMemo(() => {
    const map = new Map<string, FacilityBooking[]>();
    for (const b of monthBookings) {
      if (!map.has(b.date)) map.set(b.date, []);
      map.get(b.date)!.push(b);
    }
    return map;
  }, [monthBookings]);

  const daysInMonth = useMemo(() => {
    const days: { date: string; day: number }[] = [];
    const numDays = new Date(year, month, 0).getDate();
    for (let d = 1; d <= numDays; d++) {
      days.push({ date: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d });
    }
    return days;
  }, [year, month]);

  const firstDayOfWeek = useMemo(() => new Date(year, month - 1, 1).getDay(), [year, month]);

  const goPrev = () => { if (month === 1) { setYear(year - 1); setMonth(12); } else setMonth(month - 1); };
  const goNext = () => { if (month === 12) { setYear(year + 1); setMonth(1); } else setMonth(month + 1); };
  const today = new Date().toISOString().split('T')[0];

  const handleDelete = (id: string) => {
    if (!confirm('確定刪除這筆借用記錄？')) return;
    deleteBooking(id);
    toast.addToast('已刪除', 'info');
  };

  return (
    <>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4 bg-white border border-gray-200 rounded-lg px-4 py-3">
        <Button variant="ghost" size="sm" onClick={goPrev}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-lg font-semibold text-gray-900">{year} 年 {month} 月</h2>
        <Button variant="ghost" size="sm" onClick={goNext}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 border-b bg-gray-50">
          {['日', '一', '二', '三', '四', '五', '六'].map((d, idx) => (
            <div
              key={d}
              className={`px-2 py-2 text-center text-xs font-medium ${idx === 0 ? 'text-red-600' : idx === 6 ? 'text-blue-600' : 'text-gray-700'}`}
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square border-r border-b border-gray-100 bg-gray-50" />
          ))}
          {daysInMonth.map(({ date, day }) => {
            const dayBookings = bookingsByDate.get(date) || [];
            const isToday = date === today;
            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`aspect-square border-r border-b border-gray-100 p-1 text-left hover:bg-blue-50 transition-colors relative overflow-hidden ${isToday ? 'bg-blue-50 ring-2 ring-blue-500 ring-inset' : ''}`}
              >
                <div className={`text-xs ${isToday ? 'font-bold text-blue-600' : 'text-gray-700'}`}>{day}</div>
                <HolidayCell date={date} size="sm" variant="strip" className="mt-0.5" />
                <div className="mt-1 space-y-0.5">
                  {dayBookings.slice(0, 3).map((b) => (
                    <div
                      key={b.id}
                      className={`text-[10px] truncate px-1 py-0.5 rounded ${b.paid ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}
                      title={`${b.residentName} - ${b.facilityName}`}
                    >
                      {b.startTime} {b.facilityName}
                    </div>
                  ))}
                  {dayBookings.length > 3 && <div className="text-[10px] text-gray-400">+{dayBookings.length - 3}</div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-blue-100 rounded" />待付款
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-green-100 rounded" />已付款
        </span>
      </div>

      {selectedDate && (
        <DayDetailModal
          date={selectedDate}
          bookings={bookingsByDate.get(selectedDate) || []}
          facilities={facilities}
          residents={residents}
          onClose={() => setSelectedDate(null)}
          onCreate={(data) => { createBooking(data); toast.addToast('已新增借用記錄', 'success'); loadBookings(); }}
          onUpdate={(id, data) => { updateBooking(id, data); toast.addToast('已更新', 'success'); loadBookings(); }}
          onDelete={handleDelete}
          onTogglePaid={(id) => { togglePaid(id); loadBookings(); }}
        />
      )}
    </>
  );
}

// =========================================================
// 分頁 2：記錄表 - 全部借用的表格 + 篩選 + 編輯/刪除
// =========================================================
function ListTab({ toast }: { toast: any }) {
  const { t } = useTranslation();
  const { bookings, loadBookings, updateBooking, deleteBooking } = useFacilityBookingStore();
  const { facilities, loadFacilities } = useV1Store();
  const { residents, loadResidents } = useResidentStore();

  const [filterFacility, setFilterFacility] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [editing, setEditing] = useState<FacilityBooking | null>(null);

  useEffect(() => {
    loadBookings();
    loadFacilities();
    loadResidents();
  }, []);

  // store SQL 已經 ORDER BY date DESC, start_time DESC — 直接篩選即可
  const filtered = useMemo(() => bookings.filter((b) => {
    if (filterFacility && b.facilityId !== filterFacility) return false;
    if (dateFrom && b.date < dateFrom) return false;
    if (dateTo && b.date > dateTo) return false;
    return true;
  }), [bookings, filterFacility, dateFrom, dateTo]);

  const handleDelete = (id: string) => {
    if (!window.confirm(t('facilityBooking.list.deleteConfirm'))) return;
    deleteBooking(id);
    toast.addToast(t('facilityBooking.list.deleted'), 'info');
  };

  const handleUpdate = (id: string, data: Omit<FacilityBooking, 'id' | 'createdAt' | 'updatedAt'>) => {
    updateBooking(id, data);
    toast.addToast(t('facilityBooking.list.updated'), 'success');
    setEditing(null);
    loadBookings();
  };

  const resetFilters = () => {
    setFilterFacility('');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="space-y-4">
      {/* 篩選列 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">{t('facilityBooking.list.filterByFacility')}</label>
            <select
              value={filterFacility}
              onChange={(e) => setFilterFacility(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('facilityBooking.list.allFacilities')}</option>
              {facilities.map((f: any) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">{t('facilityBooking.list.filterByDateRange')} — {t('facilityBooking.list.filterByDateFrom')}</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">{t('facilityBooking.list.filterByDateRange')} — {t('facilityBooking.list.filterByDateTo')}</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <Button variant="ghost" size="sm" onClick={resetFilters}>清除篩選</Button>
          </div>
        </div>
      </div>

      {/* 表格 */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">{t('facilityBooking.list.title', { count: filtered.length })}</h3>
        </div>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <ListIcon className="w-10 h-10 mb-2" />
            <p className="text-sm">{t('facilityBooking.list.empty')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{t('facilityBooking.list.date')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('facilityBooking.list.unit')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('facilityBooking.list.facility')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{t('facilityBooking.list.timeRange')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('facilityBooking.list.paymentStatus')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('facilityBooking.list.notes')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{t('facilityBooking.list.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900 whitespace-nowrap font-mono text-xs">{b.date}</td>
                    <td className="px-4 py-3 text-gray-700">{b.residentName || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{b.facilityName}</td>
                    <td className="px-4 py-3 text-gray-700 font-mono text-xs whitespace-nowrap">{b.startTime} – {b.endTime}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${b.paid ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                        {b.paid ? t('facilityBooking.list.paid') : t('facilityBooking.list.unpaid')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs max-w-[200px] truncate" title={b.notes}>{b.notes || '-'}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => setEditing(b)}
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-600 inline-flex items-center"
                        title={t('common.edit')}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(b.id)}
                        className="p-1.5 hover:bg-red-50 rounded text-red-500 inline-flex items-center ml-1"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 編輯 modal — 沿用既有 BookingForm */}
      {editing && (
        <Modal
          isOpen
          onClose={() => setEditing(null)}
          title={t('facilityBooking.list.editModalTitle', { date: editing.date })}
          size="lg"
        >
          <BookingForm
            date={editing.date}
            initial={editing}
            facilities={facilities}
            residents={residents}
            onCancel={() => setEditing(null)}
            onSubmit={(data) => handleUpdate(editing.id, data)}
          />
        </Modal>
      )}
    </div>
  );
}

// =========================================================
// 分頁 3：管理報表
// =========================================================
function ManageTab() {
  const { bookings, loadBookings } = useFacilityBookingStore();
  const { facilities, loadFacilities } = useV1Store();
  const [filterFacility, setFilterFacility] = useState<string>('');
  const [filterPaid, setFilterPaid] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [filterMonth, setFilterMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    loadBookings();
    loadFacilities();
  }, []);

  const filtered = useMemo(() => bookings.filter((b) => {
    if (filterFacility && b.facilityId !== filterFacility) return false;
    if (filterPaid === 'paid' && !b.paid) return false;
    if (filterPaid === 'unpaid' && b.paid) return false;
    if (filterMonth && !b.date.startsWith(filterMonth)) return false;
    return true;
  }), [bookings, filterFacility, filterPaid, filterMonth]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const paid = filtered.filter((b) => b.paid).length;
    const totalFee = filtered.reduce((sum, b) => sum + (b.fee || 0), 0);
    const paidFee = filtered.filter((b) => b.paid).reduce((sum, b) => sum + (b.fee || 0), 0);
    return { total, paid, unpaid: total - paid, totalFee, paidFee, unpaidFee: totalFee - paidFee };
  }, [filtered]);

  const facilityUsage = useMemo(() => {
    const map = new Map<string, { name: string; count: number; fee: number }>();
    for (const b of filtered) {
      const existing = map.get(b.facilityId);
      const fee = b.fee || 0;
      if (existing) { existing.count += 1; existing.fee += fee; }
      else { map.set(b.facilityId, { name: b.facilityName ?? '', count: 1, fee }); }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">月份</label>
            <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">公設</label>
            <select value={filterFacility} onChange={(e) => setFilterFacility(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white">
              <option value="">全部公設</option>
              {facilities.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">付款狀態</label>
            <select value={filterPaid} onChange={(e) => setFilterPaid(e.target.value as any)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white">
              <option value="all">全部</option>
              <option value="paid">已付款</option>
              <option value="unpaid">未付款</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="總借用次" value={stats.total} icon={<Calendar className="w-5 h-5" />} color="blue" />
        <StatCard label="已付款" value={stats.paid} icon={<Check className="w-5 h-5" />} color="green" />
        <StatCard label="未付款" value={stats.unpaid} icon={<Clock className="w-5 h-5" />} color="orange" />
        <StatCard label="總收入" value={`$${stats.paidFee}`} icon={<DollarSign className="w-5 h-5" />} color="emerald" />
      </div>

      {/* Facility usage ranking */}
      {facilityUsage.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">公設使用排行</h3>
          <div className="space-y-2">
            {facilityUsage.map((f, idx) => {
              const maxCount = facilityUsage[0].count;
              const percent = (f.count / maxCount) * 100;
              return (
                <div key={idx} className="flex items-center gap-3 text-sm">
                  <span className="w-32 truncate text-gray-700">{f.name}</span>
                  <div className="flex-1 bg-gray-100 rounded h-6 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 flex items-center justify-end px-2 text-xs text-white font-medium" style={{ width: `${percent}%`, minWidth: '40px' }}>
                      {f.count}
                    </div>
                  </div>
                  <span className="w-20 text-right text-gray-600">${f.fee}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Records table */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">借用記錄（{filtered.length}）</h3>
        {filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">沒有符合條件的記錄</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">日期</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">時間</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">住戶</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">公設</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">費用</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-600">狀態</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.slice(0, 100).map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-900">{b.date}</td>
                    <td className="px-3 py-2 text-gray-700 font-mono text-xs">{b.startTime}-{b.endTime}</td>
                    <td className="px-3 py-2 text-gray-700">{b.residentName || '-'}</td>
                    <td className="px-3 py-2 text-gray-700">{b.facilityName}</td>
                    <td className="px-3 py-2 text-right text-gray-900">${b.fee}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${b.paid ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                        {b.paid ? '已付' : '未付'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: any; icon: React.ReactNode; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-500',
    green: 'text-green-500',
    orange: 'text-orange-500',
    emerald: 'text-emerald-500',
  };
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
      <div className={`mx-auto ${colorMap[color] || 'text-gray-500'}`}>{icon}</div>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

// =========================================================
// Day Detail Modal
// =========================================================
interface DayDetailModalProps {
  date: string;
  bookings: FacilityBooking[];
  facilities: any[];
  residents: any[];
  onClose: () => void;
  onCreate: (data: Omit<FacilityBooking, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdate: (id: string, data: Partial<FacilityBooking>) => void;
  onDelete: (id: string) => void;
  onTogglePaid: (id: string) => void;
}

function DayDetailModal({ date, bookings, facilities, residents, onClose, onCreate, onUpdate, onDelete, onTogglePaid }: DayDetailModalProps) {
  const [addingNew, setAddingNew] = useState(false);
  const [editing, setEditing] = useState<FacilityBooking | null>(null);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`公設借用 - ${date}`}
      size="xl"
      footer={
        <div className="flex justify-between items-center w-full">
          <Button variant="ghost" onClick={onClose}>關閉</Button>
          <Button onClick={() => setAddingNew(true)}>
            <Plus className="w-4 h-4 mr-1" />
            新增借用
          </Button>
        </div>
      }
    >
      <div className="space-y-3 max-h-[500px] overflow-y-auto">
        {bookings.length === 0 && !addingNew && !editing ? (
          <p className="text-sm text-gray-400 text-center py-8">這天還沒有任何借用記錄</p>
        ) : (
          bookings.map((b) => (
            <div key={b.id} className={`p-3 border rounded-lg ${b.paid ? 'border-green-200 bg-green-50' : 'border-blue-200 bg-blue-50'}`}>
              {editing?.id === b.id ? (
                <BookingForm
                  date={date}
                  initial={b}
                  facilities={facilities}
                  residents={residents}
                  onCancel={() => setEditing(null)}
                  onSubmit={(data) => { onUpdate(b.id, data); setEditing(null); }}
                />
              ) : (
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${b.paid ? 'bg-green-200 text-green-900' : 'bg-blue-200 text-blue-900'}`}>
                        {b.paid ? '✓ 已付款' : '○ 未付款'}
                      </span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {b.startTime} - {b.endTime}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-gray-900">{b.residentName || '-'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-gray-900">{b.facilityName || '-'}</span>
                      </div>
                      {(b.fee ?? 0) > 0 && (
                        <div className="flex items-center gap-1.5 col-span-2">
                          <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-gray-900">{b.fee} 元</span>
                        </div>
                      )}
                    </div>
                    {b.notes && <p className="text-xs text-gray-600 mt-2 italic">備註：{b.notes}</p>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => onTogglePaid(b.id)}
                      className={`p-1.5 rounded transition-colors ${b.paid ? 'hover:bg-green-100 text-green-700' : 'hover:bg-blue-100 text-blue-700'}`}
                      title={b.paid ? '標記為未付款' : '標記為已付款'}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setEditing(b)} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="編輯">
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onDelete(b.id)} className="p-1.5 hover:bg-red-50 rounded text-red-500" title="刪除">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}

        {addingNew && (
          <BookingForm
            date={date}
            facilities={facilities}
            residents={residents}
            onCancel={() => setAddingNew(false)}
            onSubmit={(data) => { onCreate(data); setAddingNew(false); }}
          />
        )}
      </div>
    </Modal>
  );
}

interface BookingFormProps {
  date: string;
  initial?: FacilityBooking;
  facilities: any[];
  residents: any[];
  onCancel: () => void;
  onSubmit: (data: Omit<FacilityBooking, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

function BookingForm({ date, initial, facilities, residents, onCancel, onSubmit }: BookingFormProps) {
  const [residentId, setResidentId] = useState(initial?.residentId || '');
  const [facilityId, setFacilityId] = useState(initial?.facilityId || '');
  const [startTime, setStartTime] = useState(initial?.startTime || '09:00');
  const [endTime, setEndTime] = useState(initial?.endTime || '11:00');
  const [paid, setPaid] = useState(!!initial?.paid);
  const [fee, setFee] = useState(initial?.fee || 0);
  const [notes, setNotes] = useState(initial?.notes || '');

  const handleSubmit = () => {
    if (!facilityId) { alert('請選擇公設'); return; }
    if (!startTime || !endTime) { alert('請填寫時間'); return; }
    const resident = residents.find((r: any) => r.id === residentId);
    const facility = facilities.find((f: any) => f.id === facilityId);
    onSubmit({
      date,
      residentId: residentId || null,
      residentName: resident ? (resident.name || resident.ownerName || resident.property) : '',
      facilityId,
      facilityName: facility ? facility.name : '',
      startTime,
      endTime,
      paid: paid ? 1 : 0,
      fee,
      notes,
    });
  };

  return (
    <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="哪戶（選填）"
          value={residentId}
          onChange={(e) => setResidentId(e.target.value)}
          options={[
            { value: '', label: '— 訪客 / 不指定 —' },
            ...residents.map((r: any) => ({
              value: r.id,
              label: `${r.property || r.name || ''} ${r.name || r.ownerName || ''}`.trim(),
            })),
          ]}
        />
        <Select
          label="公設 *"
          value={facilityId}
          onChange={(e) => {
            setFacilityId(e.target.value);
            const facility = facilities.find((f: any) => f.id === e.target.value);
            if (facility && !initial) setFee(facility.fee || 0);
          }}
          options={[
            { value: '', label: '請選擇公設' },
            ...facilities.map((f: any) => ({
              value: f.id,
              label: f.name + (f.fee ? ` ($${f.fee})` : ''),
            })),
          ]}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">開始時間 *</label>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">結束時間 *</label>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">費用</label>
          <input type="number" min="0" step="0.01" value={fee} onChange={(e) => setFee(Number(e.target.value) || 0)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="rounded" />
        <span className="text-gray-700">已付款</span>
      </label>

      <div>
        <label className="block text-xs text-gray-600 mb-1">備註</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>取消</Button>
        <Button size="sm" onClick={handleSubmit}>
          {initial ? '更新' : '儲存'}
        </Button>
      </div>
    </div>
  );
}