/**
 * AI 設定管理
 * - AES-GCM 加密 API Key
 * - 支援 OpenAI 相容 API（OpenAI, Azure, Anthropic, Ollama, 自架）
 * - 模型/Endpoint/Temperature 等可調
 */

import { deriveKey, encrypt, decrypt, isWebCryptoAvailable } from '@/security/crypto';

const STORAGE_KEY = 'v4-ai-config';

export type AIProvider = 'openai' | 'anthropic' | 'minimax' | 'minimax-cn' | 'custom';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;        // 記憶體中是明文
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
  enableQuery: boolean;
  enableAnalysis: boolean;
  enableSuggestions: boolean;
  maxRowsPerQuery: number;
  enableAuditLog: boolean;
}

export const DEFAULT_CONFIG: AIConfig = {
  provider: 'openai',
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  temperature: 0.3,
  maxTokens: 2000,
  systemPrompt: '',
  enableQuery: true,
  enableAnalysis: true,
  enableSuggestions: true,
  maxRowsPerQuery: 100,
  enableAuditLog: true,
};

// 在 sessionStorage 緩存 derive 出來的 CryptoKey（避免每次讀取都要密碼）
let sessionKey: CryptoKey | null = null;
let sessionSaltB64: string | null = null;
void sessionSaltB64;

// 預設密鑰：第一次使用自動產生，之後儲存在 localStorage（裝置綁定）
// 這不是完美的安全方案（密鑰在 localStorage 就能被讀），
// 但能擋掉最常見的「隨便打開 .db 檔就看到資料」的情境
const DEVICE_KEY_STORAGE = 'v4-device-key-salt';

async function getOrCreateDeviceKey(): Promise<CryptoKey> {
  if (sessionKey) return sessionKey;

  // 密鑰種子：使用 localStorage 裡的隨機鹽
  // 第一次用時產生
  let saltB64 = localStorage.getItem(DEVICE_KEY_STORAGE);
  if (!saltB64) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    saltB64 = btoa(String.fromCharCode(...salt));
    localStorage.setItem(DEVICE_KEY_STORAGE, saltB64);
  }

  // 從 device-bound 值派生 key（這裡用 localStorage 裡的「上次建立的時間戳」作為密碼源）
  // 配合隨機 salt → 每次不同的 CryptoKey
  // 真要強化：可以要求使用者設定 master password
  const passwordSource = `${navigator.userAgent}-${localStorage.getItem(DEVICE_KEY_STORAGE)}-v4-resident`;
  const saltBytes = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const { key, salt } = await deriveKey(passwordSource, saltBytes);
  sessionKey = key;
  sessionSaltB64 = btoa(String.fromCharCode(...salt));
  return key;
}

export async function loadConfig(): Promise<AIConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw);

    if (parsed.encryptedKey && isWebCryptoAvailable()) {
      try {
        const key = await getOrCreateDeviceKey();
        parsed.apiKey = await decrypt(parsed.encryptedKey, key);
      } catch (err) {
        console.warn('API key 解密失敗（金鑰可能變了）', err);
        parsed.apiKey = '';
      }
      delete parsed.encryptedKey;
    } else if (parsed.encryptedKey) {
      // 瀏覽器不支援 Web Crypto，無法解密
      console.warn('瀏覽器不支援 Web Crypto API，API key 無法解密');
      parsed.apiKey = '';
      delete parsed.encryptedKey;
    }
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(config: AIConfig): Promise<void> {
  const { apiKey, ...rest } = config;
  let encryptedKey = '';
  if (apiKey && isWebCryptoAvailable()) {
    try {
      const key = await getOrCreateDeviceKey();
      encryptedKey = await encrypt(apiKey, key);
    } catch (err) {
      console.error('API key 加密失敗', err);
      return;
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...rest, encryptedKey }));
}

export function clearConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * MiniMax 月方案可用的模型
 * 國際版：https://platform.MiniMax.io
 * 中國版：https://api.minimaxi.com
 */
export const MINIMAX_MODELS = [
  { id: 'MiniMax-Text-01', label: 'MiniMax-Text-01（旗艦文字，月方案）' },
  { id: 'MiniMax-VL-01', label: 'MiniMax-VL-01（視覺，月方案）' },
  { id: 'abab6.5s-chat', label: 'abab6.5s-chat（一般對話）' },
  { id: 'abab6.5-chat', label: 'abab6.5-chat（一般對話）' },
  { id: 'abab5.5-chat', label: 'abab5.5-chat（舊版對話）' },
];

export function getProviderPresets(): Array<{ provider: AIProvider; label: string; baseUrl: string; model: string; note?: string }> {
  return [
    { provider: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    { provider: 'anthropic', label: 'Anthropic (需相容 API)', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-5-sonnet-20241022' },
    // MiniMax 國際版（海外，月方案）
    { provider: 'minimax', label: 'MiniMax 國際版（月方案）', baseUrl: 'https://api.MiniMax.io/v1', model: 'MiniMax-Text-01', note: '海外用戶，platform.MiniMax.io' },
    // MiniMax 中國版
    { provider: 'minimax-cn', label: 'MiniMax 中國版', baseUrl: 'https://api.minimaxi.com/v1', model: 'MiniMax-Text-01', note: '中國大陸用戶' },
    { provider: 'custom', label: '自訂 (Ollama / LM Studio / vLLM)', baseUrl: 'http://localhost:11434/v1', model: 'llama3' },
  ];
}
