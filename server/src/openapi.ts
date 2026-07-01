/**
 * OpenAPI 規範生成
 *
 * AI 友善說明：
 * - 靜態描述整個 API 表面積
 * - 客戶端可用此產生 TypeScript 型別
 * - 可餵給 Swagger UI 產生互動式文件
 *
 * 維護方式：
 * - 新增路由時同步更新對應的 paths
 * - 改欄位時同步更新對應的 schemas
 */

export function generateOpenAPISpec() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'V4 Resident System API',
      version: '1.0.0',
      description: '大樓住戶管理系統後端 API — 完整 V1 移植版（住戶、記帳、班表、設定、公告）',
      contact: { name: 'V4 Project' },
      license: { name: 'MIT' },
    },
    servers: [{ url: 'http://localhost:3001', description: '本地開發' }],
    tags: [
      { name: 'system', description: '系統資訊' },
      { name: 'residents', description: '住戶與成員管理' },
      { name: 'expenses', description: '記帳與零用金' },
      { name: 'schedule', description: '班表與員工' },
      { name: 'settings', description: '建築、樓層、公設、車位、狀態設定' },
      { name: 'home-tabs', description: '首頁公告標籤與內容' },
    ],
    paths: {
      '/api/health': {
        get: {
          tags: ['system'],
          summary: '健康檢查',
          description: '回傳資料庫狀態、回應時間、檔案大小',
          responses: {
            200: {
              description: 'OK',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Health' } } },
            },
          },
        },
      },
      '/api/info': {
        get: {
          tags: ['system'],
          summary: '系統資訊',
          description: '回傳版本、執行時間、可用端點',
          responses: { 200: { description: 'OK' } },
        },
      },
      '/api/residents': {
        get: {
          tags: ['residents'],
          summary: '取得所有住戶',
          responses: {
            200: {
              description: '住戶陣列',
              content: {
                'application/json': {
                  schema: { type: 'array', items: { $ref: '#/components/schemas/Resident' } },
                },
              },
            },
          },
        },
        post: {
          tags: ['residents'],
          summary: '新增住戶',
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ResidentInput' } },
            },
          },
          responses: { 201: { description: '已建立' } },
        },
      },
      '/api/residents/{id}': {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        get: { tags: ['residents'], summary: '取得單一住戶', responses: { 200: { description: 'OK' } } },
        put: { tags: ['residents'], summary: '更新住戶', responses: { 200: { description: 'OK' } } },
        delete: { tags: ['residents'], summary: '刪除住戶', responses: { 204: { description: '已刪除' } } },
      },
      '/api/expenses': {
        get: { tags: ['expenses'], summary: '取得記帳記錄', responses: { 200: { description: 'OK' } } },
        post: { tags: ['expenses'], summary: '新增記帳', responses: { 201: { description: '已建立' } } },
      },
      '/api/schedule': {
        get: { tags: ['schedule'], summary: '取得班表', responses: { 200: { description: 'OK' } } },
        post: { tags: ['schedule'], summary: '新增班表', responses: { 201: { description: '已建立' } } },
      },
      '/api/settings/buildings': {
        get: { tags: ['settings'], summary: '建築列表', responses: { 200: { description: 'OK' } } },
        post: { tags: ['settings'], summary: '新增建築', responses: { 201: { description: '已建立' } } },
      },
      '/api/home-tabs': {
        get: { tags: ['home-tabs'], summary: '公告標籤列表', responses: { 200: { description: 'OK' } } },
        post: { tags: ['home-tabs'], summary: '新增標籤', responses: { 201: { description: '已建立' } } },
      },
    },
    components: {
      schemas: {
        Health: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            tables: { type: 'integer', description: '目前資料表數' },
            sizeBytes: { type: 'integer' },
            location: { type: 'string', description: 'SQLite 檔案路徑' },
          },
        },
        Resident: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            property: { type: 'string', description: '房號（樓-層-室）' },
            buildingId: { type: 'string' },
            floor: { type: 'string' },
            unitNumber: { type: 'string' },
            name: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string', format: 'email' },
            parkingId: { type: 'string', nullable: true },
            memberCount: { type: 'integer' },
            status: { type: 'string', enum: ['正常', '出租中', '空屋', '已出售'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'buildingId', 'floor', 'name'],
        },
        ResidentInput: {
          type: 'object',
          properties: {
            property: { type: 'string' },
            buildingId: { type: 'string' },
            floor: { type: 'string' },
            unitNumber: { type: 'string' },
            name: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string' },
          },
          required: ['buildingId', 'floor', 'name'],
        },
      },
    },
  };
}