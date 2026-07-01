// 用雲端硬碟跑 backup test
process.env.DATA_DIR = 'G:\\我的雲端硬碟\\V4住戶管理';
console.log('[wrapper] DATA_DIR =', process.env.DATA_DIR);
await import('./test-backup.mjs');