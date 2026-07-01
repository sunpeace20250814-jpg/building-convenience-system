/**
 * format 工具測試
 */

import { describe, it, expect } from 'vitest';
import { formatBytes, formatCurrency } from '@/utils/format';

describe('formatBytes', () => {
  it('0 → 0 B', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('KB 級', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
  });

  it('MB 級', () => {
    expect(formatBytes(1024 * 1024 * 5)).toBe('5.0 MB');
  });

  it('非整數 KB', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
  });
});

describe('formatCurrency', () => {
  it('TWD 預設', () => {
    expect(formatCurrency(1234)).toContain('1,234');
  });

  it('0', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0');
  });
});