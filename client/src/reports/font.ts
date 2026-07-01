/**
 * 字型管理 - PDF 報表用
 *
 * build 階段用 scripts/build-font.ts 把 Noto Sans TC 繁體中文字型 subset
 * 到 ~166KB（915 個常用繁中字 + 數字 + 標點）
 * 載入時直接 fetch，jsPDF 透過 addFileToVFS + addFont 嵌入
 *
 * 對於罕用字，PDF 會顯示為豆腐字 (□)。這是 trade-off：
 * - 完整字型 ~16MB，會讓前端 bundle 爆炸
 * - 動態擴充需要後端支援（從遠端抓字型重新 subset），本地優先架構不適合
 * - 實務上 915 字 + 教育部 4808 罕用字加總能涵蓋 99% 內容
 */

let cachedFont: ArrayBuffer | null = null;

/** 載入預先 subset 的字型 */
export async function loadBaseFont(): Promise<ArrayBuffer> {
  if (cachedFont) return cachedFont;
  const base = (import.meta as any).env?.BASE_URL || '/';
  const url = `${base}fonts/noto-sans-tc-base.ttf`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error('無法載入字型檔（請確認 build 階段有產出 noto-sans-tc-base.ttf）');
  }
  cachedFont = await resp.arrayBuffer();
  return cachedFont;
}
