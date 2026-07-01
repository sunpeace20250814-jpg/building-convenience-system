/**
 * 守護測試 — M-62 修復 (2026-07-01)
 *
 * AI 自然語言查詢從 client-side queryAll → server-side fetch
 * - server POST /api/ai/safe-query 完整驗證 (FORBIDDEN + ALLOWED_TABLES)
 * - client executeSafeQuery 改成 async
 * - ai/query.ts 用 await executeSafeQuery
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SERVER_ROUTES = join(__dirname, '../src/routes/ai.ts');
const SERVER_INDEX = join(__dirname, '../src/index.ts');
const CLIENT_EXECUTOR = join(__dirname, '../../client/src/ai/sql-executor.ts');
const CLIENT_QUERY = join(__dirname, '../../client/src/ai/query.ts');

describe('M-62 守護 — AI safe-query server-side migration', () => {
  it('server/src/routes/ai.ts 存在,提供 safe-query endpoint', () => {
    const src = readFileSync(SERVER_ROUTES, 'utf-8');
    expect(src.length).toBeGreaterThan(0);
    expect(src).toMatch(/fastify\.post[<(]/);
    expect(src).toMatch(/['"]\/ai\/safe-query['"]/);
    expect(src).toMatch(/['"]\/ai\/validate-sql['"]/);
  });

  it('server route 完整驗證 (FORBIDDEN + ALLOWED_TABLES + LIMIT)', () => {
    const src = readFileSync(SERVER_ROUTES, 'utf-8');
    expect(src).toMatch(/FORBIDDEN_KEYWORDS/);
    expect(src).toMatch(/ALLOWED_TABLES/);
    expect(src).toMatch(/MAX_ROWS_HARD_LIMIT/);
    expect(src).toMatch(/只允許 SELECT 或 WITH 查詢/);
    expect(src).toMatch(/不允許多語句/);
  });

  it('server route 用 db.prepare(...).all() 執行 (better-sqlite3)', () => {
    const src = readFileSync(SERVER_ROUTES, 'utf-8');
    expect(src).toMatch(/db\.prepare\(/);
    expect(src).toMatch(/\.all\(\)/);
  });

  it('server/index.ts 註冊 aiRoutes', () => {
    const src = readFileSync(SERVER_INDEX, 'utf-8');
    expect(src).toMatch(/import.*aiRoutes.*routes\/ai\.js/);
    expect(src).toMatch(/fastify\.register\(aiRoutes\)/);
  });

  it('client sql-executor.ts 不再用 storage/database', () => {
    const src = readFileSync(CLIENT_EXECUTOR, 'utf-8');
    expect(src).not.toMatch(/from '@\/storage\/database'/);
    expect(src).toMatch(/from '@\/lib\/apiClient'/);
    // executeSafeQuery 改成 async + 用 fetch
    const match = src.match(/export async function executeSafeQuery[\s\S]*?\n\}/);
    expect(match).toBeTruthy();
    expect(match![0]).toMatch(/apiClient\.post/);
    expect(match![0]).toMatch(/await apiClient\.post/);
  });

  it('client ai/query.ts 用 await executeSafeQuery (async)', () => {
    const src = readFileSync(CLIENT_QUERY, 'utf-8');
    expect(src).toMatch(/await executeSafeQuery/);
  });
});