/**
 * Label Print Tool - iframe 嵌入 label-print.html
 *
 * 容器統一（跟 schedule 一致）：
 *  - 不帶自己的 toolbar / 全螢幕 / 在新視窗開啟按鈕 — 統一由 tools/index.tsx header 提供
 *  - iframe 高度 calc(100vh - 130px)，跟 schedule 一樣
 *  - 不要改 label-print.html（保留原 UI / CSS / 功能）
 */

export function LabelPrintTool() {
  return (
    <iframe
      src="label-print.html"
      title="標籤列印工具"
      className="w-full h-[calc(100vh-130px)] border-0 bg-white"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
    />
  );
}
