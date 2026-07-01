/**
 * CSV 工具測試
 */

import { describe, it, expect } from 'vitest';
import {
  parseResidentsCSV,
  parseMembersCSV,
  toCSV,
  exportResidentsCSV,
} from '@/modules/residents/csv';

describe('parseResidentsCSV', () => {
  it('解析 V1 格式 CSV', () => {
    const csv = [
      '房號,姓名,電話,Email,停車位,人數,狀態,備註',
      '1-01-01,王小明,0912345678,,A-001,4,正常,備註1',
      '1-01-02,李大華,0923456789,test@test.com,,3,出租中,',
    ].join('\n');

    const rows = parseResidentsCSV(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      property: '1-01-01',
      name: '王小明',
      phone: '0912345678',
      email: '',
      parkingId: 'A-001',
      memberCount: '4',
      status: '正常',
      notes: '備註1',
    });
  });

  it('空行過濾', () => {
    const csv = '房號,姓名,電話\n\n1-01-01,王小明,0912345678\n\n';
    const rows = parseResidentsCSV(csv);
    expect(rows).toHaveLength(1);
  });

  it('無資料列回傳空陣列', () => {
    expect(parseResidentsCSV('房號,姓名,電話')).toEqual([]);
  });
});

describe('parseMembersCSV', () => {
  it('解析 V1 格式 CSV', () => {
    const csv = [
      '房號,成員姓名,關係,電話,身份證,生日,備註',
      '1-01-01,王大明,屋主,0911111111,A123,1990-01-01,',
    ].join('\n');

    const rows = parseMembersCSV(csv);
    expect(rows[0].name).toBe('王大明');
    expect(rows[0].relation).toBe('屋主');
    expect(rows[0].idNumber).toBe('A123');
  });
});

describe('toCSV', () => {
  it('基本輸出', () => {
    const csv = toCSV([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(csv).toBe('a,b\n1,2');
  });

  it('含逗號自動加引號', () => {
    const csv = toCSV([['hello, world']]);
    expect(csv).toBe('"hello, world"');
  });

  it('含引號跳脫', () => {
    const csv = toCSV([['He said "hi"']]);
    expect(csv).toBe('"He said ""hi"""');
  });
});

describe('exportResidentsCSV', () => {
  it('匯出標準格式', () => {
    const csv = exportResidentsCSV([
      { property: '1-01-01', name: '王小明', phone: '0912', status: '正常', memberCount: 4 },
    ]);
    expect(csv).toContain('房號,姓名');
    expect(csv).toContain('1-01-01,王小明');
  });
});