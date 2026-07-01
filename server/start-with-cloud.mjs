// V4 Server 啟動包裝：設定 DATA_DIR 為用戶雲端硬碟路徑
// 解決 PowerShell 5.1 中文字符 set 環境變數的編碼問題
// 用法：node start-with-cloud.mjs
process.env.DATA_DIR = 'G:\\我的雲端硬碟\\V4住戶管理';
process.env.PORT = process.env.PORT || '3001';
console.log('[wrapper] DATA_DIR=' + process.env.DATA_DIR);
console.log('[wrapper] PORT=' + process.env.PORT);
await import('./src/index.ts');