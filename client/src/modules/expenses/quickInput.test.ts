/**
 * 快速記帳語法解析器測試
 */

import { describe, it, expect } from 'vitest';
import { parseQuickInput } from '@/modules/expenses/quickInput';
import type { ExpenseCategory } from '@/types/expense';

const mockCategories: ExpenseCategory[] = [
  { id: '1', name: '餐飲', type: 'expense' },
  { id: '2', name: '房租', type: 'income' },
  { id: '3', name: '水電', type: 'expense' },
];

describe('parseQuickInput', () => {
  it('解析「支 500 餐飲」為支出 500 餐飲', () => {
    const r = parseQuickInput('支 500 餐飲', mockCategories);
    expect(r).toEqual({
      type: 'expense',
      amount: 500,
      category: '餐飲',
      categoryId: '1',
      note: '',
    });
  });

  it('解析「收 1000 房租」為收入 1000 房租', () => {
    const r = parseQuickInput('收 1000 房租', mockCategories);
    expect(r).toEqual({
      type: 'income',
      amount: 1000,
      category: '房租',
      categoryId: '2',
      note: '',
    });
  });

  it('解析「+500 領薪水」為收入', () => {
    const r = parseQuickInput('+500 領薪水', mockCategories);
    expect(r?.type).toBe('income');
    expect(r?.amount).toBe(500);
  });

  it('解析「-120 午餐」為支出', () => {
    const r = parseQuickInput('-120 午餐', mockCategories);
    expect(r?.type).toBe('expense');
    expect(r?.amount).toBe(120);
    expect(r?.category).toBe('餐飲');
  });

  it('純金額 + 備註預設支出', () => {
    const r = parseQuickInput('500 餐飲', mockCategories);
    expect(r?.type).toBe('expense');
    expect(r?.amount).toBe(500);
  });

  it('無法解析回傳 null', () => {
    expect(parseQuickInput('隨便亂打', mockCategories)).toBeNull();
  });

  it('關鍵字歸類到正確類別', () => {
    expect(parseQuickInput('支 200 電費', mockCategories)?.category).toBe('水電');
    expect(parseQuickInput('支 50 便當', mockCategories)?.category).toBe('餐飲');
  });
});