/**
 * 守護測試 — M-51 修復
 *
 * 確保：
 * - day_colors 不在 ALL_TABLES
 * - day_colors 不在 repositories
 * - schema.ts 沒有 CREATE TABLE day_colors
 * - 客戶端 schema.ts 也沒有 day_colors
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SERVER_SCHEMA = join(__dirname, '../../server/src/db/schema.ts');
const SERVER_REPOSITORY = join(__dirname, '../../server/src/db/repository.ts');
const SERVER_INDEX = join(__dirname, '../../server/src/db/index.ts');
const CLIENT_SCHEMA = join(__dirname, '../../client/src/storage/schema.ts');

describe('M-51 守護 — day_colors 已從所有地方移除', () => {
  it('server/src/db/schema.ts 不再有 CREATE TABLE day_colors', () => {
    const source = readFileSync(SERVER_SCHEMA, 'utf-8');
    expect(source).not.toMatch(/CREATE TABLE\s+(IF NOT EXISTS\s+)?day_colors/i);
  });

  it('server/src/db/schema.ts ALL_TABLES 不含 day_colors', () => {
    const source = readFileSync(SERVER_SCHEMA, 'utf-8');
    // 找 ALL_TABLES 陣列範圍（以 ] as const 結束）
    const match = source.match(/ALL_TABLES[\s\S]*?\]\s+as\s+const/);
    expect(match).not.toBeNull();
    expect(match![0]).not.toMatch(/'day_colors'/);
  });

  it('server/src/db/repository.ts 不再有 day_colors 引用', () => {
    const source = readFileSync(SERVER_REPOSITORY, 'utf-8');
    expect(source).not.toMatch(/day_colors/);
  });

  it('server/src/db/index.ts 有 ensureDayColorsDropped migration', () => {
    const source = readFileSync(SERVER_INDEX, 'utf-8');
    expect(source).toMatch(/function ensureDayColorsDropped/);
    expect(source).toMatch(/DROP TABLE IF EXISTS day_colors/);
    expect(source).toMatch(/initDatabase[\s\S]*?ensureDayColorsDropped/);
  });

  it('client/src/storage/schema.ts 不含 day_colors (鏡像同步)', () => {
    const source = readFileSync(CLIENT_SCHEMA, 'utf-8');
    expect(source).not.toMatch(/day_colors/);
  });
});

describe('M-51 守護 — shared/ package 已刪除', () => {
  it('pnpm-workspace.yaml 不含 shared', () => {
    const path = join(__dirname, '../../pnpm-workspace.yaml');
    const source = readFileSync(path, 'utf-8');
    expect(source).not.toMatch(/^\s*-\s*'shared'/m);
  });

  it('root package.json build:server 不再 build shared', () => {
    const path = join(__dirname, '../../package.json');
    const source = readFileSync(path, 'utf-8');
    expect(source).not.toMatch(/@v4-resident\/shared/);
  });

  it('shared/ 目錄不存在', () => {
    const fs = require('fs') as typeof import('fs');
    expect(fs.existsSync(join(__dirname, '../../shared'))).toBe(false);
  });
});