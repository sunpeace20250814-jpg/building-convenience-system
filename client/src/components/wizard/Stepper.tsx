/**
 * Stepper 元件 — 精靈的進度條
 * 顯示步驟編號、標題、目前位置、已完成狀態
 */

import { Check } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';

interface StepperStep {
  id: string;
  title: string;
  optional?: boolean;
}

interface StepperProps {
  steps: StepperStep[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export function Stepper({ steps, currentStep, onStepClick }: StepperProps) {
  return (
    <nav aria-label="Progress" className="px-6 py-4 bg-gray-50 border-b">
      <ol className="flex items-center justify-between">
        {steps.map((step, idx) => {
          const isCompleted = idx < currentStep;
          const isCurrent = idx === currentStep;
          const isClickable = !!onStepClick && idx < currentStep;

          return (
            <li key={step.id} className="flex-1 flex items-center">
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && onStepClick(idx)}
                className={twMerge(clsx(
                  'flex items-center gap-2 group',
                  isClickable && 'cursor-pointer',
                  !isClickable && 'cursor-default'
                ))}
              >
                {/* Step indicator */}
                <span
                  className={twMerge(clsx(
                    'flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors',
                    isCompleted && 'bg-blue-600 text-white',
                    isCurrent && 'bg-blue-600 text-white ring-4 ring-blue-100',
                    !isCompleted && !isCurrent && 'bg-gray-200 text-gray-500'
                  ))}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </span>

                {/* Step title */}
                <span
                  className={twMerge(clsx(
                    'text-sm font-medium hidden sm:inline',
                    isCurrent && 'text-blue-700',
                    isCompleted && 'text-gray-700',
                    !isCompleted && !isCurrent && 'text-gray-400'
                  ))}
                >
                  {step.title}
                  {step.optional && (
                    <span className="ml-1 text-xs text-gray-400">(選填)</span>
                  )}
                </span>
              </button>

              {/* Connector line */}
              {idx < steps.length - 1 && (
                <div
                  className={twMerge(clsx(
                    'flex-1 h-0.5 mx-2 transition-colors',
                    idx < currentStep ? 'bg-blue-600' : 'bg-gray-200'
                  ))}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}