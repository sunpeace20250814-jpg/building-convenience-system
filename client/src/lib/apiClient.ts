/**
 * V4 API Client — 前後端分離的核心
 *
 * 設計：
 * - 統一 fetch wrapper，所有 V4 API 呼叫都走這裡
 * - 自動 throw on non-2xx（避免每處都要檢查 status）
 * - 統一 JSON 處理
 * - 統一錯誤拋出（含 server message）
 *
 * 後端：Fastify server 在 vite proxy 自動轉 :3001
 * 開 dev：pnpm dev（vite 自動 proxy /api）
 * 開 prod build：vite preview（也已加 proxy）
 *
 * AI 友善：所有 store 改用這套 API 就完全擺脫 sql.js / IndexedDB
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  /** Query string params */
  params?: Record<string, string | number | boolean | undefined>;
  /** Body for POST/PUT */
  body?: unknown;
  /** 逾時（毫秒），預設 30s */
  timeout?: number;
}

function buildUrl(path: string, params?: RequestOptions['params']): string {
  let url = path.startsWith('/') ? path : `/${path}`;
  if (params) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) sp.set(k, String(v));
    }
    const qs = sp.toString();
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  }
  return url;
}

async function request<T = unknown>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, body, timeout = 30_000 } = options;
  const url = buildUrl(path, params);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const resp = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await resp.text();
    const data = text ? (JSON.parse(text) as unknown) : null;

    if (!resp.ok) {
      // server 統一錯誤格式：{ error, code?, message?, details? }
      const err = (data ?? {}) as { error?: string; code?: string; message?: string; details?: unknown };
      throw new ApiError(
        resp.status,
        err.code ?? `HTTP_${resp.status}`,
        err.message ?? err.error ?? `HTTP ${resp.status}`,
        err.details
      );
    }

    return data as T;
  } catch (e: any) {
    if (e instanceof ApiError) throw e;
    if (e?.name === 'AbortError') {
      throw new ApiError(0, 'TIMEOUT', `請求逾時（${timeout}ms）：${url}`);
    }
    throw new ApiError(0, 'NETWORK', `網路錯誤：${e?.message || '未知'}（${url}）`);
  } finally {
    clearTimeout(timer);
  }
}

export const apiClient = {
  get: <T = unknown>(path: string, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('GET', path, options),
  post: <T = unknown>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('POST', path, { ...options, body }),
  put: <T = unknown>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('PUT', path, { ...options, body }),
  delete: <T = unknown>(path: string, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('DELETE', path, options),
  patch: <T = unknown>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('PATCH', path, { ...options, body }),
};

/**
 * 健康檢查（判斷後端是否活著）
 */
export async function pingBackend(): Promise<boolean> {
  try {
    const r = await apiClient.get<{ ok: boolean }>('/api/health', { timeout: 3000 });
    return r.ok;
  } catch {
    return false;
  }
}