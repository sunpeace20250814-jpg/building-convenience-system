/**
 * Schedule 命令
 */

import { registerCrudCommands } from './_crud.js';
import { commandRegistry } from './_registry.js';

registerCrudCommands({
  resource: 'schedule',
  basePath: '/api/schedule',
  idField: 'id',
});

registerCrudCommands({
  resource: 'shifts',
  basePath: '/api/schedule/shifts',
  idField: 'id',
});

registerCrudCommands({
  resource: 'employees',
  basePath: '/api/schedule/employees',
  idField: 'id',
});

registerCrudCommands({
  resource: 'holidays',
  basePath: '/api/schedule/holidays',
  idField: 'id',
});

// 國定假日 by year
commandRegistry.register('holidays', {
  name: 'by-year',
  description: '列出某年的國定假日',
  handler: async (client, flags) => {
    const year = flags.year ? Number(flags.year) : new Date().getFullYear();
    return client.get(`/api/schedule/holidays/year/${year}`);
  },
  examples: ['v4-cli holidays by-year --year=2024'],
});

// 國定假日 by date
commandRegistry.register('holidays', {
  name: 'by-date',
  description: '查詢某日是否為假日',
  handler: async (client, flags) => {
    const date = flags.date as string;
    if (!date) throw new Error('請用 --date=YYYY-MM-DD');
    return client.get(`/api/schedule/holidays/date/${encodeURIComponent(date)}`);
  },
  requiredFlags: ['date'],
  examples: ['v4-cli holidays by-date --date=2024-10-10'],
});

// 班表依日期查詢
commandRegistry.register('schedule', {
  name: 'by-date',
  description: '查詢某日的班表',
  handler: async (client, flags) => {
    const date = flags.date as string;
    if (!date) throw new Error('請用 --date=YYYY-MM-DD');
    return client.get(`/api/schedule/date/${encodeURIComponent(date)}`);
  },
  requiredFlags: ['date'],
  examples: ['v4-cli schedule by-date --date=2024-01-15'],
});

commandRegistry.register('schedule', {
  name: 'by-range',
  description: '查詢日期範圍內的班表',
  handler: async (client, flags) => {
    const start = flags.start as string;
    const end = flags.end as string;
    if (!start || !end) throw new Error('請用 --start=YYYY-MM-DD --end=YYYY-MM-DD');
    return client.get(`/api/schedule/range`, { query: { start, end } });
  },
  requiredFlags: ['start', 'end'],
  examples: ['v4-cli schedule by-range --start=2024-01-01 --end=2024-01-31'],
});
