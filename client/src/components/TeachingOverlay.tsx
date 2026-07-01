/**
 * 教學 Overlay 元件
 * 用於模組首次使用時顯示 step-by-step 教學
 */

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { markModuleTourShown } from '@/lib/onboarding';

export interface TourStep {
  /** 步驟標題 */
  title: string;
  /** 步驟說明 */
  description: string;
  /** 對應到畫面上的元素選擇器（會高亮該元素） */
  target?: string;
}

interface TeachingOverlayProps {
  moduleId: string;
  steps: TourStep[];
  /** 是否自動顯示（如果還沒顯示過） */
  autoShow?: boolean;
}

export function TeachingOverlay({
  moduleId,
  steps,
  autoShow = true,
}: TeachingOverlayProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!autoShow) return;
    const shown = localStorage.getItem(`v4-module-tour-shown-${moduleId}`) === '1';
    if (!shown && steps.length > 0) {
      // 延遲顯示，等模組完全渲染
      const timer = setTimeout(() => setIsOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, [autoShow, moduleId, steps]);

  const handleClose = () => {
    setIsOpen(false);
    markModuleTourShown(moduleId);
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleClose();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  if (!isOpen) return null;

  const step = steps[currentStep];

  return (
    <>
      {/* 半透明遮罩 */}
      <div className="fixed inset-0 z-40 bg-black/30 pointer-events-none" />

      {/* 教學卡 */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md">
        <div className="bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                {currentStep + 1}
              </div>
              <span className="text-sm font-medium text-blue-900">
                教學 {currentStep + 1} / {steps.length}
              </span>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="p-1 hover:bg-white/50 rounded transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Body */}
          <div className="px-4 py-4">
            <h3 className="font-semibold text-gray-900 mb-1">{step.title}</h3>
            <p className="text-sm text-gray-600">{step.description}</p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t">
            <Button variant="ghost" size="sm" onClick={handleClose}>
              略過教學
            </Button>
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <Button variant="secondary" size="sm" onClick={handleBack}>
                  <ChevronLeft className="w-3 h-3 mr-1" />
                  上一步
                </Button>
              )}
              <Button size="sm" onClick={handleNext}>
                {currentStep === steps.length - 1 ? '完成' : '下一步'}
                {currentStep !== steps.length - 1 && (
                  <ChevronRight className="w-3 h-3 ml-1" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * 重新顯示教學的 Hook
 */
export function useResetModuleTour(moduleId: string) {
  return () => {
    localStorage.removeItem(`v4-module-tour-shown-${moduleId}`);
  };
}