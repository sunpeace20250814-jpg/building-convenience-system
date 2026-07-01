/**
 * 模組化系統 - 核心
 *
 * 設計概念：
 * - 每個「模組」是一個獨立功能包（含 schema、UI、報表、邏輯）
 * - 使用者可從 settings 啟用/停用每個模組
 * - 模組之間透過「事件」通訊，不互相硬依賴
 * - 核心模組永遠啟用（資料庫、安全、檔案 I/O）
 *
 * Module Manifest 範例：
 * {
 *   id: 'double-entry',
 *   name: '複式記帳',
 *   category: 'accounting',
 *   defaultEnabled: false,     // 預設關閉（進階功能）
 *   requires: ['accounts'],    // 依賴其他模組
 *   conflicts: [],             // 互斥模組
 *   schema: 'CREATE TABLE ...', // 該模組需要的 schema
 *   migrations: [...],         // 升級用的 migration
 * }
 */

export type ModuleCategory = 'core' | 'accounting' | 'tax' | 'banking' | 'reporting' | 'productivity' | 'integration';

export interface ModuleManifest {
  /** 唯一 ID（snake_case） */
  id: string;
  /** 顯示名稱 */
  name: string;
  /** 描述（給使用者看） */
  description: string;
  /** 分類 */
  category: ModuleCategory;
  /** 預設是否啟用 */
  defaultEnabled: boolean;
  /** 是否為核心模組（不可關閉） */
  core?: boolean;
  /** 依賴的模組 ID 列表（這些模組必須啟用） */
  requires?: string[];
  /** 互斥的模組 ID 列表（不能同時啟用） */
  conflicts?: string[];
  /** 此模組需要的 schema SQL */
  schema?: string | string[];
  /** 升級用的 migration 列表 */
  migrations?: Array<{ version: number; sql: string }>;
  /** 此模組要註冊的路由 */
  routes?: Array<{ path: string; label: string; icon?: string; component?: () => Promise<unknown> }>;
  /** 此模組要註冊的 Sidebar 項目 */
  sidebar?: Array<{ path: string; label: string; icon?: string }>;
  /** 此模組要訂閱的事件 */
  listens?: string[];
  /** 此模組要註冊的報表（給 Reports 模組呼叫） */
  reports?: Array<{
    id: string;
    name: string;
    category: 'income' | 'balance' | 'cashflow' | 'custom';
    generate: (params: { startDate: string; endDate: string }) => Promise<ReportData>;
  }>;
  /** 此模組要註冊的導航工具（給 AI 助手） */
  aiCapabilities?: Array<{
    name: string;
    description: string;
    examples: string[];
  }>;
}

export interface ReportData {
  title: string;
  columns: Array<{ key: string; label: string; type?: 'string' | 'number' | 'currency' }>;
  rows: Array<Record<string, any>>;
  summary?: Record<string, any>;
}

export interface ModuleState {
  enabled: boolean;
  installedAt: string;
  enabledAt?: string;
  config?: Record<string, any>;
}

const STORAGE_KEY = 'v4-modules';

class ModuleRegistry {
  private manifests = new Map<string, ModuleManifest>();
  private states = new Map<string, ModuleState>();
  private listeners = new Set<() => void>();
  private eventBus: EventBus | null = null;

  /** 註冊模組（模組載入時呼叫） */
  register(manifest: ModuleManifest): void {
    if (this.manifests.has(manifest.id)) {
      console.warn(`Module ${manifest.id} 重複註冊`);
      return;
    }
    this.manifests.set(manifest.id, manifest);
    this.notify();
  }

  /** 取得單一模組的 manifest */
  get(id: string): ModuleManifest | undefined {
    return this.manifests.get(id);
  }

  /** 取得所有模組 */
  all(): ModuleManifest[] {
    return Array.from(this.manifests.values());
  }

  /** 取得所有啟用的模組 */
  enabled(): ModuleManifest[] {
    return this.all().filter((m) => this.isEnabled(m.id));
  }

  /** 啟用模組（含依賴檢查） */
  enable(id: string): { ok: boolean; error?: string; cascaded?: string[] } {
    const manifest = this.get(id);
    if (!manifest) return { ok: false, error: '模組不存在' };

    if (manifest.core) {
      return { ok: false, error: '核心模組不可關閉' };
    }

    // 檢查依賴
    if (manifest.requires) {
      for (const dep of manifest.requires) {
        if (!this.isEnabled(dep)) {
          // 自動啟用依賴
          const depResult = this.enable(dep);
          if (!depResult.ok) {
            return { ok: false, error: `依賴模組 ${dep} 無法啟用：${depResult.error}` };
          }
        }
      }
    }

    // 檢查互斥
    if (manifest.conflicts) {
      for (const conflict of manifest.conflicts) {
        if (this.isEnabled(conflict)) {
          return { ok: false, error: `與模組 ${conflict} 互斥，請先停用` };
        }
      }
    }

    const state = this.states.get(id) || { enabled: false, installedAt: new Date().toISOString() };
    state.enabled = true;
    state.enabledAt = new Date().toISOString();
    this.states.set(id, state);
    this.persist();
    this.applySchema(id, true);
    this.eventBus?.emit('module:enabled', { moduleId: id });
    this.notify();
    return { ok: true, cascaded: manifest.requires };
  }

