/**
 * Home Tabs 命令
 */

import { registerCrudCommands } from './_crud.js';
import { commandRegistry } from './_registry.js';

registerCrudCommands({
  resource: 'home-tabs',
  basePath: '/api/home-tabs',
  idField: 'id',
});

registerCrudCommands({
  resource: 'home-records',
  basePath: '/api/home-tabs/records',
  idField: 'id',
});

commandRegistry.register('home-records', {
  name: 'by-tab',
  description: '列出某標籤下的所有公告',
  handler: async (client, flags) => {
    const id = flags['tab-id'] as string;
    if (!id) throw new Error('請用 --tab-id=xxx');
    return client.get(`/api/home-tabs/records/tab/${encodeURIComponent(id)}`);
  },
  requiredFlags: ['tab-id'],
  examples: ['v4-cli home-records by-tab --tab-id=t1'],
});
