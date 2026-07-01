/**
 * 加密測試 - 真正的 AES-GCM
 */

import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, deriveKey, looksEncrypted, encryptJSON, decryptJSON } from '@/security/crypto';

describe('AES-GCM 加密', () => {
  it('加密解密可逆', async () => {
    const { key } = await deriveKey('master-password-123');
    const plain = 'sk-test-1234567890abcdef';
    const encrypted = await encrypt(plain, key);
    const decrypted = await decrypt(encrypted, key);
    expect(decrypted).toBe(plain);
  });

  it('不同 IV 產生不同 ciphertext', async () => {
    const { key } = await deriveKey('master-password-123');
    const a = await encrypt('same', key);
    const b = await encrypt('same', key);
    expect(a).not.toBe(b);
    expect(await decrypt(a, key)).toBe('same');
    expect(await decrypt(b, key)).toBe('same');
  });

  it('錯誤金鑰無法解密', async () => {
    const { key: k1 } = await deriveKey('password-1');
    const { key: k2 } = await deriveKey('password-2');
    const encrypted = await encrypt('secret', k1);
    await expect(decrypt(encrypted, k2)).rejects.toThrow();
  });

  it('looksEncrypted 正確判斷', async () => {
    expect(looksEncrypted('')).toBe(false);
    expect(looksEncrypted('short')).toBe(false);
    expect(looksEncrypted('not-base64!@#$')).toBe(false);

    const { key } = await deriveKey('p');
    const enc = await encrypt('hello world', key);
    expect(looksEncrypted(enc)).toBe(true);
  });

  it('JSON 加解密', async () => {
    const { key } = await deriveKey('p');
    const obj = { apiKey: 'sk-secret', provider: 'openai', settings: { temp: 0.5 } };
    const enc = await encryptJSON(obj, key);
    const dec = await decryptJSON(enc, key);
    expect(dec).toEqual(obj);
  });

  it('空字串處理', async () => {
    const { key } = await deriveKey('p');
    expect(await encrypt('', key)).toBe('');
    expect(await decrypt('', key)).toBe('');
  });
});
