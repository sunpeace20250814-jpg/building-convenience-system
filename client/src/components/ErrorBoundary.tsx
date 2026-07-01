/**
 * Error Boundary 元件
 *
 * 為什麼需要：
 * - React 18+ 預設任何 render 階段錯誤會 unmount 整棵樹
 * - 使用者會看到空白頁面，不知道發生什麼事
 * - 加了 Error Boundary 可以顯示友善錯誤頁，保留 App 殼層
 *
 * 用法（包在最外層）：
 * ```tsx
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 * ```
 *
 * AI 友善設計：
 * - 顯示錯誤類型、訊息、堆疊（dev 模式）
 * - 提供「重試」、「回到首頁」、「複製錯誤」按鈕
 * - 把錯誤送到監控系統
 */

import React from 'react';
import { AlertTriangle, RefreshCw, Home, Copy, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { monitor } from '@/monitoring/core';

interface Props {
  children: React.ReactNode;
  /** 自訂 fallback UI（選填） */
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, copied: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    // 送到監控系統
    monitor.recordError(
      `React Error Boundary: ${error.message}`,
      'react.errorBoundary',
      'error',
      {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      }
    );
    // 也送到 console
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, copied: false });
  };

  copyError = async () => {
    const { error, errorInfo } = this.state;
    const text = [
      `Error: ${error?.message}`,
      `Stack: ${error?.stack}`,
      `Component Stack: ${errorInfo?.componentStack}`,
      `Time: ${new Date().toISOString()}`,
      `URL: ${window.location.href}`,
    ].join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      // fallback：選取文字
      window.prompt('複製以下錯誤訊息：', text);
    }
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-bold text-gray-900">發生錯誤</h1>
                <p className="text-sm text-gray-500 mt-1">
                  應用程式遇到意外狀況。你可以重試、回到首頁，或複製錯誤訊息回報給開發者。
                </p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-red-900">{this.state.error.name || 'Error'}</p>
              <p className="text-sm text-red-800 mt-1">{this.state.error.message}</p>
            </div>

            {process.env.NODE_ENV !== 'production' && this.state.error.stack && (
              <details className="mb-4">
                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                  顯示技術細節（開發模式）
                </summary>
                <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-40">
                  {this.state.error.stack}
                </pre>
              </details>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                onClick={this.reset}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
              >
                <RefreshCw className="w-4 h-4" />
                重試
              </button>
              <Link
                to="/"
                onClick={this.reset}
                className="flex items-center gap-1.5 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300"
              >
                <Home className="w-4 h-4" />
                回到首頁
              </Link>
              <button
                onClick={this.copyError}
                className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
              >
                {this.state.copied ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    已複製
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    複製錯誤
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}