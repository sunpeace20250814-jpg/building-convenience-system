/**
 * 加密工具 - Web Crypto API
 * 取代原本的 XOR，提供真正的 AES-GCM 加密
 *
 * 用法：
 *   const encrypted = await encrypt('明文', masterKey);
 *   const plain = await decrypt(encrypted, masterKey);
 *
 * 加密格式（base64）：
 *   [12 bytes IV][N bytes ciphertext][16 bytes auth tag]
 */

const ALGO = 'AES-GCM';
const KEY_LEN = 256;
const IV_LEN = 12;
const TAG_LEN = 128;

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

export function isWebCryptoAvailable(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';
}

// 將 Uint8Array 強制轉成 ArrayBuffer-backed view（避免 SharedArrayBuffer 類型衝突）
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** 從密碼字串衍生 AES key（PBKDF2） */
export async function deriveKey(password: string, salt?: Uint8Array): Promise<{ key: CryptoKey; salt: Uint8Array }> {
  if (!isWebCryptoAvailable()) throw new Error('瀏覽器不支援 Web Crypto API');
  const useSalt = salt || randomBytes(16);
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', toArrayBuffer(enc.encode(password)), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: toArrayBuffer(useSalt), iterations: 100_000, hash: 'SHA-256' },
    baseKey,
    { name: ALGO, length: KEY_LEN },
    false,
    ['encrypt', 'decrypt']
  );
  return { key, salt: useSalt };
}

/** 加密字串，回傳 base64（IV + ciphertext + tag） */
export async function encrypt(plain: string, key: CryptoKey): Promise<string> {
  if (!plain) return '';
  const iv = randomBytes(IV_LEN);
  const enc = new TextEncoder();
  const data = enc.encode(plain);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: ALGO, iv: toArrayBuffer(iv), tagLength: TAG_LEN },
    key,
    data
  );
  const cipherBytes = new Uint8Array(cipherBuf);
  const combined = new Uint8Array(iv.length + cipherBytes.length);
  combined.set(iv, 0);
  combined.set(cipherBytes, iv.length);
  return toBase64(combined);
}

/** 解密 base64 為明文 */
export async function decrypt(encrypted: string, key: CryptoKey): Promise<string> {
  if (!encrypted) return '';
  try {
    const combined = fromBase64(encrypted);
    const iv = combined.slice(0, IV_LEN);
    const cipherBytes = combined.slice(IV_LEN);
    const plainBuf = await crypto.subtle.decrypt(
      { name: ALGO, iv: toArrayBuffer(iv), tagLength: TAG_LEN },
      key,
      cipherBytes
    );
    return new TextDecoder().decode(plainBuf);
  } catch (err) {
    throw new Error('解密失敗：可能是金鑰錯誤或資料損毀');
  }
}

/** 快速 hash（用於判斷值是否已加密） */
export function looksEncrypted(value: string): boolean {
  if (!value || value.length < 32) return false;
  // base64 解碼成功且長度合理
  try {
    const bytes = fromBase64(value);
    return bytes.length > IV_LEN;
  } catch {
    return false;
  }
}

/** 加密任意可序列化物件 */
export async function encryptJSON(obj: any, key: CryptoKey): Promise<string> {
  return encrypt(JSON.stringify(obj), key);
}

export async function decryptJSON<T = any>(encrypted: string, key: CryptoKey): Promise<T> {
  const json = await decrypt(encrypted, key);
  return JSON.parse(json);
}
