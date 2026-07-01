/**
 * V4 Server Entry
 *
 * AI 友善說明：
 * - 標準 Fastify 啟動模式
 * - 預設 port 3001，可用 PORT 環境變數覆蓋
 * - 啟動時自動初始化 SQLite
 * - 提供 /api/health 與 /api/info 供監控
 * - 提供 /api/openapi.json 供客戶端與文件生成
 *
 * 路由總覽（每個資源一個 prefix）：
 * - 系統：/api/health, /api/info, /api/openapi.json
 * - 住戶：/api/residents（+ members/keycards 子路徑）
 * - 記帳：/api/expenses（+ categories/allowance 子路徑）
 * - 班表：/api/schedule（+ employees/shifts/holidays 子路徑）
 * - 設定：/api/settings（+ status/buildings/parking 子路徑）
 * - 首頁：/api/home-tabs
 * - V4 擴充：/api/floors, /api/facilities, /api/house-statuses, /api/parking-statuses,
 *           /api/employees, /api/shifts, /api/schedule-holidays, /api/training,
 *           /api/allowance-holders, /api/allowance-records, /api/expense-budgets,
 *           /api/backup-history, /api/home-records, /api/calendar-events
 *
 * 擴充方式：
 * 1. 新增路由：到 src/routes/ 加一個檔案，在這裡 register
 * 2. 新增表：到 src/db/schema.ts 加 CREATE TABLE，在 initDatabase 中處理預設資料
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import staticFiles from '@fastify/static';
import multipart from '@fastify/multipart';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase, healthCheck, db, ALL_TABLES, DATA_DIR } from './db/index.js';
// 載入 Fastify 型別擴充（為 FastifySchema 加入 tags/summary/description 等 OpenAPI 欄位）
import './fastify-types.js';

// 既有路由
import residentsRoutes from './routes/residents.js';
import expensesRoutes from './routes/expenses.js';
import scheduleRoutes from './routes/schedule.js';
import settingsRoutes from './routes/settings.js';
import homeTabsRoutes from './routes/home-tabs.js';
import { licenseRoutes } from './routes/license.js';

// V4 擴充路由（14 個）
import floorsRoutes from './routes/floors.js';
import facilitiesRoutes from './routes/facilities.js';
import houseStatusesRoutes from './routes/house-statuses.js';
import parkingStatusesRoutes from './routes/parking-statuses.js';
import employeesRoutes from './routes/employees.js';
import shiftsRoutes from './routes/shifts.js';
import scheduleHolidaysRoutes from './routes/schedule-holidays.js';
import trainingRoutes from './routes/training.js';
import allowanceHoldersRoutes from './routes/allowance-holders.js';
import allowanceRecordsRoutes from './routes/allowance-records.js';
import expenseBudgetsRoutes from './routes/expense-budgets.js';
import backupHistoryRoutes from './routes/backup-history.js';
import homeRecordsRoutes from './routes/home-records.js';
import calendarEventsRoutes from './routes/calendar-events.js';

// V4 Go-style 補完整（plan_1654a823 worker 補的）
import parkingSpotsRoutes from './routes/parking-spots.js';
import statusOptionsRoutes from './routes/status-options.js';
import parkingBindingRoutes from './routes/parking-binding.js';
import residentParkingRoutes from './routes/resident-parking.js';
import residentEmergencyContactsRoutes from './routes/resident-emergency-contacts.js';
import decorationRecordsRoutes from './routes/decoration-records.js';
import facilityBookingsRoutes from './routes/facility-bookings.js';
import holidaysRoutes from './routes/holidays.js';
import holidayCategoriesRoutes from './routes/holiday-categories.js';
import scheduleEntriesRoutes from './routes/schedule-entries.js';
import scheduleNotesRoutes from './routes/schedule-notes.js';
import { registerStringLengthLimits } from './routes/_crud.js'; // M-30 全域字串長度上限
import uploadsRoutes from './routes/uploads.js';

// 雲端同步（直寫檔案，無 metadata 表）

import { generateOpenAPISpec } from './openapi.js';
import { BackupManager } from './jobs/backupManager.js';
import cron from 'node-cron';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'production' ? undefined : {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  },
  // AI 友善：明確錯誤回應格式
  schemaErrorFormatter: (errors) => {
    const err = new Error('請求參數驗證失敗') as any;
    err.statusCode = 400;
    err.name = 'ValidationError';
    err.details = errors.map((e: any) => ({
      path: e.instancePath,
      message: e.message,
      params: e.params,
    }));
    return err;
  },
});

async function start() {
  // 1. 初始化資料庫
  initDatabase();

  // 2. CORS（開發模式寬鬆，生產模式嚴格）
  await fastify.register(cors, {
    origin: process.env.NODE_ENV === 'production'
      ? process.env.ALLOWED_ORIGINS?.split(',') || false
      : true,
    credentials: true,
  });

  // 3. 靜態檔案（生產環境 serve client build）
  await fastify.register(staticFiles, {
    root: path.join(__dirname, '../../client/dist'),
    prefix: '/',
    decorateReply: false,
  });

  // 3.5 multipart upload（M-15 — 取代 base64 直存 DB）
  await fastify.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
      files: 1,
    },
  });

  // 3.6 字串長度全域上限（M-30 — 預防 DoS / DB bloat）
  registerStringLengthLimits(fastify);

  // 4. 健康檢查
  fastify.get('/api/health', async () => healthCheck());

  // 5. 系統資訊
  fastify.get('/api/info', async () => ({
    name: 'v4-resident-system',
    version: '1.0.0',
    node: process.version,
    uptime: process.uptime(),
    tables: ALL_TABLES.length,
    endpoints: {
      health: '/api/health',
      openapi: '/api/openapi.json',
      // 既有
      residents: '/api/residents',
      expenses: '/api/expenses',
      schedule: '/api/schedule',
      settings: '/api/settings',
      homeTabs: '/api/home-tabs',
      // V4 擴充
      floors: '/api/floors',
      facilities: '/api/facilities',
      houseStatuses: '/api/house-statuses',
      parkingStatuses: '/api/parking-statuses',
      employees: '/api/employees',
      shifts: '/api/shifts',
      scheduleHolidays: '/api/schedule-holidays',
      training: '/api/training',
      allowanceHolders: '/api/allowance-holders',
      allowanceRecords: '/api/allowance-records',
      expenseBudgets: '/api/expense-budgets',
      backupHistory: '/api/backup-history',
      homeRecords: '/api/home-records',
      calendarEvents: '/api/calendar-events',
    },
  }));

  // 6. OpenAPI spec
  fastify.get('/api/openapi.json', async () => generateOpenAPISpec());

  // 7. 既有業務路由
  await fastify.register(residentsRoutes, { prefix: '/api/residents' });
  await fastify.register(expensesRoutes, { prefix: '/api/expenses' });
  await fastify.register(scheduleRoutes, { prefix: '/api/schedule' });
  await fastify.register(settingsRoutes, { prefix: '/api/settings' });
  await fastify.register(homeTabsRoutes, { prefix: '/api/home-tabs' });

  // 8. V4 擴充業務路由（14 個新資源，每個一個檔案）
  await fastify.register(floorsRoutes, { prefix: '/api/floors' });
  await fastify.register(facilitiesRoutes, { prefix: '/api/facilities' });
  await fastify.register(houseStatusesRoutes, { prefix: '/api/house-statuses' });
  await fastify.register(parkingStatusesRoutes, { prefix: '/api/parking-statuses' });
  await fastify.register(employeesRoutes, { prefix: '/api/employees' });
  await fastify.register(shiftsRoutes, { prefix: '/api/shifts' });
  await fastify.register(scheduleHolidaysRoutes, { prefix: '/api/schedule-holidays' });
  await fastify.register(trainingRoutes, { prefix: '/api/training' });
  await fastify.register(allowanceHoldersRoutes, { prefix: '/api/allowance-holders' });
  await fastify.register(allowanceRecordsRoutes, { prefix: '/api/allowance-records' });
  await fastify.register(expenseBudgetsRoutes, { prefix: '/api/expense-budgets' });
  await fastify.register(backupHistoryRoutes, { prefix: '/api/backup-history' });
  await fastify.register(homeRecordsRoutes, { prefix: '/api/home-records' });
  await fastify.register(calendarEventsRoutes, { prefix: '/api/calendar-events' });
  await fastify.register(licenseRoutes, { prefix: '/api/license' });

  // V4 Go-style 補完整（plan_1654a823）
  await fastify.register(parkingSpotsRoutes, { prefix: '/api/parking-spots' });
  await fastify.register(statusOptionsRoutes, { prefix: '/api/status-options' });
  await fastify.register(parkingBindingRoutes, { prefix: '/api/parking-binding' });
  await fastify.register(residentParkingRoutes, { prefix: '/api/resident-parking' });
  await fastify.register(residentEmergencyContactsRoutes, { prefix: '/api/resident-emergency-contacts' });
  await fastify.register(decorationRecordsRoutes, { prefix: '/api/decoration-records' });
  await fastify.register(facilityBookingsRoutes, { prefix: '/api/facility-bookings' });
  await fastify.register(holidaysRoutes, { prefix: '/api/holidays' });
  await fastify.register(holidayCategoriesRoutes, { prefix: '/api/holiday-categories' });
  await fastify.register(scheduleEntriesRoutes, { prefix: '/api/schedule-entries' });
  await fastify.register(scheduleNotesRoutes, { prefix: '/api/schedule-notes' });
  // M-15 修復：圖片本地檔案系統（取代 base64）
  await fastify.register(uploadsRoutes, { prefix: '/api/upload' });

  // 9. 全域錯誤處理（避免 stack trace 洩漏）
  fastify.setErrorHandler((err, req, reply) => {
    fastify.log.error({ err, url: req.url, method: req.method }, 'request error');
    const status = err.statusCode || 500;
    reply.code(status).send({
      statusCode: status,
      error: err.name || 'Error',
      message: process.env.NODE_ENV === 'production' && status === 500
        ? 'Internal Server Error'
        : err.message,
    });
  });

  // 10. 啟動
  const port = Number(process.env.PORT) || 3001;
  const host = process.env.HOST || '0.0.0.0';
  await fastify.listen({ port, host });
  console.log(`\n🚀 V4 Server running on http://localhost:${port}`);
  console.log(`   Health:  http://localhost:${port}/api/health`);
  console.log(`   OpenAPI: http://localhost:${port}/openapi.json`);
  console.log(`   Tables:  ${ALL_TABLES.length}`);

  // ---- Backup Manager ----
  const bm = new BackupManager(DATA_DIR);
  await bm.startup(); // 開程式必做一次備份

  // 每小時備份一次
  cron.schedule('0 * * * *', () => { bm.hourly().catch(e => console.error('[cron] hourly backup fail:', e)); });

  // 每天 02:00 做 daily 備份（更完整，清理舊檔）
  cron.schedule('0 2 * * *', () => { bm.daily().catch(e => console.error('[cron] daily backup fail:', e)); });

  // shutdown 時必做一次（防禦機制）
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n${signal} — running shutdown backup...`);
    await bm.shutdown();
    await fastify.close();
    db.close();
    process.exit(0);
  };
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

start().catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
