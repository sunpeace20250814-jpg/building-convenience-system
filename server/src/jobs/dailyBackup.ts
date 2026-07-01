/**
 * V4 每日自動備份排程
 *
 * - 每日 02:00 觸發
 * - 把 DATA_DIR/resident-system.db 複製到 DATA_DIR/backups/auto/YYYY-MM-DD.db
 * - 保留 30 天（超過自動刪除）
 * - 寫 log 到 DATA_DIR/backups/backup.log
 *
 * 啟動方式：在 server/src/index.ts 啟動時呼叫 startBackupCron()
 */

import cron from 'node-cron';
import * as fs from 'node:fs';
import * as path from 'node:path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB_FILENAME = 'resident-system.db';
const BACKUP_DIR = path.join(DATA_DIR, 'backups', 'auto');
const LOG_FILE = path.join(DATA_DIR, 'backups', 'backup.log');
const KEEP_DAYS = 30;

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function logLine(msg: string) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  try {
    ensureDir(path.dirname(LOG_FILE));
    fs.appendFileSync(LOG_FILE, line, 'utf8');
  } catch { /* ignore */ }
  process.stdout.write(line);
}

export async function runDailyBackup(): Promise<void> {
  const dbPath = path.join(DATA_DIR, DB_FILENAME);
  if (!fs.existsSync(dbPath)) {
    logLine(`ERROR: db not found: ${dbPath}`);
    return;
  }
  ensureDir(BACKUP_DIR);

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const destFile = path.join(BACKUP_DIR, `resident-system-${today}.db`);

  if (fs.existsSync(destFile)) {
    logLine(`skip: today's backup already exists (${destFile})`);
    return;
  }

  try {
    fs.copyFileSync(dbPath, destFile);
    const stat = fs.statSync(destFile);
    logLine(`backup OK: ${destFile} (${(stat.size / 1024).toFixed(1)} KB)`);
  } catch (e: any) {
    logLine(`backup FAIL: ${e?.message ?? e}`);
    return;
  }

  // 清理超過 KEEP_DAYS 的舊備份
  const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    let removed = 0;
    for (const f of files) {
      if (!f.startsWith('resident-system-')) continue;
      const fp = path.join(BACKUP_DIR, f);
      const st = fs.statSync(fp);
      if (st.mtimeMs < cutoff) {
        fs.unlinkSync(fp);
        removed++;
        logLine(`cleanup old: ${f}`);
      }
    }
    if (removed > 0) logLine(`cleanup removed ${removed} old backups`);
  } catch (e: any) {
    logLine(`cleanup FAIL: ${e?.message ?? e}`);
  }
}

export function startBackupCron(): void {
  // 每日 02:00
  cron.schedule('0 2 * * *', () => {
    logLine('--- daily backup trigger ---');
    runDailyBackup().catch((e) => logLine(`runDailyBackup EXC: ${e?.message ?? e}`));
  });
  logLine(`daily backup cron scheduled (02:00 daily, ${KEEP_DAYS}-day retention)`);
}