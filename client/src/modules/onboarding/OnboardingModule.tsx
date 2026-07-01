/**
 * 首次啟動精靈主元件
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Wizard } from '@/components/wizard';
import { useToast } from '@/components/ui/Toast';
import { markOnboardingCompleted } from '@/lib/onboarding';
import { Step1Welcome } from './steps/Step1Welcome';
import { Step2Language } from './steps/Step2Language';
import { Step3Storage } from './steps/Step3Storage';
import { Step4Backup } from './steps/Step4Backup';
import { Step5Finish } from './steps/Step5Finish';

export interface OnboardingData {
  language: string;
  /** 已棄用：保留欄位相容舊版 Step3Storage 介面，V4 Phase 9 後不再實際使用本地儲存 */
  storage: 'indexeddb' | 'filesystem';
  backupEnabled: boolean;
  backupDir: string;
  keepCount: number;
  scheduleHour: number;
}

interface OnboardingModuleProps {
  /** 精靈完成後的回呼（用來讓 App 重新判斷狀態） */
  onComplete: () => void;
}

export function OnboardingModule({ onComplete }: OnboardingModuleProps) {
  const { i18n } = useTranslation();
  const toast = useToast();

  // 從 localStorage 讀取使用者目前的偏好作為預設值
  // ★ Phase 9：storage 欄位保留向後相容，V4 不再依賴 IndexedDB / FSA
  const [data, setData] = useState<OnboardingData>(() => ({
    language: localStorage.getItem('v4-lang') || i18n.language || 'zh-TW',
    storage: (localStorage.getItem('v4-storage-backend') as 'indexeddb' | 'filesystem') || 'indexeddb',
    backupEnabled: localStorage.getItem('v4-auto-backup-enabled') === '1',
    backupDir: localStorage.getItem('v4-auto-backup-dir') || '',
    keepCount: Number.parseInt(localStorage.getItem('v4-auto-backup-days') || '30', 10),
    scheduleHour: Number.parseInt(localStorage.getItem('v4-auto-backup-hour') || '2', 10),
  }));

  const handleComplete = async () => {
    try {
      // 套用語言
      if (data.language && data.language !== i18n.language) {
        await i18n.changeLanguage(data.language);
        localStorage.setItem('v4-lang', data.language);
      }

      // ★ Phase 9：v4-storage-backend 已棄用（V4 不再有 IndexedDB / FSA 選項）
      //   保留舊值以免破壞既有 localStorage；不再寫新值

      // 套用備份設定
      localStorage.setItem('v4-auto-backup-enabled', data.backupEnabled ? '1' : '0');
      if (data.backupEnabled) {
        localStorage.setItem('v4-auto-backup-dir', data.backupDir);
        localStorage.setItem('v4-auto-backup-days', String(data.keepCount));
        localStorage.setItem('v4-auto-backup-hour', String(data.scheduleHour));

        // 註冊排程
        try {
          await fetch('/api/schedule-backup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              enabled: true,
              dir: data.backupDir,
              keepCount: data.keepCount,
              hour: data.scheduleHour,
            }),
          });
        } catch (err) {
          console.warn('Failed to schedule backup:', err);
        }
      }

      // 標記完成
      markOnboardingCompleted();
      toast.addToast('設定完成！歡迎使用 V4', 'success');

      onComplete();
    } catch (err: any) {
      toast.addToast('設定失敗：' + (err?.message || '未知錯誤'), 'error');
      throw err;
    }
  };

  const handleSkip = () => {
    markOnboardingCompleted();
    toast.addToast('已跳過首次設定（之後可在「設定」中重新執行）', 'info');
    onComplete();
  };

  const steps = [
    {
      id: 'welcome',
      title: '歡迎',
      component: <Step1Welcome />,
      validate: () => true,
    },
    {
      id: 'language',
      title: '語言',
      component: (
        <Step2Language
          value={data.language}
          onChange={(lang) => setData((prev) => ({ ...prev, language: lang }))}
        />
      ),
      validate: () => true,
    },
    {
      id: 'storage',
      title: '儲存位置',
      component: (
        <Step3Storage
          value={data.storage}
          onChange={(s) => setData((prev) => ({ ...prev, storage: s }))}
        />
      ),
      validate: (d: unknown) => {
        const dd = d as OnboardingData;
        return !!dd.storage || '請選擇儲存位置';
      },
    },
    {
      id: 'backup',
      title: '備份設定',
      optional: true,
      component: (
        <Step4Backup
          enabled={data.backupEnabled}
          onEnabledChange={(v) => setData((prev) => ({ ...prev, backupEnabled: v }))}
          backupDir={data.backupDir}
          onBackupDirChange={(d) => setData((prev) => ({ ...prev, backupDir: d }))}
          keepCount={data.keepCount}
          onKeepCountChange={(c) => setData((prev) => ({ ...prev, keepCount: c }))}
          scheduleHour={data.scheduleHour}
          onScheduleHourChange={(h) => setData((prev) => ({ ...prev, scheduleHour: h }))}
        />
      ),
      validate: (d: unknown) => {
        const dd = d as OnboardingData;
        if (!dd.backupEnabled) return true;
        if (!dd.backupDir) return '請輸入備份位置';
        return true;
      },
    },
    {
      id: 'finish',
      title: '完成',
      component: (
        <Step5Finish
          summary={data}
          onEnterApp={handleComplete}
        />
      ),
      validate: () => true,
    },
  ];

  return (
    <Wizard
      title="V4 大樓住戶管理"
      subtitle="首次設定精靈（5 步驟，約 3 分鐘）"
      steps={steps}
      onComplete={handleComplete}
      onSkip={handleSkip}
      allowSkip
      completeLabel="完成設定並進入"
    />
  );
}