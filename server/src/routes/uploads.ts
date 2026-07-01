/**
 * Upload Routes — M-15 修復
 *
 * POST /api/upload/:table        multipart/form-data 上傳圖片
 * GET  /api/upload/file/:path    取得圖片（取代 base64 直接塞 DB）
 *
 * 為什麼不是 /api/uploads/... 多層？因為 Fastify path parsing 衝突：
 *   - /uploads/:table  → POST
 *   - /uploads/:path   → GET  (path 含 table/filename)
 * 同 prefix 下 Fastify 會把 :path 當 :table 處理 → 404
 *
 * 解法：用不同的 path segment：
 *   POST /api/upload/:table
 *   GET  /api/upload/file/:path
 */
import type { FastifyInstance } from 'fastify';
import { saveUpload, readUploadStream, mimeFromExt, extFromPath } from '../services/uploadService.js';

const ALLOWED_TABLES = ['home_records', 'residents', 'decoration_records'];

export default async function uploadRoutes(fastify: FastifyInstance) {
  // POST /api/upload/:table
  fastify.post<{ Params: { table: string } }>(
    '/:table',
    {
      schema: {
        tags: ['uploads'],
        summary: '上傳圖片（M-15 — 取代 base64 直存 DB）',
        params: {
          type: 'object',
          properties: { table: { type: 'string', enum: ALLOWED_TABLES } },
          required: ['table'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              url: { type: 'string' },
              mime: { type: 'string' },
              size: { type: 'integer' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const data = await request.file();
      if (!data) {
        return reply.code(400).send({ message: '未提供檔案' });
      }
      const buffer = await data.toBuffer();
      const url = await saveUpload(request.params.table, buffer, data.mimetype);
      return { url, mime: data.mimetype, size: buffer.length };
    },
  );

  // GET /api/upload/file/:path
  // :path 包含 table/filename (e.g. "home_records/abc-123.jpg")
  // Fastify 預設 :path 不會 match / ，所以用 * wildcard
  fastify.get<{ Params: { '*': string } }>(
    '/file/*',
    {
      schema: {
        tags: ['uploads'],
        summary: '取得上傳的圖片（stream）',
        params: {
          type: 'object',
          properties: { '*': { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      try {
        const relPath = (request.params as any)['*'];
        const stream = readUploadStream(relPath);
        const ext = extFromPath(relPath);
        reply
          .header('Content-Type', mimeFromExt(ext))
          .header('Cache-Control', 'public, max-age=86400');
        return reply.send(stream);
      } catch (e: any) {
        return reply.code(404).send({ message: '找不到圖片' });
      }
    },
  );
}