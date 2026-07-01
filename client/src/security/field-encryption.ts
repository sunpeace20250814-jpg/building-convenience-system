/**
 * 敏感欄位加密層
 * 在 SQLite 之上加一層自動加解密，用於電話、Email、備註等個資
 *
 * 用法（取代原本的 query/execute）：
 *   const rows = await queryEncrypted('SELECT * FROM residents');
 *   executeEncrypted('INSERT INTO residents (...) VALUES (...)', params);
 *
 * 設定：使用者可以設定「資料加密密碼」，用 PBKDF2 派生金鑰
 * 沒設定 → 走明文模式（向後相容）
 */

import { queryAll, execute } from '@/storage/database';
import { deriveKey, encrypt, decrypt, looksEncrypted } from './crypto';

const ENCRYPTED_FIELDS: Record<string, string[]> = {
  residents: ['phone', 'email', 'emergency_contact', 'emergency_phone', 'note'],
  resident_members: ['phone'],
  employees: ['phone', 'name'], // 員工姓名也加密（人事敏感）
  resident_keycards: ['card_number', 'note'],
  home_records: ['content', 'title'],
  expense_records: ['description'],
  allowance_holders: ['name'],
  allowance_transactions: ['description'],
};

const STORAGE_KEY = 'v4-data-encryption-enabled';
const PASSWORD_VERIFIER_KEY = 'v4-encryption-verifier';

// 設定中的 master key（記在記憶體，不進 localStorage 明文）
let activeKey: CryptoKey | null = null;

/** 設定加密（會把 password 派生成 CryptoKey 並存在記憶體） */
export async function enableEncryption(password: string): Promise<void> {
  const { key } = await deriveKey(password);
  activeKey = key;
  localStorage.setItem(STORAGE_KEY, 'true');

  // 寫一個測試值驗證金鑰是否正確，後續 unlock 用
  const verifier = await encrypt('v4-encryption-verifier-v1', key);
  localStorage.setItem(PASSWORD_VERIFIER_KEY, verifier);
}

export async function disableEncryption(): Promise<void> {
  activeKey = null;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(PASSWORD_VERIFIER_KEY);
}

export function isEncryptionEnabled(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function isEncryptionActive(): boolean {
  return activeKey !== null;
}

/** 解除鎖定（用於重啟後記住密碼的場景） */
export async function unlockEncryption(password: string): Promise<boolean> {
  try {
    const { key } = await deriveKey(password);
    const verifier = localStorage.getItem(PASSWORD_VERIFIER_KEY);
    if (!verifier) return false;
    const decrypted = await decrypt(verifier, key);
    if (decrypted === 'v4-encryption-verifier-v1') {
      activeKey = key;
      return true;
    }
  } catch {}
  return false;
}

function isFieldEncrypted(table: string, field: string): boolean {
  return ENCRYPTED_FIELDS[table]?.includes(field) ?? false;
}
void isFieldEncrypted;

async function encryptValue(value: any, key: CryptoKey): Promise<string | null> {
  if (value === null || value === undefined || value === '') return value as any;
  return encrypt(String(value), key);
}

async function decryptValue(value: any, key: CryptoKey): Promise<string | null> {
  if (value === null || value === undefined) return value;
  // 已經是明文（遷移期或加密未啟用）
  if (!looksEncrypted(String(value))) return String(value);
  try {
    return await decrypt(String(value), key);
  } catch {
    return '[解密失敗]';
  }
}

/** 自動解密查詢結果中已加密的欄位 */
async function decryptRows(table: string, rows: any[]): Promise<any[]> {
  if (!activeKey) return rows;
  const fields = ENCRYPTED_FIELDS[table] || [];
  if (fields.length === 0) return rows;
  return Promise.all(
    rows.map(async (row) => {
      const decrypted: any = { ...row };
      for (const f of fields) {
        // DB 欄位名是 snake_case
        const snakeF = camelToSnake(f);
        if (row[snakeF] !== null && row[snakeF] !== undefined) {
          decrypted[snakeF] = await decryptValue(row[snakeF], activeKey!);
        }
      }
      return decrypted;
    })
  );
}

function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
}

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/** 加密版的 queryAll */
export async function queryEncrypted<T = any>(sql: string, params: any[] = [], tableHint?: string): Promise<T[]> {
  const rows = queryAll<T>(sql, params);
  if (tableHint && activeKey) {
    return (await decryptRows(tableHint, rows)) as T[];
  }
  return rows;
}

/** 加密版的 queryOne */
export async function queryOneEncrypted<T = any>(sql: string, params: any[] = [], tableHint?: string): Promise<T | null> {
  const rows = await queryEncrypted<T>(sql, params, tableHint);
  return rows[0] || null;
}

/** 加密版的 execute — 自動加密 params 中的敏感欄位 */
export async function executeEncrypted(
  sql: string,
  params: any[] = [],
  tableHint?: string
): Promise<void> {
  if (!activeKey || !tableHint) {
    execute(sql, params);
    return;
  }

  // 嘗試解析 SQL 抓出欄位名
  const fields = ENCRYPTED_FIELDS[tableHint] || [];
  if (fields.length === 0) {
    execute(sql, params);
    return;
  }

  // 簡化：假設 INSERT/UPDATE 的欄位順序與 params 對應
  // 解析 SQL 拿到欄位名
  const colMatch = sql.match(/\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i)
    || sql.match(/SET\s+(.+?)(?:\s+WHERE|$)/i);
  if (!colMatch) {
    execute(sql, params);
    return;
  }

  let colList: string[];
  if (colMatch[1].toUpperCase().includes('VALUES')) {
    colList = colMatch[1].split(',').map((c) => c.trim());
  } else {
    // UPDATE SET col=?, col=?, ...
    colList = colMatch[1].split(',').map((c) => c.trim().split('=')[0].trim());
  }

  // 加密對應的欄位
  const encryptedParams = await Promise.all(
    params.map(async (v, i) => {
      const colSnake = colList[i];
      if (!colSnake) return v;
      const colCamel = snakeToCamel(colSnake);
      if (fields.includes(colCamel) && v !== null && v !== undefined && v !== '') {
        return await encryptValue(v, activeKey!);
      }
      return v;
    })
  );

  execute(sql, encryptedParams);
}
