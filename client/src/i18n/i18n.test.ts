/**
 * i18n 多語系一致性測試
 *
 * 驗證：
 * 1. 兩語 locale（zh-TW / en）皆可載入
 * 2. 必做模組的 key 在兩語都存在
 * 3. 兩語的扁平化 key set 完全一致
 */

import { describe, it, expect } from 'vitest';
import zhTW from './locales/zh-TW.json';
import en from './locales/en.json';

const REQUIRED_NAMESPACES = ['common', 'sidebar', 'home-tabs', 'residents', 'expenses', 'schedule', 'backup', 'settings'];

/**
 * 把巢狀物件攤平成 dot-notation key
 * 例：{ a: { b: 'x' } } => ['a.b']
 */
function flatten(obj: any, prefix = ''): string[] {
  const keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    const path = prefix ? `${prefix}.${key}` : prefix ? key : key;
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      keys.push(...flatten(val, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

describe('i18n locale files', () => {
  it('兩語 locale 都能載入（不是空物件）', () => {
    expect(Object.keys(zhTW).length).toBeGreaterThan(0);
    expect(Object.keys(en).length).toBeGreaterThan(0);
  });

  it('必做模組 namespace 都存在於兩語', () => {
    for (const ns of REQUIRED_NAMESPACES) {
      expect(zhTW).toHaveProperty(ns);
      expect(en).toHaveProperty(ns);
    }
  });

  it('每個必做模組至少有一個翻譯 key', () => {
    for (const ns of REQUIRED_NAMESPACES) {
      const keys = flatten(zhTW[ns as keyof typeof zhTW]);
      expect(keys.length, `namespace '${ns}' in zh-TW should have keys`).toBeGreaterThan(0);
    }
  });
});

describe('i18n key parity', () => {
  const zhTWKeys = new Set(flatten(zhTW));
  const enKeys = new Set(flatten(en));

  it('zh-TW keys 數量應 > 100（覆蓋率檢查）', () => {
    expect(zhTWKeys.size).toBeGreaterThan(100);
  });

  it('兩語扁平 key 集合完全一致（無遺漏）', () => {
    const missingInEN = [...zhTWKeys].filter((k) => !enKeys.has(k));
    const extraInEN = [...enKeys].filter((k) => !zhTWKeys.has(k));

    const fmt = (arr: string[]) => arr.length ? `\n  - ${arr.join('\n  - ')}` : '（無）';
    expect(missingInEN, `en 缺這些 keys:${fmt(missingInEN)}`).toEqual([]);
    expect(extraInEN, `en 多這些 keys:${fmt(extraInEN)}`).toEqual([]);
  });

  it('沒有空字串值（防呆）', () => {
    const findEmpty = (obj: any, prefix = ''): string[] => {
      const bad: string[] = [];
      for (const key of Object.keys(obj)) {
        const val = obj[key];
        const path = prefix ? `${prefix}.${key}` : key;
        if (typeof val === 'string' && val.trim() === '') {
          bad.push(path);
        } else if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
          bad.push(...findEmpty(val, path));
        }
      }
      return bad;
    };
    for (const [name, obj] of [['zh-TW', zhTW], ['en', en]] as const) {
      const empty = findEmpty(obj);
      expect(empty, `${name} has empty string values: ${empty.join(', ')}`).toEqual([]);
    }
  });
});

describe('i18n key content sanity', () => {
  it('sidebar 含核心 items', () => {
    const expectedItems = [
      'residents', 'expenses', 'schedule', 'calendar', 'facilityBooking',
      'announcementLog', 'tutorials', 'tools', 'backup', 'modules',
      'settings', 'reports', 'accounts', 'chartOfAccounts', 'journal',
      'financialReports', 'accountingPeriods', 'invoices', 'bankReconcile',
      'receivables', 'payables', 'auditLog', 'appLog', 'monitoring', 'ai',
    ];
    for (const item of expectedItems) {
      expect(zhTW.sidebar.items).toHaveProperty(item);
      expect(en.sidebar.items).toHaveProperty(item);
    }
  });

  it('common 含核心按鈕 keys', () => {
    const expected = ['save', 'cancel', 'edit', 'delete', 'add', 'close'];
    for (const key of expected) {
      expect(zhTW.common).toHaveProperty(key);
      expect(en.common).toHaveProperty(key);
    }
  });

  it('zh-TW、en 含相同數量的 i18n key', () => {
    expect(flatten(zhTW).length).toBe(flatten(en).length);
  });
});
