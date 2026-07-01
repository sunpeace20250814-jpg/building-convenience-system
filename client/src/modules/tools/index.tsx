/**
 * Tools Module - 工具箱
 *
 * UI 統一（與 schedule/facility-booking 一致）：
 *  - Header: 工具 icon + 標題 + 副標 + 全螢幕 / 在新視窗開啟按鈕
 *  - Tab strip: 書籤頁 strip，點切換工具（始終可見）
 *  - Iframe 區: 100% 填滿剩餘空間（calc(100vh - 130px)，與 schedule 一致）
 *
 * 各工具（LabelPrintTool / PdfTool）只負責 iframe 容器本身，不帶自己的 toolbar
 * — UI 統一由本檔案的 header 提供。
 *
 * 不要動 label-print.html / pdf-tools.html — iframe 內容由原 HTML 自行負責。
 */

import { useState } from 'react';
import { Wrench, ExternalLink, Printer, FileText, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { LabelPrintTool } from './LabelPrintTool';
import { PdfTool } from './PdfTool';

interface Tool {
  id: string;
  name: string;
  icon: React.ReactNode;
  Component: React.ComponentType;
}

const TOOLS: Tool[] = [
  {
    id: 'label-print',
    name: '標籤列印',
    icon: <Printer className="w-4 h-4" />,
    Component: LabelPrintTool,
  },
  {
    id: 'pdf-tools',
    name: 'PDF 工具箱',
    icon: <FileText className="w-4 h-4" />,
    Component: PdfTool,
  },
];

export function ToolsModule() {
  const [activeId, setActiveId] = useState<string>(TOOLS[0]?.id || '');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const activeTool = TOOLS.find((t) => t.id === activeId);

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-white' : 'h-full'}`}>
      {/* Header — 與 schedule 一致 */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b flex-shrink-0">
        <div className="flex items-center gap-3">
          <Wrench className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-semibold text-gray-900">工具箱</h1>
          <span className="text-xs text-gray-500">標籤列印 + PDF 工具</span>
        </div>
        <div className="flex items-center gap-2">
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
          <Button variant="ghost" size="sm" onClick={() => window.open(`${activeTool?.id}.html`, '_blank', 'noopener,noreferrer')}>
            <ExternalLink className="w-4 h-4 mr-1" />在新視窗開啟
          </Button>
        </div>
      </div>

      {/* Tab strip — 書籤頁始終可見 */}
      <div className="flex items-center gap-1 border-b border-gray-200 px-6 overflow-x-auto flex-shrink-0 bg-white">
        {TOOLS.map((tool) => (
          <ToolTab
            key={tool.id}
            tool={tool}
            active={tool.id === activeId}
            onClick={() => setActiveId(tool.id)}
          />
        ))}
      </div>

      {/* Active tool — iframe 100% 填滿剩餘空間 */}
      {activeTool && (
        <activeTool.Component key={activeTool.id} />
      )}
    </div>
  );
}

function ToolTab({ tool, active, onClick }: { tool: Tool; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
        active
          ? 'border-blue-600 text-blue-700 bg-blue-50/50'
          : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
      )}
    >
      {tool.icon}
      {tool.name}
    </button>
  );
}