  /** 停用模組 */
  disable(id: string): { ok: boolean; error?: string; blocked?: string[] } {
    const manifest = this.get(id);
    if (!manifest) return { ok: false, error: '模組不存在' };

    if (manifest.core) {
      return { ok: false, error: '核心模組不可停用' };
    }

    // 檢查哪些模組依賴這個
    const dependents = this.all().filter((m) => m.requires?.includes(id) && this.isEnabled(m.id));
    if (dependents.length > 0) {
      return {
        ok: false,
        error: `被其他模組依賴：${dependents.map((m) => m.name).join(', ')}`,
        blocked: dependents.map((m) => m.id),
      };
    }

    const state = this.states.get(id);
    if (state) {
      state.enabled = false;
      this.states.set(id, state);
    }
    this.persist();
    this.eventBus?.emit('module:disabled', { moduleId: id });
    this.notify();
    return { ok: true };
  }

  /** 是否啟用 */
  isEnabled(id: string): boolean {
    const manifest = this.get(id);
    if (!manifest) return false;
    if (manifest.core) return true;

    const state = this.states.get(id);
    if (state && state.enabled !== undefined) return state.enabled;
    return manifest.defaultEnabled;
  }

  /** 取得模組狀態 */
  getState(id: string): ModuleState | undefined {
    return this.states.get(id);
  }

  /** 設定模組 config */
  setConfig(id: string, config: Record<string, any>): void {
    const state = this.states.get(id) || {
      enabled: this.isEnabled(id),
      installedAt: new Date().toISOString(),
    };
    state.config = { ...state.config, ...config };
    this.states.set(id, state);
    this.persist();
    this.notify();
  }

  /** 套用 schema（透過回呼，由 storage 層提供 db） */
  private schemaApplier: ((moduleId: string, sql: string | string[]) => void) | null = null;

  setSchemaApplier(applier: (moduleId: string, sql: string | string[]) => void) {
    this.schemaApplier = applier;
  }

  private applySchema(moduleId: string, isEnable: boolean) {
    if (!isEnable) return; // 停用不刪資料
    const manifest = this.get(moduleId);
    if (!manifest?.schema) return;
    if (this.schemaApplier) {
      try {
        this.schemaApplier(moduleId, manifest.schema);
      } catch (err) {
        console.error(`套用 ${moduleId} schema 失敗：`, err);
      }
    }
  }

  /** 設定事件總線 */
  setEventBus(bus: EventBus) {
    this.eventBus = bus;
  }

  /** 訂閱變化 */
  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    for (const cb of this.listeners) cb();
  }

  /** 持久化到 localStorage */
  private persist() {
    const data: Record<string, ModuleState> = {};
    for (const [k, v] of this.states) data[k] = v;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error('模組狀態儲存失敗', err);
    }
  }

  /** 從 localStorage 載入 */
  loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      for (const [k, v] of Object.entries(data)) {
        this.states.set(k, v as ModuleState);
      }
    } catch {}
  }

  /** 全部重置（謹慎使用） */
  reset() {
    this.states.clear();
    localStorage.removeItem(STORAGE_KEY);
    this.notify();
  }
}

// ==================== Event Bus ====================

type EventHandler = (payload: any) => void | Promise<void>;

class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  on(event: string, handler: EventHandler): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
    return () => this.handlers.get(event)?.delete(handler);
  }

  async emit(event: string, payload?: any): Promise<void> {
    const handlers = this.handlers.get(event);
    if (!handlers) return;
    await Promise.all(
      Array.from(handlers).map(async (h) => {
        try {
          await h(payload);
        } catch (err) {
          console.error(`Event ${event} handler 錯誤：`, err);
        }
      })
    );
  }

  off(event: string, handler: EventHandler) {
    this.handlers.get(event)?.delete(handler);
  }
}

export const modules = new ModuleRegistry();
export const bus = new EventBus();

// 預設事件型別（給模組參考）
export const Events = {
  ModuleEnabled: 'module:enabled',
  ModuleDisabled: 'module:disabled',
  JournalEntryCreated: 'accounting:journal-created',
  JournalEntryPosted: 'accounting:journal-posted',
  PeriodClosed: 'accounting:period-closed',
  PeriodReopened: 'accounting:period-reopened',
  ExpenseRecorded: 'expense:recorded',
  InvoiceIssued: 'invoice:issued',
  BankReconciled: 'bank:reconciled',
  ResidentAdded: 'resident:added',
} as const;
