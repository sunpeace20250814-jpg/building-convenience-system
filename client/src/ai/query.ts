/**
 * AI 自然語言查詢
 * 給 LLM 完整 schema，把使用者問題轉成 SQL，執行後回傳結果
 */

import { callLLM } from './service';
import { AIConfig } from './config';
import { executeSafeQuery, validateSQL } from './sql-executor';

const SCHEMA_DESCRIPTION = `
你是一個 SQL 助手。使用者的 SQLite 資料庫 schema 如下：

**residents** (住戶):
- id TEXT PK, building_id, floor TEXT, unit_type ('normal'|'rental'), unit_number,
  status_id, owner_name TEXT, renter_name, phone, email,
  move_in_date TEXT, move_out_date, deposit REAL, monthly_rent REAL,
  emergency_contact, emergency_phone, note, created_at, updated_at

**resident_members** (家庭成員):
- id, resident_id FK, name, phone, relationship, created_at

**resident_keycards** (鑰匙卡):
- id, resident_id FK, card_number, note, created_at

**expense_records** (收支記錄):
- id, type ('income'|'expense'), date TEXT(YYYY-MM-DD), amount REAL,
  category_id, description, created_at, updated_at

**expense_categories** (收支類別):
- id, name, type ('income'|'expense'), color, sort_order

**allowance_holders** (零用金持有人):
- id, name, balance REAL, created_at, updated_at

**allowance_transactions** (零用金交易):
- id, allowance_id FK, date, amount REAL, type ('add'|'deduct'),
  description, balance_after REAL, created_at

**employees** (員工):
- id, name, phone, is_active INTEGER, created_at, updated_at

**shift_statuses** (班別):
- id, name, label, color, sort_order

**schedule_entries** (班表記錄):
- id, date TEXT(YYYY-MM-DD), shift_id, assignee_id, notes, created_at, updated_at

**holidays** (國定假日):
- id, date TEXT(YYYY-MM-DD) UNIQUE, name

**home_tabs** (公告標籤):
- id, name, sort_order, created_at, updated_at

**home_records** (公告記錄):
- id, tab_id, title, content, created_at, updated_at

**buildings** (建築物):
- id, name, normal_floor_count, rooftop_floor_count, basement_floor_count, created_at, updated_at

**parking_spots** (停車位):
- id, building_id, floor, number, type ('motorcycle'|'car'|'large'),
  status_id, bound_resident_id, created_at, updated_at

**status_options** (狀態選項):
- id, type ('resident'|'parking'), label, color, sort_order

注意：
- 全部用 snake_case 欄位名
- 只能用 SELECT，不能修改資料
- 回傳的結果要 LIMIT 200 筆
- 用中文回答使用者
`.trim();

export async function naturalLanguageQuery(
  config: AIConfig,
  question: string
): Promise<{ answer: string; sql?: string; results?: any[]; error?: string; durationMs: number }> {
  const start = performance.now();

  // 第一步：把問題轉成 SQL
  const sqlResult = await callLLM(
    config,
    [
      { role: 'system', content: SCHEMA_DESCRIPTION + '\n\n請只回傳 SQL 語法，不要加任何解釋或 markdown 標記。' },
      { role: 'user', content: `把這個問題轉成 SQL：${question}` },
    ],
    { temperature: 0.1, maxTokens: 500 }
  );

  const rawSQL = sqlResult.content.trim()
    .replace(/^```sql\n?/i, '')
    .replace(/^```\n?/, '')
    .replace(/```$/, '')
    .trim();

  const validation = validateSQL(rawSQL);
  if (!validation.valid) {
    return {
      answer: `SQL 驗證失敗：${validation.error}\n\n生成的 SQL：${rawSQL}`,
      sql: rawSQL,
      error: validation.error,
      durationMs: performance.now() - start,
    };
  }

  // 第二步：執行 SQL
  const queryResult = executeSafeQuery(rawSQL, config.maxRowsPerQuery);
  if (!queryResult.ok) {
    return {
      answer: `查詢執行失敗：${queryResult.error}\n\nSQL：${validation.normalizedSQL}`,
      sql: validation.normalizedSQL,
      error: queryResult.error,
      durationMs: performance.now() - start,
    };
  }

  // 第三步：把結果用自然語言摘要
  const summaryResult = await callLLM(
    config,
    [
      { role: 'system', content: '你是資料分析助手。請用繁體中文摘要查詢結果，重點說明趨勢、異常或值得注意的數字。' },
      {
        role: 'user',
        content: `使用者問題：${question}\n\nSQL 查詢：${validation.normalizedSQL}\n\n結果（${queryResult.rowCount} 筆）：\n${JSON.stringify(queryResult.rows?.slice(0, 20), null, 2)}`,
      },
    ],
    { temperature: 0.5 }
  );

  return {
    answer: summaryResult.content,
    sql: validation.normalizedSQL,
    results: queryResult.rows,
    durationMs: performance.now() - start,
  };
}

export async function analyzeData(
  config: AIConfig,
  topic: string,
  data: any
): Promise<string> {
  const result = await callLLM(
    config,
    [
      { role: 'system', content: '你是資料分析助手。請用繁體中文給出簡明、重點明確的分析。' },
      { role: 'user', content: `${topic}\n\n${JSON.stringify(data, null, 2).slice(0, 5000)}` },
    ],
    { temperature: 0.6 }
  );
  return result.content;
}
