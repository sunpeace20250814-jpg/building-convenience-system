/**
 * AI Config 加密測試
 * 改用 AES-GCM 後變 async
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { loadConfig, saveConfig, clearConfig } from '@/ai/config';

describe('AI Config', () => {
  beforeEach(() => {
    clearConfig();
  });

  it('saveConfig 不會明文儲存 API Key', async () => {
    await saveConfig({
      apiKey: 'sk-supersecret-key',
      provider: 'openai',
      baseUrl: '',
      model: '',
      temperature: 0.3,
      maxTokens: 1000,
      enableQuery: true,
      enableAnalysis: true,
      enableSuggestions: true,
      maxRowsPerQuery: 100,
      enableAuditLog: true,
    });
    const raw = localStorage.getItem('v4-ai-config');
    expect(raw).not.toContain('sk-supersecret');
  });

  it('loadConfig 解密回 API Key', async () => {
    await saveConfig({
      apiKey: 'sk-test-restore',
      provider: 'openai',
      baseUrl: 'b',
      model: 'm',
      temperature: 0.3,
      maxTokens: 1000,
      enableQuery: true,
      enableAnalysis: true,
      enableSuggestions: true,
      maxRowsPerQuery: 100,
      enableAuditLog: true,
    });
    const loaded = await loadConfig();
    expect(loaded.apiKey).toBe('sk-test-restore');
  });

  it('loadConfig 在沒有資料時回傳預設值', async () => {
    const loaded = await loadConfig();
    expect(loaded.provider).toBe('openai');
    expect(loaded.apiKey).toBe('');
  });
});
