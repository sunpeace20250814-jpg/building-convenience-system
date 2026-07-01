/**
 * HTTP 客戶端
 * 透過 Fastify server 的 REST API 進行所有操作
 */

export interface HttpClientConfig {
  baseUrl: string;
  dryRun?: boolean;
  timeout?: number;
}

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
}

export class HttpClient {
  private baseUrl: string;
  private dryRun: boolean;
  private timeout: number;

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.dryRun = !!config.dryRun;
    this.timeout = config.timeout ?? 30000;
  }

  async get<T = any>(path: string, opts: RequestOptions = {}): Promise<T> {
    return this.request<T>('GET', path, undefined, opts);
  }

  async post<T = any>(path: string, body: any, opts: RequestOptions = {}): Promise<T> {
    return this.request<T>('POST', path, body, opts);
  }

  async put<T = any>(path: string, body: any, opts: RequestOptions = {}): Promise<T> {
    return this.request<T>('PUT', path, body, opts);
  }

  async patch<T = any>(path: string, body: any, opts: RequestOptions = {}): Promise<T> {
    return this.request<T>('PATCH', path, body, opts);
  }

  async delete<T = any>(path: string, opts: RequestOptions = {}): Promise<T> {
    return this.request<T>('DELETE', path, undefined, opts);
  }

  private buildUrl(path: string, query?: Record<string, any>): string {
    const url = new URL(path, this.baseUrl);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null) continue;
        url.searchParams.append(k, String(v));
      }
    }
    return url.toString();
  }

  private async request<T>(
    method: string,
    path: string,
    body?: any,
    opts: RequestOptions = {}
  ): Promise<T> {
    const url = this.buildUrl(path, opts.query);

    if (this.dryRun) {
      console.log(`[DRY-RUN] ${method} ${url}`);
      if (body) console.log(JSON.stringify(body, null, 2));
      return {} as T;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const text = await response.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }

      if (!response.ok) {
        const message =
          data?.message ||
          data?.error ||
          (typeof data === 'string' ? data : `HTTP ${response.status}`);
        throw new Error(`${response.status} ${response.statusText}: ${message}`);
      }

      return data as T;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`請求超時 (${this.timeout}ms): ${method} ${url}`);
      }
      if (err.cause?.code === 'ECONNREFUSED') {
        throw new Error(`連線被拒絕：${url}（後端是否啟動？）`);
      }
      throw err;
    }
  }
}

export function createHttpClient(config: HttpClientConfig): HttpClient {
  return new HttpClient(config);
}
