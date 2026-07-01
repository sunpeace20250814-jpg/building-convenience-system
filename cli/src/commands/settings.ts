/**
 * Settings 命令
 */

import { registerCrudCommands } from './_crud.js';
import { commandRegistry } from './_registry.js';

registerCrudCommands({
  resource: 'statuses',
  basePath: '/api/settings/status',
  idField: 'id',
});

registerCrudCommands({
  resource: 'buildings',
  basePath: '/api/settings/buildings',
  idField: 'id',
});

registerCrudCommands({
  resource: 'parking',
  basePath: '/api/settings/parking',
  idField: 'id',
});

commandRegistry.register('statuses', {
  name: 'by-type',
  description: '列出指定類型的狀態（resident/parking）',
  handler: async (client, flags) => {
    const type = flags.type as string;
    if (!type) throw new Error('請用 --type=resident 或 --type=parking');
    return client.get(`/api/settings/status/type/${encodeURIComponent(type)}`);
  },
  requiredFlags: ['type'],
  examples: ['v4-cli statuses by-type --type=resident'],
});

commandRegistry.register('parking', {
  name: 'by-building',
  description: '列出某建築的所有停車位',
  handler: async (client, flags) => {
    const id = flags['building-id'] as string;
    if (!id) throw new Error('請用 --building-id=xxx');
    return client.get(`/api/settings/parking/building/${encodeURIComponent(id)}`);
  },
  requiredFlags: ['building-id'],
  examples: ['v4-cli parking by-building --building-id=b1'],
});
