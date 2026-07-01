/**
 * 命令註冊表
 * 每個資源 (residents, expenses, ...) 註冊自己的子命令
 */

import type { HttpClient } from '../http.js';
import type { ParsedArgs } from '../argparse.js';

export interface CommandContext {
  client: HttpClient;
  flags: Record<string, string | boolean | number>;
  global: ParsedArgs;
}

export interface Command {
  /** 命令名稱 (e.g. 'list', 'create', 'get') */
  name: string;
  /** 簡短描述 */
  description: string;
  /** 命令處理器 */
  handler: (client: HttpClient, flags: Record<string, any>, ctx: ParsedArgs) => Promise<any>;
  /** 範例 (顯示在 --help) */
  examples?: string[];
  /** 需要的旗標 (用於 --help 提示) */
  requiredFlags?: string[];
}

export class CommandRegistry {
  private resources = new Map<string, Map<string, Command>>();

  register(resource: string, command: Command) {
    if (!this.resources.has(resource)) {
      this.resources.set(resource, new Map());
    }
    this.resources.get(resource)!.set(command.name, command);
  }

  get(resource: string, action: string): Command | undefined {
    return this.resources.get(resource)?.get(action);
  }

  listResources(): string[] {
    return Array.from(this.resources.keys()).sort();
  }

  listActions(resource: string): string[] {
    const res = this.resources.get(resource);
    return res ? Array.from(res.keys()) : [];
  }

  listCommandsForResource(resource: string): Command[] {
    return Array.from(this.resources.get(resource)?.values() || []);
  }
}

export const commandRegistry = new CommandRegistry();

export function listResources(): string[] {
  return commandRegistry.listResources();
}
