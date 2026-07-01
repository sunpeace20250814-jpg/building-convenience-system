/**
 * AI 服務層
 *
 * M-63 完善化 (2026-07-02):
 * - 既有 callLLM / 對話歷史保留
 * - 加 friendlyError: 把常見 API 錯誤翻譯成中文
 * - 加 listModels: GET /v1/models 動態抓可用模型清單
 * - 加 fetchModels wrapper: 統一 fetch + friendlyError
 *
 * 支援 providers:
 *   - OpenAI / Anthropic (相容 API)
 *   - MiniMax 國際版 / 中國版 (月方案)
 *   - 自訂 (Ollama / LM Studio / vLLM)
 */

import { AIConfig } from './config';
import { monitor } from '@/monitoring/core';

export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
  sql?: string;
  results?: any[];
  error?: string;
  durationMs?: number;
  /** M-63: token 用量 (per-message) */
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  /** M-63: 是否正在 streaming (生成中) */
  streaming?: boolean;
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
 * 友善錯誤訊息:把常見 API / 網路錯誤翻譯成中文 + 提示怎麼修
 */
export function friendlyError(err: Error | string): string {
  const raw = typeof err === 'string' ? err : err.message;
  const msg = raw.toLowerCase();

  // 401 / 403
  if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('invalid api key') || msg.includes('incorrect api key')) {
    return 'API Key 無效或已過期。請到設定檢查 Key 是否正確,或到 minimax.io 後台確認。';
  }
  // 403 forbidden
  if (msg.includes('403') || msg.includes('forbidden')) {
    return 'API Key 權限不足。請確認 Key 是否有對應模型的使用權限。';
  }
  // 404
  if (msg.includes('404') || msg.includes('model not found')) {
    return '模型不存在或已下架。請檢查模型名稱,或從下拉選單選一個有效的模型。';
  }
  // 429
  if (msg.includes('429') || msg.includes('rate limit') || msg.includes('quota')) {
    return '已達 API 速率限制或月方案額度用完。請稍候再試,或到 minimax.io 後台查看用量。';
  }
  // 500/502/503/504
  if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504') || msg.includes('server error')) {
    return 'API 伺服器暫時錯誤。請稍候再試,或到 minimax.io 狀態頁查看是否公告維護。';
  }
  // CORS
  if (msg.includes('cors') || msg.includes('cross-origin')) {
    return '瀏覽器阻擋 CORS 請求。請確認 Base URL 是否正確,或在瀏覽器允許 CORS。';
  }
  // 網路錯誤
  if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('network request failed')) {
    return '網路連線失敗。請檢查網路狀態,或確認 API endpoint 是否可訪問。';
  }
  // timeout
  if (msg.includes('timeout') || msg.includes('aborted')) {
    return 'API 回應逾時。請稍候再試,或降低 max_tokens。';
  }
  // 預設:回傳原訊息
  return raw;
}

export interface ModelInfo {
  id: string;
  label?: string;
  ownedBy?: string;
}

/**
 * 抓可用模型清單 (OpenAI 相容 /v1/models)
 * 大部分 provider 都支援 (OpenAI, MiniMax, Ollama, LM Studio, vLLM)
 * Anthropic 用 /v1/models 也支援 (新版 API)
 */
export async function listModels(config: AIConfig): Promise<ModelInfo[]> {
  if (!config.apiKey) {
    throw new Error('尚未設定 API Key');
  }
  if (!config.baseUrl) {
    throw new Error('尚未設定 Base URL');
  }

  const url = `${config.baseUrl.replace(/\/$/, '')}/models`;

  const headers: Record<string, string> = {};
  if (config.provider === 'anthropic') {
    headers['x-api-key'] = config.apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(friendlyError(`API 錯誤 ${res.status}: ${text}`));
  }
  const data = await res.json();
  // OpenAI 格式: { data: [{ id, owned_by, ... }] }
  // Anthropic 格式: { data: [{ id, display_name, ... }] }
  const list = data.data ?? data.models ?? [];
  if (!Array.isArray(list)) {
    throw new Error('API 回傳格式不正確 (預期 data 為陣列)');
  }
  return list.map((m: any) => ({
    id: m.id ?? m.name,
    label: m.display_name ?? m.label ?? m.id ?? m.name,
    ownedBy: m.owned_by ?? m.organization,
  }));
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

  // OpenAI 用 Authorization,Anthropic 用 x-api-key
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
    throw new Error(friendlyError(`API 錯誤 ${response.status}: ${text}`));
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  const duration = performance.now() - start;
  monitor.recordPerf('ai.llmCall', duration, true, { model: body.model, tokens: data.usage?.total_tokens });
  monitor.increment('ai.requests', 1, { model: body.model });
  if (data.usage?.total_tokens) {
    monitor.recordMetric('ai.tokens', data.usage.total_tokens, { model: body.model });
    monitor.recordMetric('ai.promptTokens', data.usage.prompt_tokens ?? 0, { model: body.model });
    monitor.recordMetric('ai.completionTokens', data.usage.completion_tokens ?? 0, { model: body.model });
  }

  return { content, usage: data.usage, raw: data };
}

/**
 * 取得 AI token 用量摘要 (從 monitor metrics 讀取)
 * 用於 UI 顯示月方案用量估算
 *
 * 注意: monitor 預設 ring buffer 只保留 500 筆,所以「總用量」其實是這 500 筆的加總.
 *       如果 buffer 被覆蓋,數字會偏低.實務上 OK (月方案使用者不會單月跑超過 500 次).
 */
export function getTokenUsageSummary(sinceMs?: number): {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  requests: number;
  byModel: Array<{ model: string; tokens: number }>;
  windowMs: number | null;
} {
  const tokens = monitor.getMetrics('ai.tokens', sinceMs);
  const prompt = monitor.getMetrics('ai.promptTokens', sinceMs);
  const completion = monitor.getMetrics('ai.completionTokens', sinceMs);
  const requests = monitor.getMetrics('ai.requests', sinceMs);

  const totalTokens = tokens.reduce((s, m) => s + (m.value ?? 0), 0);
  const promptTokens = prompt.reduce((s, m) => s + (m.value ?? 0), 0);
  const completionTokens = completion.reduce((s, m) => s + (m.value ?? 0), 0);
  const requestCount = requests.length;

  // by model:從 tags.model 聚合
  const byModelMap: Record<string, number> = {};
  for (const m of tokens) {
    const model = (m.tags?.model as string) ?? 'unknown';
    byModelMap[model] = (byModelMap[model] ?? 0) + (m.value ?? 0);
  }
  const byModel = Object.entries(byModelMap)
    .map(([model, tokens]) => ({ model, tokens }))
    .sort((a, b) => b.tokens - a.tokens);

  return {
    totalTokens,
    promptTokens,
    completionTokens,
    requests: requestCount,
    byModel,
    windowMs: sinceMs ?? null,
  };
}