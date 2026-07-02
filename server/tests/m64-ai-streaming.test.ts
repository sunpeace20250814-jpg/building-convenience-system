/**
 * 守護測試 — M-64 (2026-07-02) AI streaming 回應
 *
 * 新增:
 * - callLLMStream (SSE streaming)
 * - AIConfig.enableStreaming 開關
 * - UI streaming cursor + 「生成中」徽章
 * - query.ts onSummaryDelta callback
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SERVICE = join(__dirname, '../../client/src/ai/service.ts');
const CONFIG = join(__dirname, '../../client/src/ai/config.ts');
const QUERY = join(__dirname, '../../client/src/ai/query.ts');
const INDEX = join(__dirname, '../../client/src/modules/ai/index.tsx');

describe('M-64 守護 — AI streaming 回應', () => {
  it('service.ts 有 callLLMStream', () => {
    const src = readFileSync(SERVICE, 'utf-8');
    expect(src).toMatch(/export async function callLLMStream/);
    expect(src).toMatch(/stream:\s*true/);
    expect(src).toMatch(/onDelta/);
    // SSE 解析
    expect(src).toMatch(/data:\s*\{|data: \\{/);
    expect(src).toMatch(/\[DONE\]/);
    expect(src).toMatch(/response\.body\.getReader/);
  });

  it('AIConfig 有 enableStreaming 欄位', () => {
    const src = readFileSync(CONFIG, 'utf-8');
    expect(src).toMatch(/enableStreaming/);
    expect(src).toMatch(/DEFAULT_CONFIG.*enableStreaming/s);
  });

  it('query.ts 用 callLLMStream 支援 streaming', () => {
    const src = readFileSync(QUERY, 'utf-8');
    expect(src).toMatch(/callLLMStream/);
    expect(src).toMatch(/onSummaryDelta/);
    expect(src).toMatch(/enableStreaming/);
  });

  it('UI 有 streaming 開關 checkbox', () => {
    const src = readFileSync(INDEX, 'utf-8');
    expect(src).toMatch(/enableStreaming/);
    expect(src).toMatch(/type="checkbox"/);
    expect(src).toMatch(/啟用 streaming 回應/);
  });

  it('UI message bubble 有 streaming 視覺效果', () => {
    const src = readFileSync(INDEX, 'utf-8');
    expect(src).toMatch(/message\.streaming/);
    expect(src).toMatch(/animate-pulse/);
    expect(src).toMatch(/生成中\.\.\./);
  });

  it('UI 有 streaming ai message 佔位邏輯', () => {
    const src = readFileSync(INDEX, 'utf-8');
    expect(src).toMatch(/streaming:\s*true/);
    expect(src).toMatch(/streamingMsg/);
  });
});