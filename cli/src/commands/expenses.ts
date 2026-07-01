/**
 * Expenses 命令
 */

import { registerCrudCommands } from './_crud.js';
import { commandRegistry } from './_registry.js';

registerCrudCommands({
  resource: 'expenses',
  basePath: '/api/expenses',
  idField: 'id',
});

// 類別
registerCrudCommands({
  resource: 'expense-categories',
  basePath: '/api/expenses/categories',
  idField: 'id',
});

commandRegistry.register('expense-categories', {
  name: 'by-type',
  description: '列出指定類型的類別（income/expense）',
  handler: async (client, flags) => {
    const type = flags.type as string;
    if (!type) throw new Error('請用 --type=income 或 --type=expense');
    return client.get(`/api/expenses/categories/type/${encodeURIComponent(type)}`);
  },
  requiredFlags: ['type'],
  examples: ['v4-cli expense-categories by-type --type=expense'],
});

// 零用金持有人
registerCrudCommands({
  resource: 'allowance-holders',
  basePath: '/api/expenses/allowance',
  idField: 'id',
});

commandRegistry.register('allowance-holders', {
  name: 'list-transactions',
  description: '列出某持有人的所有交易',
  handler: async (client, flags) => {
    const id = flags['holder-id'] || flags['id'] as string;
    if (!id) throw new Error('請用 --holder-id=xxx 指定持有人');
    return client.get(`/api/expenses/allowance/${encodeURIComponent(id)}/transactions`);
  },
  requiredFlags: ['holder-id'],
  examples: ['v4-cli allowance-holders list-transactions --holder-id=h123'],
});

commandRegistry.register('allowance-holders', {
  name: 'add-transaction',
  description: '新增零用金交易（會自動更新餘額）',
  handler: async (client, flags) => {
    const id = flags['holder-id'] as string;
    if (!id) throw new Error('請用 --holder-id=xxx 指定持有人');
    const body: any = {
      date: flags.date,
      amount: Number(flags.amount),
      type: flags.type, // 'add' 或 'deduct'
      description: flags.description,
    };
    return client.post(`/api/expenses/allowance/${encodeURIComponent(id)}/transactions`, body);
  },
  requiredFlags: ['holder-id', 'date', 'amount', 'type'],
  examples: ['v4-cli allowance-holders add-transaction --holder-id=h123 --date=2024-01-15 --amount=1000 --type=add --description=初始'],
});

// 日期範圍查詢
commandRegistry.register('expenses', {
  name: 'range',
  description: '列出日期範圍內的收支',
  handler: async (client, flags) => {
    const start = flags.start as string;
    const end = flags.end as string;
    if (!start || !end) throw new Error('請用 --start=YYYY-MM-DD --end=YYYY-MM-DD');
    return client.get('/api/expenses/range', { query: { start, end } });
  },
  requiredFlags: ['start', 'end'],
  examples: ['v4-cli expenses range --start=2024-01-01 --end=2024-01-31'],
});
