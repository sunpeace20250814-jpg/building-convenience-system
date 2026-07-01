/**
 * Residents 命令
 */

import { registerCrudCommands } from './_crud.js';
import { commandRegistry } from './_registry.js';
import type { HttpClient } from '../http.js';

registerCrudCommands({
  resource: 'residents',
  basePath: '/api/residents',
  idField: 'id',
  searchField: 'search',
  searchParam: 'q',
});

// 子資源：members
commandRegistry.register('residents', {
  name: 'list-members',
  description: '列出某住戶的所有家庭成員',
  handler: async (client, flags) => {
    const id = flags['resident-id'] || flags['id'] as string;
    if (!id) throw new Error('請用 --resident-id=xxx 或 --id=xxx 指定住戶');
    return client.get(`/api/residents/${encodeURIComponent(id)}/members`);
  },
  requiredFlags: ['resident-id'],
  examples: ['v4-cli residents list-members --resident-id=r123'],
});

commandRegistry.register('residents', {
  name: 'add-member',
  description: '為某住戶新增家庭成員',
  handler: async (client, flags) => {
    const id = flags['resident-id'] || flags['id'] as string;
    if (!id) throw new Error('請用 --resident-id=xxx 指定住戶');
    const body: any = { name: flags.name };
    if (flags.phone) body.phone = flags.phone;
    if (flags.relationship) body.relationship = flags.relationship;
    return client.post(`/api/residents/${encodeURIComponent(id)}/members`, body);
  },
  requiredFlags: ['resident-id', 'name'],
  examples: ['v4-cli residents add-member --resident-id=r123 --name=王小明 --relationship=兒子'],
});

commandRegistry.register('residents', {
  name: 'remove-member',
  description: '刪除某住戶的家庭成員',
  handler: async (client, flags) => {
    const id = flags['resident-id'] as string;
    const memberId = flags['member-id'] as string;
    if (!id) throw new Error('請用 --resident-id=xxx 指定住戶');
    if (!memberId) throw new Error('請用 --member-id=xxx 指定成員');
    return client.delete(`/api/residents/${encodeURIComponent(id)}/members/${encodeURIComponent(memberId)}`);
  },
  requiredFlags: ['resident-id', 'member-id'],
  examples: ['v4-cli residents remove-member --resident-id=r123 --member-id=m456'],
});

// 子資源：keycards
commandRegistry.register('residents', {
  name: 'list-keycards',
  description: '列出某住戶的所有鑰匙卡',
  handler: async (client, flags) => {
    const id = flags['resident-id'] || flags['id'] as string;
    if (!id) throw new Error('請用 --resident-id=xxx 指定住戶');
    return client.get(`/api/residents/${encodeURIComponent(id)}/keycards`);
  },
  requiredFlags: ['resident-id'],
  examples: ['v4-cli residents list-keycards --resident-id=r123'],
});

commandRegistry.register('residents', {
  name: 'add-keycard',
  description: '為某住戶新增鑰匙卡',
  handler: async (client, flags) => {
    const id = flags['resident-id'] || flags['id'] as string;
    if (!id) throw new Error('請用 --resident-id=xxx 指定住戶');
    const body: any = { cardNumber: flags['card-number'] || flags.cardNumber };
    if (flags.note) body.note = flags.note;
    return client.post(`/api/residents/${encodeURIComponent(id)}/keycards`, body);
  },
  requiredFlags: ['resident-id', 'card-number'],
  examples: ['v4-cli residents add-keycard --resident-id=r123 --card-number=A001'],
});

commandRegistry.register('residents', {
  name: 'remove-keycard',
  description: '刪除某住戶的鑰匙卡',
  handler: async (client, flags) => {
    const id = flags['resident-id'] as string;
    const kcId = flags['keycard-id'] as string;
    if (!id) throw new Error('請用 --resident-id=xxx 指定住戶');
    if (!kcId) throw new Error('請用 --keycard-id=xxx 指定鑰匙卡');
    return client.delete(`/api/residents/${encodeURIComponent(id)}/keycards/${encodeURIComponent(kcId)}`);
  },
  requiredFlags: ['resident-id', 'keycard-id'],
  examples: ['v4-cli residents remove-keycard --resident-id=r123 --keycard-id=k789'],
});
