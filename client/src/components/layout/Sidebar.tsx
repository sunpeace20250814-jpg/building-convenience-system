/**
 * 動態 Sidebar
 * 根據模組啟用狀態自動顯示/隱藏項目
 *
 * i18n：所有可見文字透過 useTranslation 取得，並提供語言切換下拉選單。
 */

import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Users, Receipt, Calendar, Settings, Building2, Activity, Sparkles,
  Wallet, ListTree, BookOpen, BarChart3, Hash, ArrowLeftRight,
  TrendingUp, TrendingDown, Shield, Scale, FileText, PieChart, CalendarRange,
  Home, Database, Languages, Video, Wrench, NotebookPen, Building,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { DatabaseStatus } from '@/components/DatabaseStatus';
import { NotificationBell } from '@/notifications/NotificationBell';
import { modules } from '@/modules-system/registry';
import { changeLanguage, getCurrentLanguage, SUPPORTED_LANGUAGES, SupportedLanguage } from '@/i18n';
import { useEffect, useState } from 'react';

// 圖標對照表
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Users, Receipt, Calendar, Settings, Wallet, ListTree, BookOpen,
  BarChart3, Hash, ArrowLeftRight, TrendingUp, TrendingDown, Shield,
  Scale, FileText, PieChart, CalendarRange, Home, Database, Video, Wrench, NotebookPen,
};

interface SidebarItem {
  path: string;
  labelKey: string; // i18n key under sidebar.items.*
  icon: React.ComponentType<{ className?: string }>;
  moduleId?: string;
  alwaysShow?: boolean;
}

const ALWAYS_VISIBLE: SidebarItem[] = [
  { path: '/residents', labelKey: 'residents', icon: Users, alwaysShow: true },
  { path: '/expenses', labelKey: 'expenses', icon: Receipt, alwaysShow: true },
  { path: '/schedule', labelKey: 'schedule', icon: Calendar, alwaysShow: true },
  { path: '/facility-booking', labelKey: 'facilityBooking', icon: Building, alwaysShow: true },
  { path: '/calendar', labelKey: 'calendar', icon: NotebookPen, alwaysShow: true },
  { path: '/home-tabs', labelKey: 'announcementLog', icon: FileText, alwaysShow: true },
  { path: '/tutorials', labelKey: 'tutorials', icon: Video, alwaysShow: true },
  { path: '/tools', labelKey: 'tools', icon: Wrench, alwaysShow: true },
  { path: '/backup', labelKey: 'backup', icon: Database, alwaysShow: true },
];

const MODULE_ITEMS: SidebarItem[] = [
  { path: '/modules', labelKey: 'modules', icon: Settings, alwaysShow: true },
  { path: '/settings', labelKey: 'settings', icon: Settings, alwaysShow: true },
  { path: '/reports', labelKey: 'reports', icon: PieChart, moduleId: 'reporting' },
  { path: '/accounting/chart', labelKey: 'chartOfAccounts', icon: ListTree, moduleId: 'double-entry' },
  { path: '/accounting/journal', labelKey: 'journal', icon: BookOpen, moduleId: 'double-entry' },
  { path: '/accounting/reports', labelKey: 'financialReports', icon: BarChart3, moduleId: 'double-entry' },
  { path: '/accounting/periods', labelKey: 'accountingPeriods', icon: CalendarRange, moduleId: 'double-entry' },
  { path: '/invoices', labelKey: 'invoices', icon: Receipt, moduleId: 'invoice' },
  { path: '/bank-reconcile', labelKey: 'bankReconcile', icon: Scale, moduleId: 'bank-reconcile' },
  { path: '/receivables', labelKey: 'receivables', icon: TrendingUp, moduleId: 'receivables' },
  { path: '/payables', labelKey: 'payables', icon: TrendingDown, moduleId: 'receivables' },
  { path: '/audit-log', labelKey: 'appLog', icon: Shield, moduleId: 'audit' },
];

// 工具列（永遠啟用）
const TOOL_ITEMS: SidebarItem[] = [
  { path: '/monitoring', labelKey: 'monitoring', icon: Activity, alwaysShow: true },
  { path: '/ai', labelKey: 'ai', icon: Sparkles, alwaysShow: true },
];

