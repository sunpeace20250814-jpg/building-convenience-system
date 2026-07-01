/**
 * 快速記帳語法解析器 - V1 重要 UX
 *
 * 支援格式：
 * - 支 500 餐飲      → 支出 500，類別自動匹配「餐飲」
 * - 收 1000 房租     → 收入 1000，類別自動匹配「房租」
 * - +500 領薪水      → 收入 500
 * - -120 午餐        → 支出 120
 * - 500 餐飲         → 支出 500
 *
 * 解析結果包含：type、amount、category（自動匹配）、note
 */

import { ExpenseCategory } from '@/types/expense';

export interface QuickParseResult {
  type: 'income' | 'expense';
  amount: number;
  category?: string;
  categoryId?: string;
  note: string;
}

const KEYWORD_MAP: Record<string, { type: 'income' | 'expense'; category: string }> = {
  // 中文動詞
  '支': { type: 'expense', category: '其他' },
  '支出': { type: 'expense', category: '其他' },
  '付': { type: 'expense', category: '其他' },
  '買': { type: 'expense', category: '其他' },
  '收': { type: 'income', category: '其他收入' },
  '收入': { type: 'income', category: '其他收入' },
  '入': { type: 'income', category: '其他收入' },
  '領': { type: 'income', category: '其他收入' },
  '賺': { type: 'income', category: '其他收入' },
  // 符號
  '+': { type: 'income', category: '其他收入' },
  '-': { type: 'expense', category: '其他' },
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  '水電': ['水電', '電費', '水費', '電'],
  '瓦斯': ['瓦斯', '氣'],
  '管理費': ['管理費', '管理'],
  '電話/網路': ['電話', '網路', 'wifi', 'WiFi', '上網', '網費'],
  '設備維修': ['維修', '修理', '修'],
  '清潔用品': ['清潔', '打掃'],
  '餐飲': ['餐飲', '吃', '餐', '飯', '午', '晚', '早', '宵夜', '便當', '飲料'],
  '交通': ['交通', '油', '停車', '車資', '計程車', '公車', '捷運'],
  '房租': ['房租', '租金'],
  '押金': ['押金'],
  '車位費': ['車位費', '車位'],
  '薪水': ['薪水', '薪資', '工資', '薪水'],
  '其他': ['其他'],
  '其他收入': ['其他收入'],
};

export function parseQuickInput(text: string, categories: ExpenseCategory[] = []): QuickParseResult | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // 格式 1: 動詞 + 金額 + 備註
  // e.g., 支 500 餐飲, 收 1000 房租, 支出500餐飲
  let match = trimmed.match(/^([+\-支收付買入領賺])(?:入|出)?\s*(\d+(?:\.\d+)?)\s*(.*)$/);
  if (match) {
    const verb = match[1];
    const amount = parseFloat(match[2]);
    const rest = match[3].trim();
    const meta = KEYWORD_MAP[verb] || KEYWORD_MAP[verb + (verb.length === 1 ? (rest ? '出' : '') : '')];

    let type: 'income' | 'expense';
    let category: string | undefined;
    let note = rest;

    if (meta) {
      type = meta.type;
      // 先試從 note 找類別
      category = matchCategory(rest) || meta.category;
      if (category === meta.category) {
        // note 不含類別關鍵字 → 整個 rest 都是備註
        note = rest;
      } else {
        // note 含類別關鍵字 → 移除後剩下的是備註
        note = removeCategoryFromNote(rest);
      }
    } else {
      type = verb === '+' || verb === '收' || verb === '入' || verb === '領' || verb === '賺' ? 'income' : 'expense';
      category = matchCategory(rest);
    }

    return {
      type,
      amount,
      category,
      categoryId: categories.find((c) => c.name === category && c.type === type)?.id,
      note: note || '',
    };
  }

  // 格式 2: 純金額 + 備註 (沒動詞，預設支出)
  // e.g., 500 餐飲
  match = trimmed.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
  if (match) {
    const amount = parseFloat(match[1]);
    const rest = match[2].trim();
    const category = matchCategory(rest);
    const note = category ? removeCategoryFromNote(rest) : rest;
    return {
      type: 'expense',
      amount,
      category: category || '其他',
      categoryId: categories.find((c) => c.name === (category || '其他') && c.type === 'expense')?.id,
      note,
    };
  }

  return null;
}

function matchCategory(text: string): string | undefined {
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) return category;
    }
  }
  return undefined;
}

function removeCategoryFromNote(text: string): string {
  let result = text;
  for (const keywords of Object.values(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      result = result.replace(keyword, '');
    }
  }
  return result.trim();
}

/** 試解析並回傳錯誤或 null（無法解析） */
export function tryParseOrError(text: string, categories: ExpenseCategory[] = []): QuickParseResult | { error: string } | null {
  const result = parseQuickInput(text, categories);
  if (!result) return null;
  if (isNaN(result.amount) || result.amount <= 0) {
    return { error: '金額必須是正數' };
  }
  return result;
}