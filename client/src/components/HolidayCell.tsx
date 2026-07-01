/**
 * HolidayCell — 共用假期色塊元件
 *
 * 用於 Schedule / Calendar / FacilityBooking 等模組顯示某日是否為假期
 * 從 useHolidayStore 拿 holidays + categories，自動對 date 配對套色
 *
 * 用法：
 *   <HolidayCell date="2026-10-10" />
 *   <HolidayCell date="2026-10-10" showName />        // 顯示假期名稱
 *   <HolidayCell date="2026-10-10" size="lg" />        // sm/md/lg
 *   <HolidayCell date="2026-10-10" variant="dot" />    // dot（圓點）/ strip（左邊豎條）/ full（背景填色）
 */

import { useMemo } from 'react';
import { useHolidayStore } from '@/stores';

interface HolidayCellProps {
  date: string; // YYYY-MM-DD
  showName?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'dot' | 'strip' | 'full';
  className?: string;
}

export function HolidayCell({
  date,
  showName = false,
  size = 'md',
  variant = 'dot',
  className = '',
}: HolidayCellProps) {
  const { holidays, categories } = useHolidayStore();

  const holiday = useMemo(
    () => holidays.find((h) => h.date === date),
    [holidays, date]
  );

  if (!holiday) return null;

  // 解析顏色：holiday.color 優先，否則從 category 找，再 fallback #ef4444
  const color =
    holiday.color ||
    categories.find((c) => c.id === holiday.categoryId)?.color ||
    '#ef4444';

  const sizeClass = {
    sm: 'text-[10px] px-1 py-0.5',
    md: 'text-xs px-1.5 py-0.5',
    lg: 'text-sm px-2 py-1',
  }[size];

  if (variant === 'full') {
    return (
      <div
        className={`rounded ${sizeClass} ${className}`}
        style={{
          backgroundColor: `${color}22`, // 13% 透明度
          borderLeft: `3px solid ${color}`,
          color: color,
        }}
        title={holiday.name}
      >
        {showName ? holiday.name : '🎉'}
      </div>
    );
  }

  if (variant === 'strip') {
    return (
      <div
        className={`flex items-center gap-1 ${sizeClass} ${className}`}
        title={holiday.name}
      >
        <span
          className="inline-block w-1 h-3 rounded-sm flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        {showName && <span className="truncate" style={{ color }}>{holiday.name}</span>}
      </div>
    );
  }

  // dot（預設）
  return (
    <span
      className={`inline-flex items-center gap-1 ${sizeClass} ${className}`}
      title={`${holiday.name}（${color}）`}
    >
      <span
        className="inline-block w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      {showName && <span className="truncate" style={{ color }}>{holiday.name}</span>}
    </span>
  );
}

/**
 * useHolidayByDate — hook：回傳某日期的 holiday + color（給非元件地方用）
 */
export function useHolidayByDate(date: string): {
  holiday: { id: string; name: string; color?: string | null } | null;
  color: string;
  isHoliday: boolean;
} {
  const { holidays, categories } = useHolidayStore();
  const holiday = holidays.find((h) => h.date === date) || null;
  if (!holiday) {
    return { holiday: null, color: '', isHoliday: false };
  }
  const color =
    holiday.color ||
    categories.find((c) => c.id === holiday.categoryId)?.color ||
    '#ef4444';
  return { holiday, color, isHoliday: true };
}