export function Sidebar({ className }: { className?: string }) {
  const { t } = useTranslation();
  const [, force] = useState(0);
  const [lang, setLang] = useState<SupportedLanguage>(getCurrentLanguage());
  const [langOpen, setLangOpen] = useState(false);

  useEffect(() => modules.subscribe(() => force((n) => n + 1)), []);

  const visibleModules = MODULE_ITEMS.filter(
    (item) => item.alwaysShow || !item.moduleId || modules.isEnabled(item.moduleId)
  );

  const handleLanguageChange = (lng: SupportedLanguage) => {
    changeLanguage(lng);
    setLang(lng);
    setLangOpen(false);
  };

  return (
    <nav
      className={twMerge(clsx(
        'w-64 bg-white shadow-lg min-h-screen flex flex-col overflow-y-auto',
        className
      ))}
    >
      {/* Logo + 存放位置（頂部合併） */}
      <div className="border-b flex-shrink-0">
        <div className="px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-lg font-bold text-gray-900">{t('sidebar.logo')}</h1>
              <p className="text-xs text-gray-500">{t('sidebar.subtitle')}</p>
            </div>
          </div>
          <NotificationBell />
        </div>
        {/* 存放位置（DatabaseStatus）— 從底部搬上來，左上角標題下 */}
        <div className="px-3 py-2">
          <DatabaseStatus />
        </div>
      </div>

      {/* 業務模組 */}
      <SidebarSection title={t('sidebar.sections.business')} items={ALWAYS_VISIBLE} />

      {/* 進階模組（依啟用狀態） */}
      <SidebarSection title={t('sidebar.sections.advanced')} items={visibleModules.filter(i => !ALWAYS_VISIBLE.includes(i) && !TOOL_ITEMS.includes(i))} />

      {/* 工具 */}
      <SidebarSection title={t('sidebar.sections.tools')} items={TOOL_ITEMS} />

      {/* 語言切換器 */}
      <div className="px-3 py-3 border-t flex-shrink-0 relative">
        <button
          onClick={() => setLangOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label={t('common.selectLanguage')}
          aria-haspopup="listbox"
          aria-expanded={langOpen}
        >
          <span className="flex items-center gap-2">
            <Languages className="w-4 h-4 text-gray-500" />
            <span className="font-medium">{t('common.language')}</span>
          </span>
          <span className="text-xs text-gray-500">
            {lang === 'zh-TW' && t('common.languageZhTW')}
            {lang === 'en' && t('common.languageEn')}
          </span>
        </button>
        {langOpen && (
          <ul
            role="listbox"
            className="absolute left-3 right-3 bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-50"
          >
            {SUPPORTED_LANGUAGES.map((lng) => (
              <li key={lng}>
                <button
                  role="option"
                  aria-selected={lang === lng}
                  onClick={() => handleLanguageChange(lng)}
                  className={twMerge(clsx(
                    'w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors',
                    lang === lng ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                  ))}
                >
                  {lng === 'zh-TW' && t('common.languageZhTW')}
                  {lng === 'en' && t('common.languageEn')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="px-6 py-3 text-xs text-gray-400 flex-shrink-0">
        {t('common.copyright')}
      </div>
    </nav>
  );
}

function SidebarSection({ title, items }: { title: string; items: SidebarItem[] }) {
  const { t } = useTranslation();
  if (items.length === 0) return null;
  return (
    <div className="py-2">
      <div className="px-6 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
        {title}
      </div>
      {items.map((item) => {
        const Icon = ICONS[item.icon.name] || item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              twMerge(clsx(
                'flex items-center px-6 py-2 text-sm text-gray-700 transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-600 border-r-4 border-blue-600 font-medium'
                  : 'hover:bg-gray-100'
              ))
            }
          >
            <Icon className="w-4 h-4 mr-3" />
            {t(`sidebar.items.${item.labelKey}`)}
          </NavLink>
        );
      })}
    </div>
  );
}
