/**
 * CLI 入口
 * v4-cli 是大樓住戶系統 V4 的命令列工具，提供 HTTP 介面供 AGENT 讀寫資料。
 *
 * 用法：
 *   v4-cli <resource> <action> [flags]
 *   v4-cli <resource> create --from-file data.json
 *   v4-cli residents list --format=table
 *   v4-cli residents create --ownerName=王大明 --floor=3F --buildingId=xxx
 *   v4-cli --help
 */

import { parseArgs, ParsedArgs } from './argparse.js';
import { output, OutputFormat } from './output.js';
import { commandRegistry, listResources } from './commands/index.js';
import { createHttpClient, HttpClient } from './http.js';

const VERSION = '1.0.0';

function printGlobalHelp() {
  output.raw(`v4-cli ${VERSION} - 大樓住戶系統 V4 命令列工具

用法:
  v4-cli <resource> <action> [flags]
  v4-cli <resource> <action> --from-file <path>
  v4-cli --help
  v4-cli --version

可用資源:
${listResources().map((r) => `  ${r}`).join('\n')}

全域選項:
  --api-url=<url>       API 伺服器網址 (預設: http://localhost:9527)
  --format=<fmt>        輸出格式: json | table | csv (預設: json)
  --from-file=<path>    從 JSON 檔案批次執行
  --output-file=<path>  將輸出寫入檔案
  --dry-run             只預覽，不實際執行
  --quiet               抑制非錯誤輸出
  --help, -h            顯示說明
  --version, -v         顯示版本

範例:
  v4-cli residents list
  v4-cli residents list --format=table --search=王
  v4-cli residents create --ownerName=王大明 --floor=3F --buildingId=b1
  v4-cli residents create --from-file=new-residents.json
  v4-cli expenses create --type=expense --amount=500 --categoryId=c1 --date=2024-01-15
`);
}

async function executeFromFile(
  cmd: ReturnType<typeof commandRegistry.get>,
  client: HttpClient,
  filePath: string,
  globalOpts: ParsedArgs
): Promise<void> {
  const fs = await import('fs/promises');
  const content = await fs.readFile(filePath, 'utf-8');
  const items = JSON.parse(content);

  if (!Array.isArray(items)) {
    // 單筆模式
    const result = await cmd!.handler(client, items, {
      ...globalOpts,
      flags: globalOpts.flags,
    });
    output.result(result, globalOpts.format as OutputFormat);
    return;
  }

  // 批次模式
  const results: any[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const result = await cmd!.handler(client, item, {
        ...globalOpts,
        flags: globalOpts.flags,
      });
      results.push({ index: i, status: 'ok', data: result });
      if (!globalOpts.quiet) {
        output.info(`[${i + 1}/${items.length}] ✓ ${item.id || item.title || 'item'}`);
      }
    } catch (err: any) {
      results.push({ index: i, status: 'error', error: err.message, input: item });
      output.error(`[${i + 1}/${items.length}] ✗ ${err.message}`);
    }
  }

  const summary = {
    total: items.length,
    success: results.filter((r) => r.status === 'ok').length,
    failed: results.filter((r) => r.status === 'error').length,
    results,
  };
  output.result(summary, globalOpts.format as OutputFormat);
}

async function main() {
  const argv = process.argv.slice(2);

  // 全域參數
  if (argv.includes('--version') || argv.includes('-v')) {
    console.log(`v4-cli ${VERSION}`);
    return;
  }
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    printGlobalHelp();
    return;
  }

  const parsed = parseArgs(argv);

  // 解析全域旗標
  const apiUrl = (parsed.flags['api-url'] as string) || process.env.V4_API_URL || 'http://localhost:9527';
  const format = ((parsed.flags['format'] as string) || 'json') as OutputFormat;
  const fromFile = parsed.flags['from-file'] as string | undefined;
  const outputFile = parsed.flags['output-file'] as string | undefined;
  const dryRun = !!parsed.flags['dry-run'];
  const quiet = !!parsed.flags['quiet'];

  if (!['json', 'table', 'csv'].includes(format)) {
    output.error(`無效的 --format: ${format}（應為 json|table|csv）`);
    process.exit(2);
  }

  // 路由
  const [resource, action] = parsed.positional;
  if (!resource) {
    output.error('請指定資源，例如：v4-cli residents list');
    process.exit(2);
  }

  const cmd = commandRegistry.get(resource, action || '');
  if (!cmd) {
    const resources = listResources();
    if (!resources.includes(resource)) {
      output.error(`找不到資源「${resource}」。可用：${resources.join(', ')}`);
    } else {
      const actions = commandRegistry.listActions(resource);
      output.error(`資源「${resource}」需要動作。可用：${actions.join(', ')}`);
    }
    process.exit(2);
  }

  const client = createHttpClient({ baseUrl: apiUrl, dryRun });

  // 健康檢查（除非 quiet 或 dry-run）
  if (!dryRun && !quiet) {
    try {
      await client.get('/api/health');
    } catch (err: any) {
      output.error(`無法連線到 ${apiUrl}：${err.message}`);
      output.error('請確認後端伺服器是否已啟動，或用 --api-url 指定正確網址');
      process.exit(3);
    }
  }

  // 全域設定寫回 parsed
  parsed.format = format;
  parsed.dryRun = dryRun;
  parsed.quiet = quiet;

  try {
    if (fromFile) {
      await executeFromFile(cmd, client, fromFile, parsed);
    } else {
      const result = await cmd.handler(client, parsed.flags, parsed);
      if (outputFile) {
        const fs = await import('fs/promises');
        await fs.writeFile(outputFile, JSON.stringify(result, null, 2), 'utf-8');
        if (!quiet) output.info(`已寫入 ${outputFile}`);
      } else {
        output.result(result, format);
      }
    }
  } catch (err: any) {
    output.error(err.message);
    if (process.env.V4_CLI_DEBUG) {
      console.error(err);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  output.error(`未預期的錯誤：${err.message}`);
  if (process.env.V4_CLI_DEBUG) {
    console.error(err);
  }
  process.exit(99);
});
