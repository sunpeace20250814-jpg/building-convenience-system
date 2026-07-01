/**
 * 錯誤恢復對話框
 * 統一風格的錯誤提示 + 多個修復選項
 */

import { AlertCircle, X, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export interface RecoveryOption {
  label: string;
  description?: string;
  onClick: () => void | Promise<void>;
  variant?: 'primary' | 'secondary' | 'danger';
  autoClose?: boolean;
}

interface ErrorRecoveryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** 錯誤標題 */
  title: string;
  /** 錯誤描述 */
  description?: string;
  /** 錯誤詳細（技術性，可摺疊） */
  technicalDetails?: string;
  /** 嚴重程度 */
  severity?: 'error' | 'warning' | 'info';
  /** 修復選項 */
  recoveryOptions?: RecoveryOption[];
  /** 略過選項（不做任何事） */
  allowDismiss?: boolean;
}

export function ErrorRecoveryDialog({
  isOpen,
  onClose,
  title,
  description,
  technicalDetails,
  severity = 'error',
  recoveryOptions = [],
  allowDismiss = true,
}: ErrorRecoveryDialogProps) {
  if (!isOpen) return null;

  const Icon = severity === 'error' ? AlertCircle : severity === 'warning' ? AlertTriangle : CheckCircle;
  const styles = {
    error: 'bg-red-100 text-red-600',
    warning: 'bg-yellow-100 text-yellow-600',
    info: 'bg-blue-100 text-blue-600',
  };

  const handleOptionClick = async (option: RecoveryOption) => {
    try {
      await option.onClick();
      if (option.autoClose !== false) {
        onClose();
      }
    } catch (err) {
      // 讓外層處理
      console.error('Recovery option failed:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={allowDismiss ? onClose : undefined} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-lg bg-white rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-start gap-3 px-6 py-4 border-b">
            <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', styles[severity])}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">{title}</h3>
              {description && (
                <p className="text-sm text-gray-600 mt-1">{description}</p>
              )}
            </div>
            {allowDismiss && (
              <button
                type="button"
                onClick={onClose}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Technical details (可摺疊) */}
          {technicalDetails && (
            <details className="px-6 py-3 bg-gray-50 border-b">
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                顯示技術細節
              </summary>
              <pre className="mt-2 text-xs text-gray-600 whitespace-pre-wrap break-all font-mono">
                {technicalDetails}
              </pre>
            </details>
          )}

          {/* Recovery options */}
          {recoveryOptions.length > 0 && (
            <div className="px-6 py-4 space-y-2">
              {recoveryOptions.map((option, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleOptionClick(option)}
                  className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <span className={cn(
                      'text-sm font-medium',
                      option.variant === 'danger' ? 'text-red-600' :
                      option.variant === 'secondary' ? 'text-gray-700' :
                      'text-blue-600'
                    )}>
                      {option.label}
                    </span>
                  </div>
                  {option.description && (
                    <div className="text-xs text-gray-500 mt-1">{option.description}</div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
            {allowDismiss ? (
              <Button variant="secondary" onClick={onClose}>
                關閉
              </Button>
            ) : (
              <span className="text-xs text-gray-500">
                請選擇上方任一處理方式
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * useErrorRecovery hook — 簡化錯誤恢復對話框使用
 */
import { useState, useCallback } from 'react';

export function useErrorRecovery() {
  const [state, setState] = useState<{
    isOpen: boolean;
    title: string;
    description?: string;
    technicalDetails?: string;
    severity?: 'error' | 'warning' | 'info';
    recoveryOptions?: RecoveryOption[];
  }>({
    isOpen: false,
    title: '',
  });

  const showError = useCallback((config: {
    title: string;
    description?: string;
    technicalDetails?: string;
    severity?: 'error' | 'warning' | 'info';
    recoveryOptions?: RecoveryOption[];
  }) => {
    setState({ ...config, isOpen: true });
  }, []);

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const dialogProps = {
    ...state,
    onClose: close,
  };

  return { dialogProps, showError, close };
}