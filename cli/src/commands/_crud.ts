/**
 * 通用 CRUD 命令產生器
 * 大部分資源都有標準的 list/get/create/update/delete/search 模式
 */

import type { HttpClient } from '../http.js';
import type { Command } from './_registry.js';
import { commandRegistry } from './_registry.js';

export interface CrudConfig {
  resource: string;        // 'residents'
  basePath: string;        // '/api/residents'
  idField: string;         // 'id' (default: 'id')
  searchField?: string;    // 搜尋 URL path
  searchParam?: string;    // 搜尋 query 參數名
  hasBatch?: boolean;      // 是否支援批次查詢（用 in: 過濾）
}

/**
 * 註冊標準 CRUD 命令
 */
export function registerCrudCommands(config: CrudConfig) {
  const { resource, basePath, idField = 'id' } = config;

  // LIST
  commandRegistry.register(resource, {
    name: 'list',
    description: `列出所有${resource}`,
    handler: async (client, flags) => {
      const limit = flags.limit ? Number(flags.limit) : undefined;
      const offset = flags.offset ? Number(flags.offset) : undefined;
      return client.get(basePath, {
        query: { limit, offset },
      });
    },
    examples: [
      `v4-cli ${resource} list`,
      `v4-cli ${resource} list --format=table`,
      `v4-cli ${resource} list --limit=10`,
    ],
  } as Command);

  // GET
  commandRegistry.register(resource, {
    name: 'get',
    description: `取得單筆${resource}`,
    handler: async (client, flags) => {
      const id = flags[idField] as string;
      if (!id) throw new Error(`請用 --${idField}=... 指定 ID`);
      return client.get(`${basePath}/${encodeURIComponent(id)}`);
    },
    requiredFlags: [idField],
    examples: [`v4-cli ${resource} get --${idField}=xxx`],
  } as Command);

  // CREATE
  commandRegistry.register(resource, {
    name: 'create',
    description: `新增${resource}`,
    handler: async (client, flags) => {
      const body = flagsToBody(flags, [idField, 'from-file', 'output-file', 'api-url', 'format', 'dry-run', 'quiet']);
      return client.post(basePath, body);
    },
    examples: [
      `v4-cli ${resource} create --field1=value1 --field2=value2`,
      `v4-cli ${resource} create --from-file=batch.json`,
    ],
  } as Command);

  // UPDATE
  commandRegistry.register(resource, {
    name: 'update',
    description: `更新${resource}`,
    handler: async (client, flags) => {
      const id = flags[idField] as string;
      if (!id) throw new Error(`請用 --${idField}=... 指定 ID`);
      const body = flagsToBody(flags, [idField, 'from-file', 'output-file', 'api-url', 'format', 'dry-run', 'quiet']);
      return client.put(`${basePath}/${encodeURIComponent(id)}`, body);
    },
    requiredFlags: [idField],
    examples: [`v4-cli ${resource} update --${idField}=xxx --field=newvalue`],
  } as Command);

  // PATCH
  commandRegistry.register(resource, {
    name: 'patch',
    description: `部分更新${resource}（部分欄位）`,
    handler: async (client, flags) => {
      const id = flags[idField] as string;
      if (!id) throw new Error(`請用 --${idField}=... 指定 ID`);
      const body = flagsToBody(flags, [idField, 'from-file', 'output-file', 'api-url', 'format', 'dry-run', 'quiet']);
      return client.patch(`${basePath}/${encodeURIComponent(id)}`, body);
    },
    requiredFlags: [idField],
    examples: [`v4-cli ${resource} patch --${idField}=xxx --statusId=newStatus`],
  } as Command);

  // DELETE
  commandRegistry.register(resource, {
    name: 'delete',
    description: `刪除${resource}`,
    handler: async (client, flags) => {
      const id = flags[idField] as string;
      if (!id) throw new Error(`請用 --${idField}=... 指定 ID`);
      return client.delete(`${basePath}/${encodeURIComponent(id)}`);
    },
    requiredFlags: [idField],
    examples: [`v4-cli ${resource} delete --${idField}=xxx`],
  } as Command);

  // SEARCH (如果配置了)
  if (config.searchField && config.searchParam) {
    commandRegistry.register(resource, {
      name: 'search',
      description: `搜尋${resource}（依 ${config.searchField}）`,
      handler: async (client, flags) => {
        const q = (flags.q || flags.query || flags.search) as string;
        if (!q) throw new Error('請用 --q=keyword 指定搜尋字串');
        return client.get(`${basePath}/${config.searchField}`, { query: { [config.searchParam!]: q } });
      },
      requiredFlags: ['q'],
      examples: [`v4-cli ${resource} search --q=王`],
    } as Command);
  }
}

/**
 * 把 flags 物件轉成 API body
 * 排除內部/CLI 旗標
 */
export function flagsToBody(
  flags: Record<string, any>,
  exclude: string[] = ['from-file', 'output-file', 'api-url', 'format', 'dry-run', 'quiet']
): Record<string, any> {
  const body: Record<string, any> = {};
  for (const [k, v] of Object.entries(flags)) {
    if (exclude.includes(k)) continue;
    if (v === true) continue; // 跳過純 boolean 旗標
    body[k] = v;
  }
  return body;
}
