/**
 * 快速輸入元件 - V1 重要 UX
 * 輸入「支 500 餐飲」→ 即時解析 → 一鍵送出
 */

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { parseQuickInput } from './quickInput';
import { Zap, Send } from 'lucide-react';

interface Props {
  categories: any[];
  onSubmit: (data: { type: 'income' | 'expense'; amount: number; category?: string; categoryId?: string; notes: string; date: string }) => void;
}

export function QuickExpenseInput({ categories, onSubmit }: Props) {
  const [text, setText] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const [hintColor, setHintColor] = useState('text-gray-500');

  const handleChange = (value: string) => {
    setText(value);
    if (!value.trim()) {
      setHint(null);
      return;
    }
    const parsed = parseQuickInput(value, categories);
    if (!parsed) {
      setHint('格式：支/收 500 備註，或 +500/-500');
      setHintColor('text-gray-400');
      return;
    }
    if (isNaN(parsed.amount) || parsed.amount <= 0) {
      setHint('金額必須是正數');
      setHintColor('text-red-500');
      return;
    }
    setHint(`✓ ${parsed.type === 'income' ? '收入' : '支出'} ${parsed.amount}${parsed.category ? ` [${parsed.category}]` : ''}${parsed.note ? ` - ${parsed.note}` : ''}`);
    setHintColor('text-green-600');
  };

  const handleSubmit = () => {
    const parsed = parseQuickInput(text, categories);
    if (!parsed) return;
    if (isNaN(parsed.amount) || parsed.amount <= 0) return;
    onSubmit({
      type: parsed.type,
      amount: parsed.amount,
      category: parsed.category,
      categoryId: parsed.categoryId,
      notes: parsed.note,
      date: new Date().toISOString().split('T')[0],
    });
    setText('');
    setHint(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Card className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-4 h-4 text-blue-600" />
        <h3 className="text-sm font-medium text-gray-900">快速記帳</h3>
        <span className="text-xs text-gray-500 ml-2">
          輸入「支 500 餐飲」或「收 1000 房租」按 Enter
        </span>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="例如：支 500 餐飲 / 收 1000 房租 / +500 領薪水"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        <Button onClick={handleSubmit} disabled={!text.trim()}>
          <Send className="w-4 h-4 mr-1" />送出
        </Button>
      </div>
      {hint && (
        <p className={`text-xs mt-2 ${hintColor}`}>{hint}</p>
      )}
    </Card>
  );
}