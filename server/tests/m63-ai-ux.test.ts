/**
 * 守護測試 — M-63 完善化 AI 功能 (2026-07-02)
 *
 * - 友善錯誤訊息 (friendlyError) 中文化
 * - 動態模型抓取 (listModels)
 * - Token 用量摘要 (getTokenUsageSummary)
 * - UI 加了:重新生成 / 編輯重發 / 複製 / 匯出 / 抓模型清單
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SERVICE = join(__dirname, '../../client/src/ai/service.ts');
const INDEX = join(__dirname, '../../client/src/modules/ai/index.tsx');

describe('M-63 守護 — AI 功能完善化', () => {
  describe('service.ts 函式', () => {
    const src = readFileSync(SERVICE, 'utf-8');

    it('friendlyError 涵蓋 401/403/404/429/500/CORS/網路錯誤', () => {
      expect(src).toMatch(/export function friendlyError/);
      expect(src).toMatch(/API Key 無效/);
      expect(src).toMatch(/API Key 權限不足/);
      expect(src).toMatch(/模型不存在/);
      expect(src).toMatch(/API 速率限制|額度用完/);
      expect(src).toMatch(/API 伺服器暫時錯誤/);
      expect(src).toMatch(/CORS/);
      expect(src).toMatch(/網路連線失敗/);
      expect(src).toMatch(/API 回應逾時/);
    });

    it('listModels 從 /v1/models 抓清單', () => {
      expect(src).toMatch(/export async function listModels/);
      expect(src).toMatch(/\/models/);
      expect(src).toMatch(/Authorization.*Bearer|x-api-key/);
    });

    it('getTokenUsageSummary 從 monitor metrics 算', () => {
      expect(src).toMatch(/export function getTokenUsageSummary/);
      expect(src).toMatch(/monitor\.getMetrics/);
      expect(src).toMatch(/ai\.tokens/);
      expect(src).toMatch(/byModel/);
    });

    it('callLLM 仍正常 (保留既有功能)', () => {
      expect(src).toMatch(/export async function callLLM/);
      expect(src).toMatch(/chat\/completions/);
    });
  });

  describe('UI (modules/ai/index.tsx)', () => {
    const src = readFileSync(INDEX, 'utf-8');

    it('匯入新函式 (friendlyError / listModels / getTokenUsageSummary)', () => {
      expect(src).toMatch(/friendlyError/);
      expect(src).toMatch(/listModels/);
      expect(src).toMatch(/getTokenUsageSummary/);
    });

    it('UI 有「抓模型清單」按鈕', () => {
      expect(src).toMatch(/handleFetchModels/);
      expect(src).toMatch(/抓模型清單/);
    });

    it('UI 有「測試連線」按鈕 + 顯示 latency', () => {
      expect(src).toMatch(/handleTestConnection/);
      expect(src).toMatch(/latencyMs/);
    });

    it('UI 有「重新生成」「編輯重發」「複製」按鈕', () => {
      expect(src).toMatch(/handleRegenerate/);
      expect(src).toMatch(/handleStartEdit/);
      expect(src).toMatch(/handleSaveEdit/);
      expect(src).toMatch(/handleCopy/);
      // icons
      expect(src).toMatch(/RotateCw/);
      expect(src).toMatch(/Pencil/);
      expect(src).toMatch(/Copy/);
    });

    it('UI 有「Token 用量摘要」面板', () => {
      expect(src).toMatch(/tokenSummary/);
      expect(src).toMatch(/月方案用量估算/);
      expect(src).toMatch(/promptTokens/);
      expect(src).toMatch(/completionTokens/);
    });

    it('UI 有「匯出對話」按鈕', () => {
      expect(src).toMatch(/handleExportConversation/);
      expect(src).toMatch(/ai-conversation-/);
    });

    it('友善錯誤處理 catch 區塊用 friendlyError', () => {
      expect(src).toMatch(/friendlyError\(err\)/);
    });
  });

  describe('config.ts 既有 minimax 支援仍存在', () => {
    const CONFIG = join(__dirname, '../../client/src/ai/config.ts');
    const src = readFileSync(CONFIG, 'utf-8');
    it('minimax provider (國際版)', () => {
      expect(src).toMatch(/minimax/);
      expect(src).toMatch(/api\.MiniMax\.io/);
      expect(src).toMatch(/MiniMax-Text-01/);
    });
  });
});