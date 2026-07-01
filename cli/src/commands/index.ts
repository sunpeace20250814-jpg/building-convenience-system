/**
 * 所有命令的入口
 * 載入時自動註冊到 commandRegistry
 */

import './residents.js';
import './expenses.js';
import './schedule.js';
import './settings.js';
import './home-tabs.js';

// 健康檢查 + 系統資訊
import { commandRegistry } from './_registry.js';

commandRegistry.register('system', {
  name: 'ping',
  description: '檢查後端連線',
  handler: async (client) => {
    const health = await client.get('/api/health');
    const info = await client.get('/api/info').catch(() => null);
    return { health, info };
  },
  examples: ['v4-cli system ping'],
});

commandRegistry.register('system', {
  name: 'schema',
  description: '顯示所有可用資源和動作',
  handler: async () => {
    const { commandRegistry: reg } = await import('./_registry.js');
    const resources = reg.listResources();
    const schema: Record<string, string[]> = {};
    for (const r of resources) {
      schema[r] = reg.listActions(r);
    }
    return schema;
  },
  examples: ['v4-cli system schema'],
});
