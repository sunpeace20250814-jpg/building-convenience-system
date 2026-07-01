/**
 * Wizard 通用精靈框架
 * 管理步驟切換、資料累積、上下一步、完成、跳過
 */

import { ReactNode, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Stepper } from './Stepper';

export interface WizardStep<TData = Record<string, unknown>> {
  id: string;
  title: string;
  description?: string;
  component: ReactNode;
  /** 此步是否為選填（選填步驟可在 footer 略過） */
  optional?: boolean;
  /** 此步是否有效（無效時不能到下一步） */
  validate?: (data: TData) => boolean | string;
}

interface WizardProps<TData = Record<string, unknown>> {
  steps: WizardStep<TData>[];
  /** 精靈標題 */
  title?: string;
  /** 副標題 */
  subtitle?: string;
  /** 完成的回呼（含所有步驟累積的資料） */
  onComplete: (data: TData) => void | Promise<void>;
  /** 跳過的回呼（若 allowSkip = true） */
  onSkip?: () => void;
  /** 是否允許整個精靈被跳過 */
  allowSkip?: boolean;
  /** 初始資料 */
  initialData?: TData;
  /** 完成按鈕文字 */
  completeLabel?: string;
  /** 下一步按鈕文字 */
  nextLabel?: string;
}

export function Wizard<TData extends Record<string, unknown> = Record<string, unknown>>({
  steps,
  title,
  subtitle,
  onComplete,
  onSkip,
  allowSkip = false,
  initialData = {} as TData,
  completeLabel = '完成',
  nextLabel = '下一步',
}: WizardProps<TData>) {
  const [currentStep, setCurrentStep] = useState(0);
  const [data] = useState<TData>(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;
  const currentStepConfig = steps[currentStep];

  const handleNext = useCallback(() => {
    setError(null);

    if (currentStepConfig.validate) {
      const result = currentStepConfig.validate(data);
      if (result === false) {
        setError('請完成此步驟的必要欄位');
        return;
      }
      if (typeof result === 'string') {
        setError(result);
        return;
      }
    }

    if (isLastStep) {
      setIsSubmitting(true);
      Promise.resolve(onComplete(data))
        .catch((err) => {
          setError(err?.message || '發生未知錯誤');
        })
        .finally(() => setIsSubmitting(false));
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  }, [currentStep, currentStepConfig, data, isLastStep, onComplete]);

  const handleBack = useCallback(() => {
    if (!isFirstStep) {
      setError(null);
      setCurrentStep((prev) => prev - 1);
    }
  }, [isFirstStep]);

  const handleSkipStep = useCallback(() => {
    if (!isLastStep) {
      setError(null);
      setCurrentStep((prev) => prev + 1);
    }
  }, [isLastStep]);

  const handleSkipAll = useCallback(() => {
    onSkip?.();
  }, [onSkip]);

  const stepperSteps = steps.map((s) => ({
    id: s.id,
    title: s.title,
    optional: s.optional,
  }));

  return (
    <div className="fixed inset-0 z-40 bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">{title || '設定精靈'}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
      </header>

      {/* Stepper */}
      <div className="max-w-3xl w-full mx-auto bg-white shadow-sm flex-1 flex flex-col">
        <Stepper
          steps={stepperSteps}
          currentStep={currentStep}
          onStepClick={(step) => step < currentStep && setCurrentStep(step)}
        />

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-8">
          <div className="max-w-2xl mx-auto">
            {currentStepConfig.description && (
              <p className="text-gray-600 mb-6">{currentStepConfig.description}</p>
            )}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}
            {currentStepConfig.component}
          </div>
        </div>

        {/* Footer */}
        <footer className="px-6 py-4 bg-gray-50 border-t">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div>
              {allowSkip && onSkip && !isLastStep && (
                <Button variant="ghost" onClick={handleSkipAll}>
                  略過全部
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isFirstStep && (
                <Button variant="secondary" onClick={handleBack} disabled={isSubmitting}>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  上一步
                </Button>
              )}
              {currentStepConfig.optional && !isLastStep && (
                <Button variant="ghost" onClick={handleSkipStep}>
                  略過此步
                </Button>
              )}
              <Button onClick={handleNext} disabled={isSubmitting}>
                {isSubmitting ? '處理中...' : isLastStep ? completeLabel : nextLabel}
                {!isLastStep && <ChevronRight className="w-4 h-4 ml-1" />}
              </Button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}