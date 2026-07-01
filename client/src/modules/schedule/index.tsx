/**
 * Schedule Module - iframe 嵌入 schedule.html
 * 班表 OS 外部獨立套件 整合進 V4
 *
 * V4 統一假期：
 *   - 啟動時把 V4 holidayStore 推到 iframe (postMessage)
 *   - 每當 holidays 變動自動重推
 *   - iframe 內 schedule.html 接收後套到月曆/班表
 */

import { useEffect, useRef, useState } from 'react';
import { Calendar, ExternalLink, Maximize2, Minimize2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useHolidayStore } from '@/stores';

export function ScheduleModule() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { holidays } = useHolidayStore();

  // 推 holidays 到 iframe（V4 統一來源）
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;
    iframe.contentWindow.postMessage(
      { type: 'v4-holidays', holidays },
      window.location.origin
    );
  }, [holidays]);

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-white' : 'h-full'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-semibold text-gray-900">班表管理</h1>
          <span className="text-xs text-gray-500">嵌入 schedule.html 班表 · V4 統一假期</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const iframe = iframeRef.current;
              if (iframe?.contentWindow) {
                iframe.contentWindow.postMessage(
                  { type: 'v4-holidays', holidays },
                  window.location.origin
                );
              }
            }}
            title="重新推送假期設定到 iframe"
          >
            <RefreshCw className="w-4 h-4 mr-1" />同步假期
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setIsFullscreen(!isFullscreen)}>
            {isFullscreen ? (
              <>
                <Minimize2 className="w-4 h-4 mr-1" />退出全螢幕
              </>
            ) : (
              <>
                <Maximize2 className="w-4 h-4 mr-1" />全螢幕
              </>
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => window.open('schedule.html', '_blank')}>
            <ExternalLink className="w-4 h-4 mr-1" />在新分頁開啟
          </Button>
        </div>
      </div>

      {/* iframe */}
      <iframe
        ref={iframeRef}
        src="schedule.html"
        title="班表管理"
        className={`w-full ${isFullscreen ? 'h-[calc(100vh-60px)]' : 'h-[calc(100vh-130px)]'}`}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      />
    </div>
  );
}