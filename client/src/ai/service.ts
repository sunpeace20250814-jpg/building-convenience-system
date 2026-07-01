/**
 * AI 服務層
 * 處理對話、查詢生成、SQL 安全檢查
 */

import { AIConfig } from './config';
import { monitor } from '@/monitoring/core';

export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
  // 附加資訊（AI 回應可能包含 SQL、結果等）
  sql?: string;
  results?: any[];
  error?: string;
  durationMs?: number;
}

const CONVERSATION_KEY = 'v4-ai-conversations';

export function loadConversations(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(CONVERSATION_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveConversations(messages: ChatMessage[]): void {
  // 只保留最近 50 條
  const trimmed = messages.slice(-50);
  localStorage.setItem(CONVERSATION_KEY, JSON.stringify(trimmed));
}

export function clearConversations(): void {
  localStorage.removeItem(CONVERSATION_KEY);
}

export interface AIRequestOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * 通用 LLM 呼叫
 * 支援 OpenAI Chat Completions API 格式
 */
export async function callLLM(
  config: AIConfig,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: AIRequestOptions = {}
): Promise<{ content: string; usage?: any; raw?: any }> {
  const start = performance.now();

  if (!config.apiKey) {
    throw new Error('尚未設定 API Key');
  }

  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const body = {
    model: options.model || config.model,
    messages,
    temperature: options.temperature ?? config.temperature,
    max_tokens: options.maxTokens ?? config.maxTokens,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // OpenAI 用 Authorization，Anthropic 用 x-api-key
  if (config.provider === 'anthropic') {
    headers['x-api-key'] = config.apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API 錯誤 ${response.status}: ${text}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  const duration = performance.now() - start;
  monitor.recordPerf('ai.llmCall', duration, true, { model: body.model, tokens: data.usage?.total_tokens });
  monitor.increment('ai.requests', 1, { model: body.model });
  if (data.usage?.total_tokens) {
    monitor.recordMetric('ai.tokens', data.usage.total_tokens, { model: body.model });
  }

  return { content, usage: data.usage, raw: data };
}
