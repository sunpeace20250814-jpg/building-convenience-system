/**
 * Unit tests — TASK-003: M-30 全域字串長度上限
 */
import { describe, it, expect } from 'vitest';
import {
  registerStringLengthLimits,
  DEFAULT_STRING_MAX_LENGTH,
} from '../src/routes/_crud.js';
import Fastify from 'fastify';

describe('TASK-003: M-30 String Length Limit', () => {
  async function buildServer() {
    const app = Fastify({ logger: false });
    registerStringLengthLimits(app);
    // 加一個 minimal route 接收 POST/PUT echo
    app.post<{ Body: unknown }>('/echo', async (req) => req.body);
    app.put<{ Body: unknown }>('/echo-put', async (req) => req.body);
    await app.ready();
    return app;
  }

  it('短字串正常通過', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/echo',
      payload: { name: 'normal', description: 'normal text' },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('超長字串被 400 拒絕', async () => {
    const app = await buildServer();
    const hugeText = 'a'.repeat(DEFAULT_STRING_MAX_LENGTH + 1); // 10001 chars
    const res = await app.inject({
      method: 'POST',
      url: '/echo',
      payload: { name: 'evil', description: hugeText },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/字串欄位過長/);
    expect(body.message).toMatch(/description/);
    await app.close();
  });

  it('PUT 也受檢查', async () => {
    const app = await buildServer();
    const huge = 'b'.repeat(DEFAULT_STRING_MAX_LENGTH + 100);
    const res = await app.inject({
      method: 'PUT',
      url: '/echo-put',
      payload: { note: huge },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('多個超長欄位都會被抓,前 5 個回傳', async () => {
    const app = await buildServer();
    const huge = 'x'.repeat(DEFAULT_STRING_MAX_LENGTH + 1);
    const res = await app.inject({
      method: 'POST',
      url: '/echo',
      payload: {
        huge1: huge,
        huge2: huge,
        huge3: huge,
        huge4: huge,
        huge5: huge,
        huge6: huge,  // 超過 5 個,測試 +N more 邏輯
      },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/\(\+1 more\)/); // 6 - 5 = 1 more
    await app.close();
  });

  it('boundary: 等於 DEFAULT_STRING_MAX_LENGTH 應該通過', async () => {
    const app = await buildServer();
    const boundary = 'c'.repeat(DEFAULT_STRING_MAX_LENGTH);  // 剛好等於上限
    const res = await app.inject({
      method: 'POST',
      url: '/echo',
      payload: { description: boundary },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('nested object 遞迴檢查', async () => {
    const app = await buildServer();
    const huge = 'd'.repeat(DEFAULT_STRING_MAX_LENGTH + 1);
    const res = await app.inject({
      method: 'POST',
      url: '/echo',
      payload: {
        outer: {
          inner: {
            deep: { description: huge },
          },
        },
      },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/outer\.inner\.deep\.description/);
    await app.close();
  });

  it('array 內的字串也會被抓', async () => {
    const app = await buildServer();
    const huge = 'e'.repeat(DEFAULT_STRING_MAX_LENGTH + 1);
    const res = await app.inject({
      method: 'POST',
      url: '/echo',
      payload: { tags: ['ok', 'also-ok', huge] },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/tags\[2\]/);
    await app.close();
  });

  it('edge: 0-length string 應該通過', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/echo',
      payload: { description: '' },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('edge: null / undefined 應該被當合法', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/echo',
      payload: { description: null, note: undefined },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});