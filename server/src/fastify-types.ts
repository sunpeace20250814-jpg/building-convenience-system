/**
 * Fastify 型別擴充
 *
 * AI 友善說明：
 * - FastifySchema 原生型別不包含 OpenAPI 擴充欄位（tags / summary / description）
 * - 但 @fastify/swagger 與 fastify-type-provider 以後者為基礎，這些欄位實際會被讀取
 * - 為了在嚴格模式下也能舒服地寫 schema，這裡用 declare module 把它們加進去
 *
 * 不影響 runtime，只影響 TypeScript 型別檢查。
 */

declare module 'fastify' {
  interface FastifySchema {
    /** OpenAPI tag，用於把多個端點分群（Swagger UI 用） */
    tags?: string[];
    /** OpenAPI summary，端點簡短描述 */
    summary?: string;
    /** OpenAPI description，端點完整描述 */
    description?: string;
    /** OpenAPI deprecated 標記 */
    deprecated?: boolean;
    /** OpenAPI 隱藏（從文件隱藏） */
    hide?: boolean;
  }
}

export {};
