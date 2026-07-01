/**
 * 命令列參數解析
 * 支援：--key=value、--key value、--flag、布林 -x 形式
 */

export interface ParsedArgs {
  positional: string[];
  flags: Record<string, string | boolean | number>;
  format: string;
  dryRun: boolean;
  quiet: boolean;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | boolean | number> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      if (eqIdx > 0) {
        // --key=value
        const key = arg.slice(2, eqIdx);
        const value = parseValue(arg.slice(eqIdx + 1));
        flags[key] = value;
      } else {
        // --key 或 --key value 或 --flag
        const key = arg.slice(2);
        const next = argv[i + 1];
        if (next && !next.startsWith('--')) {
          // --key value
          flags[key] = parseValue(next);
          i++;
        } else {
          // --flag
          flags[key] = true;
        }
      }
    } else if (arg.startsWith('-') && arg.length > 1) {
      // 短選項 -x 或 -xyz (boolean cluster)
      const chars = arg.slice(1);
      for (const ch of chars) {
        flags[ch] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return {
    positional,
    flags,
    format: 'json',
    dryRun: false,
    quiet: false,
  };
}

function parseValue(raw: string): string | number | boolean {
  // 數字
  if (/^-?\d+$/.test(raw)) return parseInt(raw, 10);
  if (/^-?\d*\.\d+$/.test(raw)) return parseFloat(raw);
  // 布林
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  // 字串
  return raw;
}
