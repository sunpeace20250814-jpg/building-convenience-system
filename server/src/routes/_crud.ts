/**
 * 通用 CRUD Route 工具
 *
 * AI 友善說明：
 * - 大部分 V4 表都是簡單 CRUD（getAll / getById / create / update / delete）
 * - 這個 helper 把標準 CRUD 抽出去，讓每個 route 檔只需專注特殊端點
 * - 全部用 Fastify 原生 JSON Schema 做請求驗證（不需額外裝 TypeBox）
 *
 * 用法：
 *   export default async function (fastify) {
 *     await createCrudRoutes(fastify, {
 *       tag: 'floors',
 *       resourceLabel: '樓層',
 *       repository: repositories.floors,
 *     });
 *
 *     // 額外端點
 *     fastify.get('/building/:buildingId', { ... }, async (req) => {
 *       return repositories.floors.findBy('building_id = ?', [req.params.buildingId]);
 *     });
 *   }
 */

import type { FastifyInstance, FastifySchema } from 'fastify';
import { Repository } from '../db/repository.js';

export interface CrudOptions {
  /** OpenAPI tag 名稱（英文） */
  tag: string;
  /** 中文資源名稱，用於 404 訊息與 OpenAPI summary */
  resourceLabel: string;
  /** 對應的 Repository 實例 */
  repository: Repository<any>;
  /** 預設 ORDER BY 欄位（snake_case） */
  orderBy?: string;
  /** POST body JSON Schema（可選） */
  createBodySchema?: Record<string, unknown>;
  /** PUT body JSON Schema（可選） */
  updateBodySchema?: Record<string, unknown>;
  /** POST / PUT response JSON Schema（可選） */
  itemResponseSchema?: Record<string, unknown>;
  /** 是否啟用 GET list 端點（預設 true） */
  enableList?: boolean;
}

// 共用 schema fragments
export const idParamSchema = {
  type: 'object',
  properties: { id: { type: 'string', minLength: 1 } },
  required: ['id'],
};

export const okResponseSchema = (itemSchema?: Record<string, unknown>) =>
  itemSchema
    ? { 200: itemSchema }
    : { 200: { type: 'object', properties: { success: { type: 'boolean' } } } };

export const notFoundSchema = {
  404: {
    type: 'object',
    properties: {
      statusCode: { type: 'integer' },
      message: { type: 'string' },
    },
  },
};

/**
 * 包裝 SQLite 操作 → 把 SQLITE_CONSTRAINT_* 錯誤轉 400
 * 用於自訂 routes（非 createCrudRoutes）的 handler：
 *   const result = await tryDbOp(() => repo.create(body));
 */
export async function tryDbOp<T>(op: () => T): Promise<T> {
  try {
    return op();
  } catch (e: any) {
    if (e && typeof e.code === 'string' && e.code.startsWith('SQLITE_CONSTRAINT')) {
      // M-29 修復：不要洩漏 SQLite 內部欄位名，只給使用者友善訊息
      const err: any = new Error('資料驗證失敗：請檢查必填欄位、唯一鍵、約束條件');
      err.statusCode = 400;
      err.name = 'ValidationError';
      // 保留 code 供 server-side log，但不給 client
      if (process.env.NODE_ENV !== 'production') {
        // 開發環境：保留 SQLite 訊息方便 debug
        err.message = `欄位驗證失敗: ${e.message}`;
      }
      throw err;
    }
    throw e;
  }
}

/**
 * 全域字串長度上限檢查（M-30 修復）
 *
 * Fastify preValidation hook — 在 route handler 跑之前檢查 body/querystring/params
 * 內所有 string field 長度。任何 string > DEFAULT_STRING_MAX_LENGTH 直接 400 拒絕。
 *
 * 為什麼用全域而非 per-route?
 * - 211+ 個 `type: 'string'` 欄位散落在 33 routes,per-route 加 maxLength 太散
 * - 一個中間層覆蓋全部,符合 SOUL §5.1.5 partial fit 原則
 *
 * 豁免:
 * - /openapi.json, /api/health, /api/info — 元資料端點,沒 body
 * - /api/upload/* — multipart upload,binary body 不應被字串長度檢查
 * - /api/upload/file/* — file stream,不是 string payload
 *
 * 自訂 routes 如需更高容差,可在 schema 的 property 加 maxLength,本 hook
 * 會在 preValidation 之前就被 JSON Schema 擋下(不會到本檢查)。
 */
export const DEFAULT_STRING_MAX_LENGTH = 10000;

