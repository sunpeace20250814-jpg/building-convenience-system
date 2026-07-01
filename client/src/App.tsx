/**
 * 應用入口
 *
 * V4 Phase 9 重寫：
 * - 不再 init sql.js WASM / IndexedDB / FileSystemAccess
 * - 啟動流程簡化為：pingBackend → 判斷 onboarding → 載入主畫面
 * - 所有資料走 server-side Fastify + better-sqlite3
 *
 * 詳細錯誤規則：見 V4/ERRORS.md ERR-014
 */

import { useTranslation } from 'react-i18next';
import { useEffect, useState, useCallback } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Sidebar } from '@/components/layout/Sidebar';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from '@/components/ui/Toast';
import { ContextAwareBanner } from '@/components/ContextAwareBanner';
import { OnboardingModule } from '@/modules/onboarding';
import { getOnboardingStatus } from '@/lib/onboarding';
import { pingBackend } from '@/lib/apiClient';
import { ResidentsModule } from '@/modules/residents';
import { ExpensesModule } from '@/modules/expenses';
import { ScheduleModule } from '@/modules/schedule';
import { HomeTabsModule } from '@/modules/home-tabs';
import { SettingsModule } from '@/modules/settings';
import { BackupModule } from '@/modules/backup';
import { CalendarModule } from '@/modules/calendar';
import { TutorialsModule } from '@/modules/tutorials';
import { ToolsModule } from '@/modules/tools';
import { FacilityBookingModule } from '@/modules/facility-booking';
import { MonitoringModule } from '@/modules/monitoring';
import { AIModule } from '@/modules/ai';
import { ModulesPage } from '@/modules-system/ModulesPage';
import { ChartOfAccounts } from '@/modules-system/pages/ChartOfAccounts';
import { JournalEntries } from '@/modules-system/pages/JournalEntries';
import { FinancialReports } from '@/modules-system/pages/FinancialReports';
import { AccountingPeriods } from '@/modules-system/pages/AccountingPeriods';
import { AccountsPage } from '@/modules-system/pages/Accounts';
import { InvoicesPage } from '@/modules-system/pages/Invoices';
import { BankReconcilePage } from '@/modules-system/pages/BankReconcile';
import { ReceivablesPage } from '@/modules-system/pages/Receivables';
import { AuditLogPage } from '@/modules-system/pages/AuditLog';
import { ReportsCenter } from '@/modules-system/pages/ReportsCenter';
import { ModuleGuard } from '@/modules-system/ModuleGuard';
import { Button } from '@/components/ui/Button';
import { Database } from 'lucide-react';

export default function App() {
  const { t } = useTranslation();
  const [booting, setBooting] = useState(true);
  const [serverAlive, setServerAlive] = useState<boolean | null>(null);
  // ★ onboarding 預設保守值（首次啟動），等 server 連線確認後再 setState 正確值
  const [onboardingStatus, setOnboardingStatus] = useState({
    isFirstRun: true,
    isCompleted: false,
    wasSkipped: false,
    skipCount: 0,
  });

  useEffect(() => {
    (async () => {
      // 1. 檢查 server 是否活著（取代舊版 initDefaultStorage）
      const alive = await pingBackend();
      setServerAlive(alive);

      // 2. server 活著才讀 onboarding 狀態
      if (alive) {
        try {
          setOnboardingStatus(getOnboardingStatus());
        } catch (err: any) {
          console.warn('[App] 讀取 onboarding 狀態失敗：', err?.message);
        }
      }
      setBooting(false);
    })();
  }, []);

  const refreshOnboardingStatus = useCallback(() => {
    setOnboardingStatus(getOnboardingStatus());
  }, []);

  if (booting) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-gray-600">{t('common.loadingStorage')}</p>
        </div>
      </div>
    );
  }

  // server 連不上 → 提示啟動 server（純前端 SPA 無資料）
  if (serverAlive === false) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 p-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
            <Database className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">無法連線到後端</h1>
          <p className="text-sm text-gray-600 mb-4">
            V4 採用前後端分離架構，需啟動 Fastify server 才能使用。
            <br />
            請確認 server 已在 port 3001 運行，再按「重試」。
          </p>
          <Button
            onClick={async () => {
              setBooting(true);
              const alive = await pingBackend();
              setServerAlive(alive);
              setBooting(false);
            }}
          >
            重試連線
          </Button>
        </div>
      </div>
    );
  }

  // 首次啟動 → 顯示精靈
  if (onboardingStatus.isFirstRun || onboardingStatus.wasSkipped) {
    return (
      <ToastProvider>
        <OnboardingModule onComplete={refreshOnboardingStatus} />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <ErrorBoundary>
      <ContextAwareBanner onChangeSettings={refreshOnboardingStatus} />
      <BrowserRouter>
        <div className="flex h-screen bg-gray-100">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            <Routes>
            {/* 業務核心（永遠可用） */}
            <Route path="/" element={<HomeTabsModule />} />
            <Route path="/residents" element={<ResidentsModule />} />
            <Route path="/expenses" element={<ExpensesModule />} />
            <Route path="/schedule" element={<ScheduleModule />} />
            <Route path="/home-tabs" element={<HomeTabsModule />} />
            <Route path="/settings" element={<SettingsModule />} />
            <Route path="/backup" element={<BackupModule />} />
            <Route path="/calendar" element={<CalendarModule />} />
            <Route path="/tutorials" element={<TutorialsModule />} />
            <Route path="/tools" element={<ToolsModule />} />
            <Route path="/facility-booking" element={<FacilityBookingModule />} />

            {/* 模組管理（永遠可用） */}
            <Route path="/modules" element={<ModulesPage />} />

            {/* 工具（永遠可用） */}
            <Route path="/monitoring" element={<MonitoringModule />} />
            <Route path="/ai" element={<AIModule />} />

            {/* 模組化路由（依啟用狀態守衛） */}
            <Route path="/reports" element={<ModuleGuard moduleId="reporting"><ReportsCenter /></ModuleGuard>} />
            <Route path="/accounts" element={<ModuleGuard moduleId="accounts"><AccountsPage /></ModuleGuard>} />
            <Route path="/accounting/chart" element={<ModuleGuard moduleId="double-entry"><ChartOfAccounts /></ModuleGuard>} />
            <Route path="/accounting/journal" element={<ModuleGuard moduleId="double-entry"><JournalEntries /></ModuleGuard>} />
            <Route path="/accounting/reports" element={<ModuleGuard moduleId="double-entry"><FinancialReports /></ModuleGuard>} />
            <Route path="/accounting/periods" element={<ModuleGuard moduleId="double-entry"><AccountingPeriods /></ModuleGuard>} />
            <Route path="/invoices" element={<ModuleGuard moduleId="invoice"><InvoicesPage /></ModuleGuard>} />
            <Route path="/bank-reconcile" element={<ModuleGuard moduleId="bank-reconcile"><BankReconcilePage /></ModuleGuard>} />
            <Route path="/receivables" element={<ModuleGuard moduleId="receivables"><ReceivablesPage /></ModuleGuard>} />
            <Route path="/audit-log" element={<ModuleGuard moduleId="audit"><AuditLogPage /></ModuleGuard>} />
          </Routes>
          </main>
        </div>
      </BrowserRouter>
      </ErrorBoundary>
    </ToastProvider>
  );
}
