/**
 * V4 Backup Manager
 *
 * 備份策略：
 *   - 每次觸發（startup / hourly / shutdown）：把 resident-system.db copy 到 backups/auto/
 *     並保留最近 30 個備份（超過自動刪最舊的）
 *   - 如果距離上次備份不到 1 小時（hourly），跳過
 *   - 如果距離上次備份不到 23 小時（daily），跳過 daily 標記
 *   - 檔名：resident-system-{timestamp}.db
 *   - 日誌：backups/backup.log
 *
 * 觸發方式（由 server/src/index.ts 呼叫）：
 *   - startup：initDatabase() 後呼叫 BackupManager.startup()
 *   - hourly：node-cron 每小時觸發
 *   - shutdown：process.on('SIGINT'/'SIGTERM')
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface BackupOptions {
  /** 備份保留天數（預設 30 天） */
  retainDays?: number;
  /** hourly 最小間隔（ms，預設 55 分鐘） */
  hourlyInterval?: number;
  /** daily 最小間隔（ms，預設 23 小時） */
  dailyInterval?: number;
}

export class BackupManager {
  private dataDir: string;
  private backupDir: string;
  private logFile: string;
  private retainDays: number;
  private hourlyInterval: number;
  private dailyInterval: number;
  private lastBackupFile: string; // 記錄上次備份檔名

  constructor(dataDir: string, opts: BackupOptions = {}) {
    this.dataDir = dataDir;
    this.backupDir = path.join(dataDir, 'backups', 'auto');
    this.logFile = path.join(this.backupDir, 'backup.log');
    this.retainDays = opts.retainDays ?? 30;
    this.hourlyInterval = opts.hourlyInterval ?? 55 * 60 * 1000;
    this.dailyInterval = opts.dailyInterval ?? 23 * 60 * 60 * 1000;
    this.lastBackupFile = path.join(this.backupDir, '.last-backup');
    this.ensureDir(this.backupDir);
  }

  private ensureDir(dir: string) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  private log(msg: string) {
    const ts = new Date().toISOString();
    const line = `[${ts}] ${msg}\n`;
    try {
      fs.appendFileSync(this.logFile, line, 'utf8');
    } catch {}
    process.stdout.write(line);
  }

  private dbPath() {
    return path.join(this.dataDir, 'resident-system.db');
  }

  /** 讀上次備份時間 */
  private getLastBackupTime(): number {
    try {
      const raw = fs.readFileSync(this.lastBackupFile, 'utf8').trim();
      return parseInt(raw, 10) || 0;
    } catch {
      return 0;
    }
  }

  private setLastBackupTime(ts: number) {
    try {
      fs.writeFileSync(this.lastBackupFile, String(ts), 'utf8');
    } catch {}
  }

  /** 是否可做 hourly 備份 */
  canHourly(): boolean {
    return Date.now() - this.getLastBackupTime() > this.hourlyInterval;
  }

  /** 是否可做 daily 備份 */
  canDaily(): boolean {
    return Date.now() - this.getLastBackupTime() > this.dailyInterval;
  }

  /**
   * 執行一次備份
   * type: 'startup' | 'hourly' | 'daily' | 'shutdown'
   */
  async run(type: 'startup' | 'hourly' | 'daily' | 'shutdown'): Promise<void> {
    const dbPath = this.dbPath();
    if (!fs.existsSync(dbPath)) {
      this.log(`[${type}] SKIP: db not found at ${dbPath}`);
      return;
    }

    const now = Date.now();
    const last = this.getLastBackupTime();
    const sinceLast = now - last;

    // 邏輯：startup 每次都做（用戶開程式一定備份一次）
    // hourly 至少間隔 55 分鐘
    // daily 至少間隔 23 小時
    // shutdown 每次都做
    if (type === 'hourly' && !this.canHourly()) {
      this.log(`[hourly] SKIP: 距離上次 ${Math.round(sinceLast / 60000)} 分鐘，少於 ${Math.round(this.hourlyInterval / 60000)} 分鐘`);
      return;
    }
    if (type === 'daily' && !this.canDaily()) {
      this.log(`[daily] SKIP: 距離上次 ${Math.round(sinceLast / 3600000)} 小時，少於 ${Math.round(this.dailyInterval / 3600000)} 小時`);
      return;
    }

    const dateStr = new Date(now).toISOString().slice(0, 19).replace(/[T:]/g, '-');
    const destFile = path.join(this.backupDir, `resident-system-${dateStr}.db`);

    if (fs.existsSync(destFile)) {
      this.log(`[${type}] SKIP: 今日備份已存在 (${destFile})`);
      return;
    }

    try {
      fs.copyFileSync(dbPath, destFile);
      const stat = fs.statSync(destFile);
      this.setLastBackupTime(now);
      this.log(`[${type}] OK: ${destFile} (${(stat.size / 1024).toFixed(1)} KB)`);
    } catch (e: any) {
      this.log(`[${type}] FAIL: ${e?.message ?? e}`);
      return;
    }

    // 清理超過 retainDays 的舊備份
    this.cleanup();
  }

  /** 刪除超過保留期的備份 */
  private cleanup() {
    const cutoff = Date.now() - this.retainDays * 24 * 60 * 60 * 1000;
    try {
      const files = fs.readdirSync(this.backupDir);
      let removed = 0;
      for (const f of files) {
        if (!f.startsWith('resident-system-') || !f.endsWith('.db')) continue;
        const fp = path.join(this.backupDir, f);
        const st = fs.statSync(fp);
        if (st.mtimeMs < cutoff) {
          fs.unlinkSync(fp);
          removed++;
          this.log(`  cleanup: ${f}`);
        }
      }
      if (removed > 0) this.log(`  cleanup removed ${removed} old backups`);
    } catch (e: any) {
      this.log(`cleanup FAIL: ${e?.message ?? e}`);
    }
  }

  /** startup 備份（每次開程式必做一次） */
  async startup() { await this.run('startup'); }

  /** hourly 備份（排程觸發） */
  async hourly() { await this.run('hourly'); }

  /** daily 備份（排程觸發） */
  async daily() { await this.run('daily'); }

  /** shutdown 備份（優雅關閉觸發） */
  async shutdown() { await this.run('shutdown'); }
}