export function registerStringLengthLimits(fastify: FastifyInstance): void {
  const SKIP_PATHS = [
    /^\/openapi\.json$/,
    /^\/api\/health$/,
    /^\/api\/info$/,
    /^\/api\/upload\//,
  ];

  const isSkipped = (url: string): boolean => SKIP_PATHS.some((re) => re.test(url));

  const checkValue = (val: unknown, path: string, errors: string[]): void => {
    if (val === null || val === undefined) return;
    if (typeof val === 'string') {
      if (val.length > DEFAULT_STRING_MAX_LENGTH) {
        errors.push(`${path}: ${val.length} chars (max ${DEFAULT_STRING_MAX_LENGTH})`);
      }
    } else if (Array.isArray(val)) {
      val.forEach((item, i) => checkValue(item, `${path}[${i}]`, errors));
    } else if (typeof val === 'object') {
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        checkValue(v, `${path}.${k}`, errors);
      }
    }
  };

  fastify.addHook('preValidation', async (request) => {
    if (isSkipped(request.url)) return;

    const errors: string[] = [];
    if (request.body) checkValue(request.body, 'body', errors);
    if (request.query) checkValue(request.query, 'query', errors);
    if (request.params) checkValue(request.params, 'params', errors);

    if (errors.length > 0) {
      const sample = errors.slice(0, 5).join('; ');
      const more = errors.length > 5 ? ` (+${errors.length - 5} more)` : '';
      const err: any = new Error(`字串欄位過長: ${sample}${more}`);
      err.statusCode = 400;
      err.name = 'StringLengthError';
      throw err;
    }
  });
}

export const errorSchema = {
  400: {
    type: 'object',
    properties: {
      statusCode: { type: 'integer' },
      message: { type: 'string' },
    },
  },
  ...notFoundSchema,
};

/**
 * 註冊標準 CRUD 端點：
 *   GET    /        列表
 *   GET    /:id     單筆
 *   POST   /        新增
 *   PUT    /:id     更新
 *   DELETE /:id     刪除
 */
export async function createCrudRoutes(
  fastify: FastifyInstance,
  options: CrudOptions,
): Promise<void> {
  const {
    tag,
    resourceLabel,
    repository,
    orderBy = 'id',
    createBodySchema,
    updateBodySchema,
    itemResponseSchema,
    enableList = true,
  } = options;

  // 預設 body schema：至少要一個屬性，避免空 body 跑到 DB 產生 SQLITE 500
  const defaultBodySchema = {
    type: 'object',
    additionalProperties: true,
    minProperties: 1,
  };

  const tagObj = { tags: [tag] };

  // GET / — 列表
  if (enableList) {
    const schema: FastifySchema = {
      ...tagObj,
      summary: `列出所有${resourceLabel}`,
      description: `回傳 ${repository.table} 表所有資料，依 ${orderBy} 排序`,
      response: {
        200: {
          type: 'array',
          items: itemResponseSchema || { type: 'object', additionalProperties: true },
        },
        ...errorSchema,
      },
    };
    fastify.get('/', { schema }, async () => repository.getAll(orderBy));
  }

  // GET /:id — 單筆
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        ...tagObj,
        summary: `取得單筆${resourceLabel}`,
        params: idParamSchema,
        response: {
          200: itemResponseSchema || { type: 'object', additionalProperties: true },
          ...errorSchema,
        },
      },
    },
    async (request) => {
      const item = repository.getById(request.params.id);
      if (!item) {
        throw { statusCode: 404, message: `找不到${resourceLabel}` };
      }
      return item;
    },
  );

  // POST / — 新增
  const createSchema: FastifySchema = {
    ...tagObj,
    summary: `新增${resourceLabel}`,
    response: {
      201: itemResponseSchema || { type: 'object', additionalProperties: true },
      ...errorSchema,
    },
  };
  if (createBodySchema) createSchema.body = createBodySchema;
  else createSchema.body = defaultBodySchema;
  fastify.post('/', { schema: createSchema }, async (request, reply) => {
    try {
      return repository.create((request.body || {}) as Record<string, unknown>);
    } catch (e: any) {
      // SQLite 約束錯誤直接回 400（不要依賴 setErrorHandler）
      if (e && typeof e.code === 'string' && e.code.startsWith('SQLITE_CONSTRAINT')) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'ValidationError',
          message: `欄位驗證失敗: ${e.message}`,
        });
      }
      throw e;
    }
  });

  // PUT /:id — 更新
  const updateSchema: FastifySchema = {
    ...tagObj,
    summary: `更新${resourceLabel}`,
    params: idParamSchema,
    response: {
      200: itemResponseSchema || { type: 'object', additionalProperties: true },
      ...errorSchema,
    },
  };
  if (updateBodySchema) updateSchema.body = updateBodySchema;
  else updateSchema.body = defaultBodySchema;
  fastify.put<{ Params: { id: string } }>(
    '/:id',
    { schema: updateSchema },
    async (request, reply) => {
      try {
        const updated = repository.update(request.params.id, (request.body || {}) as Record<string, unknown>);
        if (!updated) {
          return reply.code(404).send({ statusCode: 404, message: `找不到${resourceLabel}` });
        }
        return updated;
      } catch (e: any) {
        if (e && typeof e.code === 'string' && e.code.startsWith('SQLITE_CONSTRAINT')) {
          return reply.code(400).send({
            statusCode: 400,
            error: 'ValidationError',
            message: `欄位驗證失敗: ${e.message}`,
          });
        }
        throw e;
      }
    },
  );

  // DELETE /:id — 刪除
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        ...tagObj,
        summary: `刪除${resourceLabel}`,
        params: idParamSchema,
        response: {
          200: {
            type: 'object',
            properties: { success: { type: 'boolean' } },
          },
          ...errorSchema,
        },
      },
    },
    async (request) => {
      const ok = repository.delete(request.params.id);
      if (!ok) {
        throw { statusCode: 404, message: `找不到${resourceLabel}` };
      }
      return { success: true };
    },
  );
}
