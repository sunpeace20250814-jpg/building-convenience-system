// 測試 daily backup job（手動觸發一次）
import { runDailyBackup } from './src/jobs/dailyBackup.js';

console.log('=== V4 Daily Backup Test ===');
await runDailyBackup();
console.log('=== Done ===');
process.exit(0);