/**
 * Pdf Tool - iframe 嵌入 pdf-tools.html（PDF 工具箱原始 HTML 版）
 *
 * 容器統一（跟 schedule 一致）：
 *  - 不帶自己的 toolbar / 全螢幕 / 在新視窗開啟按鈕 — 統一由 tools/index.tsx header 提供
 *  - iframe 高度 calc(100vh - 130px)，跟 schedule 一樣
 *  - 不要改 pdf-tools.html（保留原 UI / CSS / 功能）
 *
 * 為什麼用 iframe 而不是 React 重寫：
 *  pdf-tools.html 已經實作完整功能（合併 / 分割 / 旋轉 / 浮水印 / 壓縮 / 圖片工具 / 轉檔）
 *  用 iframe 嵌入即可保留所有原始功能與 UI。
 */

export function PdfTool() {
  return (
    <iframe
      src="pdf-tools.html"
      title="PDF 工具箱"
      className="w-full h-[calc(100vh-130px)] border-0 bg-white"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    />
  );
}
