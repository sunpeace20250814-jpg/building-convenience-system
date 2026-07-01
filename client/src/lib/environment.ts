/**
 * 環境偵測
 * 偵測瀏覽器、雲端硬碟、V4 安裝位置
 */

export interface BrowserInfo {
  name: 'edge' | 'chrome' | 'firefox' | 'safari' | 'other';
  version: string;
  userAgent: string;
}

export interface CloudDriveInfo {
  type: 'google-drive' | 'onedrive' | 'dropbox' | 'unknown';
  name: string;
  mountPath: string | null;
  available: boolean;
  loggedIn: boolean;
  description: string;
}

export interface Environment {
  browser: BrowserInfo;
  v4InstallPath: string | null;
  v4InstallPathWritable: boolean;
  cloudDrives: CloudDriveInfo[];
  serverAvailable: boolean;
  detectedAt: number;
}

const BROWSER_NAMES: Record<string, BrowserInfo['name']> = {
  Edg: 'edge',
  Chrome: 'chrome',
  Firefox: 'firefox',
  Safari: 'safari',
};
void BROWSER_NAMES; // 保留供未來擴充

/**
 * 偵測瀏覽器
 */
export function detectBrowser(): BrowserInfo {
  const ua = navigator.userAgent;

  // Edge (新版 Chromium-based，userAgent 含 "Edg/")
  let match = ua.match(/Edg\/([\d.]+)/);
  if (match) return { name: 'edge', version: match[1], userAgent: ua };

  // Edge (舊版)
  match = ua.match(/Edge\/([\d.]+)/);
  if (match) return { name: 'edge', version: match[1], userAgent: ua };

  // Chrome
  match = ua.match(/Chrome\/([\d.]+)/);
  if (match) return { name: 'chrome', version: match[1], userAgent: ua };

  // Firefox
  match = ua.match(/Firefox\/([\d.]+)/);
  if (match) return { name: 'firefox', version: match[1], userAgent: ua };

  // Safari
  match = ua.match(/Version\/([\d.]+).*Safari/);
  if (match) return { name: 'safari', version: match[1], userAgent: ua };

  return { name: 'other', version: '0', userAgent: ua };
}

/**
 * 透過 PowerShell HTTP server 端點偵測雲端硬碟
 * server 端由 start-server.ps1 提供 /api/environment
 */
export async function fetchEnvironmentFromServer(): Promise<Partial<Environment> | null> {
  try {
    const resp = await fetch('/api/environment', {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

/**
 * 用 navigator.userAgent + localStorage 做 fallback 偵測
 * （當 server 不可用時）
 */
export function detectCloudDrivesFallback(): CloudDriveInfo[] {
  // 純前端無法偵測雲端硬碟 — 只能回傳空陣列
  // 真正的偵測需要 server 端（讀取 Windows 磁碟機資訊）
  return [];
}

/**
 * 取得 V4 安裝路徑（從 localStorage 或 server 端點）
 */
export async function detectV4InstallPath(): Promise<{ path: string | null; writable: boolean }> {
  // 先看 localStorage
  const cached = localStorage.getItem('v4-install-path');
  if (cached) return { path: cached, writable: true };

  // 從 server 拿
  try {
    const resp = await fetch('/api/environment', { signal: AbortSignal.timeout(3000) });
    if (resp.ok) {
      const data = await resp.json();
      if (data.v4InstallPath) {
        localStorage.setItem('v4-install-path', data.v4InstallPath);
        return { path: data.v4InstallPath, writable: true };
      }
    }
  } catch {}

  return { path: null, writable: false };
}

/**
 * 完整環境偵測（彙總所有來源）
 */
export async function detectEnvironment(): Promise<Environment> {
  const browser = detectBrowser();

  // 嘗試從 server 拿環境資訊
  const serverEnv = await fetchEnvironmentFromServer();
  const serverAvailable = serverEnv !== null;

  const v4Path = await detectV4InstallPath();

  // 雲端偵測
  let cloudDrives: CloudDriveInfo[] = [];
  if (serverEnv?.cloudDrives) {
    cloudDrives = serverEnv.cloudDrives;
  } else {
    cloudDrives = detectCloudDrivesFallback();
  }

  return {
    browser,
    v4InstallPath: serverEnv?.v4InstallPath ?? v4Path.path,
    v4InstallPathWritable: v4Path.writable,
    cloudDrives,
    serverAvailable,
    detectedAt: Date.now(),
  };
}