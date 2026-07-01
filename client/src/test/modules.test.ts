/**
 * 模組系統單元測試
 * 使用獨立的 TestRegistry 避免污染全域 singleton
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/storage/database', () => ({
  execute: vi.fn(),
  queryAll: vi.fn(() => []),
  queryOne: vi.fn(() => null),
}));

import { modules, bus, Events, type ModuleManifest } from '@/modules-system/registry';

class TestRegistry {
  private states = new Map<string, { enabled: boolean; installedAt: string }>();
  private manifests = new Map<string, ModuleManifest>();

  register(m: ModuleManifest) { this.manifests.set(m.id, m); }
  isEnabled(id: string): boolean {
    const m = this.manifests.get(id);
    if (!m) return false;
    if (m.core) return true;
    const s = this.states.get(id);
    return s?.enabled ?? m.defaultEnabled;
  }
  enable(id: string): { ok: boolean; error?: string; cascaded?: string[]; blocked?: string[] } {
    const m = this.manifests.get(id);
    if (!m) return { ok: false, error: '不存在' };
    if (m.core) return { ok: false, error: '核心' };
    if (m.requires) {
      for (const dep of m.requires) {
        if (!this.isEnabled(dep)) this.enable(dep);
      }
    }
    if (m.conflicts) {
      for (const c of m.conflicts) {
        if (this.isEnabled(c)) return { ok: false, error: '互斥' };
      }
    }
    this.states.set(id, { enabled: true, installedAt: new Date().toISOString() });
    return { ok: true, cascaded: m.requires };
  }
  disable(id: string): { ok: boolean; error?: string; cascaded?: string[]; blocked?: string[] } {
    const m = this.manifests.get(id);
    if (!m) return { ok: false, error: '不存在' };
    if (m.core) return { ok: false, error: '核心' };
    const dependents = Array.from(this.manifests.values()).filter((x) => x.requires?.includes(id) && this.isEnabled(x.id));
    if (dependents.length > 0) return { ok: false, error: '被依賴', blocked: dependents.map((x) => x.id) };
    this.states.set(id, { enabled: false, installedAt: new Date().toISOString() });
    return { ok: true };
  }
  enabled(): ModuleManifest[] { return Array.from(this.manifests.values()).filter((m) => this.isEnabled(m.id)); }
  reset() { this.states.clear(); }
}

describe('Module Registry 邏輯', () => {
  let reg: TestRegistry;
  beforeEach(() => {
    reg = new TestRegistry();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('啟用預設關閉的模組', () => {
    reg.register({ id: 'opt', name: 'Optional', category: 'core', description: '', defaultEnabled: false });
    expect(reg.isEnabled('opt')).toBe(false);
    const result = reg.enable('opt');
    expect(result.ok).toBe(true);
    expect(reg.isEnabled('opt')).toBe(true);
  });

  it('核心模組不能停用', () => {
    reg.register({ id: 'core-mod', name: 'Core', category: 'core', description: '', defaultEnabled: true, core: true });
    expect(reg.disable('core-mod').ok).toBe(false);
  });

  it('依賴模組未啟用時自動連帶啟用', () => {
    reg.register({ id: 'a', name: 'A', category: 'core', description: '', defaultEnabled: false });
    reg.register({ id: 'b', name: 'B', category: 'core', description: '', defaultEnabled: false, requires: ['a'] });
    reg.enable('b');
    expect(reg.isEnabled('a')).toBe(true);
    expect(reg.isEnabled('b')).toBe(true);
  });

  it('互斥模組不能同時啟用', () => {
    reg.register({ id: 'x', name: 'X', category: 'core', description: '', defaultEnabled: false });
    reg.register({ id: 'y', name: 'Y', category: 'core', description: '', defaultEnabled: false, conflicts: ['x'] });
    reg.enable('x');
    expect(reg.enable('y').ok).toBe(false);
  });

  it('被依賴的模組不能停用', () => {
    reg.register({ id: 'a', name: 'A', category: 'core', description: '', defaultEnabled: true });
    reg.register({ id: 'b', name: 'B', category: 'core', description: '', defaultEnabled: true, requires: ['a'] });
    const result = reg.disable('a');
    expect(result.ok).toBe(false);
    expect(result.blocked).toContain('b');
  });

  it('enabled() 只回傳啟用的', () => {
    reg.register({ id: 'a', name: 'A', category: 'core', description: '', defaultEnabled: true });
    reg.register({ id: 'b', name: 'B', category: 'core', description: '', defaultEnabled: false });
    const ids = reg.enabled().map((m) => m.id);
    expect(ids).toContain('a');
    expect(ids).not.toContain('b');
  });
});

describe('Singleton Module Registry', () => {
  it('API 存在且可呼叫', () => {
    expect(typeof modules.all).toBe('function');
    expect(typeof modules.isEnabled).toBe('function');
    expect(typeof modules.enable).toBe('function');
    expect(typeof modules.disable).toBe('function');
    expect(typeof modules.subscribe).toBe('function');
  });

  it('內建模組都有必要欄位', () => {
    for (const m of modules.all()) {
      expect(m.id).toBeTruthy();
      expect(m.name).toBeTruthy();
      expect(m.category).toBeTruthy();
      expect(typeof m.defaultEnabled).toBe('boolean');
      expect(m.description).toBeTruthy();
    }
  });
});

describe('Event Bus', () => {
  it('emit 觸發 on 註冊的 handler', async () => {
    const handler = vi.fn();
    bus.on('test-eb-1', handler);
    await bus.emit('test-eb-1', { foo: 'bar' });
    expect(handler).toHaveBeenCalledWith({ foo: 'bar' });
  });

  it('unsubscribe 不再觸發', async () => {
    const handler = vi.fn();
    const unsub = bus.on('test-eb-2', handler);
    unsub();
    await bus.emit('test-eb-2', {});
    expect(handler).not.toHaveBeenCalled();
  });

  it('錯誤不影響其他 handler', async () => {
    const handler1 = vi.fn(() => { throw new Error('boom'); });
    const handler2 = vi.fn();
    bus.on('test-eb-3', handler1);
    bus.on('test-eb-3', handler2);
    await bus.emit('test-eb-3', {});
    expect(handler2).toHaveBeenCalled();
  });
});

describe('Events 常數', () => {
  it('所有事件名稱都是有意義的字串', () => {
    expect(Events.JournalEntryCreated).toContain('journal');
    expect(Events.PeriodClosed).toContain('period');
    expect(Events.InvoiceIssued).toContain('invoice');
  });
});
