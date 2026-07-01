/**
 * Accounting API — 會計核心 (Sprint 3-5)
 *
 * 後端對應: server/src/routes/accounting.ts
 *
 * 提供:
 *   - Chart of Accounts (科目表)
 *   - Journal Entries (日記帳分錄)
 *   - Accounting Periods (會計期間)
 *
 * 為什麼要這個 wrapper?
 *   - 取代 client-side storage/database.ts 的 throw-stub
 *   - 前端不再直接 queryAll SQL
 *   - 所有 API 走 server-side Fastify + better-sqlite3
 */

import { apiClient } from '@/lib/apiClient';

// ============================================================
// 類型定義
// ============================================================

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export interface AccountDTO {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  parentId?: string | null;
  description?: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateAccountInput {
  code: string;
  name: string;
  type: AccountType;
  parentId?: string | null;
  description?: string | null;
  sortOrder?: number;
}

export type UpdateAccountInput = Partial<CreateAccountInput>;

export interface JournalEntryDTO {
  id: string;
  entryDate: string;
  description: string;
  reference?: string | null;
  status: 'draft' | 'posted' | 'voided';
  postedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  lines?: JournalLineDTO[];
}

export interface JournalLineDTO {
  id: string;
  entryId: string;
  accountId: string;
  debit: number;
  credit: number;
  memo?: string | null;
  sortOrder: number;
  createdAt?: string;
}

export interface JournalLineInput {
  accountId: string;
  /** 正數;side 決定是 debit 還是 credit */
  amount: number;
  side: 'debit' | 'credit';
  memo?: string;
}

export interface CreateJournalEntryInput {
  entryDate: string;
  description: string;
  reference?: string;
  /** 直接過帳（draft → posted）;預設 false */
  autoPost?: boolean;
  lines: JournalLineInput[];
}

export interface AccountingPeriodDTO {
  id: string;
  periodCode: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
  closedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateAccountingPeriodInput {
  periodCode: string;
  startDate: string;
  endDate: string;
}

// ============================================================
// API 方法
// ============================================================

export const accountingApi = {
  // ---------- Accounts ----------

  /** 列出所有會計科目 */
  async listAccounts(): Promise<AccountDTO[]> {
    return apiClient.get<AccountDTO[]>('/api/accounting/accounts');
  },

  /** 取得單一會計科目 */
  async getAccount(id: string): Promise<AccountDTO | null> {
    try {
      return await apiClient.get<AccountDTO>(`/api/accounting/accounts/${encodeURIComponent(id)}`);
    } catch (e: any) {
      if (e?.statusCode === 404) return null;
      throw e;
    }
  },

  /** 新增會計科目 */
  async createAccount(data: CreateAccountInput): Promise<AccountDTO> {
    return apiClient.post<AccountDTO>('/api/accounting/accounts', data);
  },

  /** 更新會計科目 */
  async updateAccount(id: string, data: UpdateAccountInput): Promise<AccountDTO | null> {
    try {
      return await apiClient.put<AccountDTO>(
        `/api/accounting/accounts/${encodeURIComponent(id)}`,
        data
      );
    } catch (e: any) {
      if (e?.statusCode === 404) return null;
      throw e;
    }
  },

  /** 刪除會計科目（有引用時禁止） */
  async deleteAccount(id: string): Promise<boolean> {
    try {
      await apiClient.delete<{ success: boolean }>(
        `/api/accounting/accounts/${encodeURIComponent(id)}`
      );
      return true;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 400) return false;
      throw e;
    }
  },

  // ---------- Journal Entries ----------

  /** 列出分錄（支援日期區間 + 狀態過濾） */
  async listJournalEntries(opts: {
    startDate?: string;
    endDate?: string;
    status?: 'draft' | 'posted' | 'voided';
  } = {}): Promise<Array<JournalEntryDTO & { totalDebit: number; totalCredit: number; balanced: boolean }>> {
    const params = new URLSearchParams();
    if (opts.startDate) params.set('startDate', opts.startDate);
    if (opts.endDate) params.set('endDate', opts.endDate);
    if (opts.status) params.set('status', opts.status);
    const qs = params.toString();
    return apiClient.get(`/api/accounting/journal-entries${qs ? `?${qs}` : ''}`);
  },

  /** 取得單一分錄（含明細行） */
  async getJournalEntry(id: string): Promise<JournalEntryDTO | null> {
    try {
      return await apiClient.get<JournalEntryDTO>(
        `/api/accounting/journal-entries/${encodeURIComponent(id)}`
      );
    } catch (e: any) {
      if (e?.statusCode === 404) return null;
      throw e;
    }
  },

  /** 新增分錄（自動驗證借貸必平） */
  async createJournalEntry(data: CreateJournalEntryInput): Promise<JournalEntryDTO> {
    return apiClient.post<JournalEntryDTO>('/api/accounting/journal-entries', data);
  },

  /** 過帳（draft → posted） */
  async postJournalEntry(id: string): Promise<JournalEntryDTO | null> {
    try {
      return await apiClient.post<JournalEntryDTO>(
        `/api/accounting/journal-entries/${encodeURIComponent(id)}/post`
      );
    } catch (e: any) {
      if (e?.statusCode === 404) return null;
      throw e;
    }
  },

  /** 刪除分錄（已過帳不可刪） */
  async deleteJournalEntry(id: string): Promise<boolean> {
    try {
      await apiClient.delete<{ success: boolean }>(
        `/api/accounting/journal-entries/${encodeURIComponent(id)}`
      );
      return true;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 400) return false;
      throw e;
    }
  },

  // ---------- Accounting Periods ----------

  /** 列出所有會計期間 */
  async listPeriods(): Promise<AccountingPeriodDTO[]> {
    return apiClient.get<AccountingPeriodDTO[]>('/api/accounting/accounting-periods');
  },

  /** 新增會計期間 */
  async createPeriod(data: CreateAccountingPeriodInput): Promise<AccountingPeriodDTO> {
    return apiClient.post<AccountingPeriodDTO>('/api/accounting/accounting-periods', data);
  },

  /** 關帳 */
  async closePeriod(id: string): Promise<AccountingPeriodDTO | null> {
    try {
      return await apiClient.post<AccountingPeriodDTO>(
        `/api/accounting/accounting-periods/${encodeURIComponent(id)}/close`
      );
    } catch (e: any) {
      if (e?.statusCode === 404) return null;
      throw e;
    }
  },
};