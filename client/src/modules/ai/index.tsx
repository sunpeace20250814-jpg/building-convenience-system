/**
 * AI 助手頁面 — M-63 完善化 (2026-07-02)
 *
 * 新增功能:
 * - 連線測試 (顯示 base url / model / latency)
 * - 自動抓取 /v1/models 動態模型清單
 * - 友善錯誤訊息 (中文化 + 修復提示)
 * - Token 用量摘要 (月方案估算)
 * - 重新生成 / 編輯重發 / 複製按鈕
 *
 * 既有功能保留:
 * - 設定 API Key / Provider
 * - 自然語言查詢
 * - 對話歷史 (localStorage)
 * - 預設範例
 * - AES-GCM 加密 API Key
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Sparkles,
  Send,
  Settings,
  Trash2,
  Key,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Copy,
  Pencil,
  RotateCw,
  Download,
  Zap,
} from 'lucide-react';
import {
  AIConfig,
  DEFAULT_CONFIG,
  loadConfig,
  saveConfig,
  getProviderPresets,
  MINIMAX_MODELS,
} from '@/ai/config';
import {
  ChatMessage,
  loadConversations,
  saveConversations,
  clearConversations,
  callLLM,
  listModels,
  friendlyError,
  getTokenUsageSummary,
  type ModelInfo,
} from '@/ai/service';
import { naturalLanguageQuery } from '@/ai/query';
import { monitor } from '@/monitoring/core';

const EXAMPLE_QUERIES = [
  '這個月總共有多少筆支出？總金額多少？',
  '列出所有逾期未繳管理費的住戶',
  '本週有哪些國定假日？',
  '找出 3 樓的所有住戶',
  '過去 30 天支出最高的 5 個類別',
];

interface TestResult {
  status: 'idle' | 'ok' | 'error';
  message: string;
  latencyMs?: number;
  model?: string;
}

export function AIModule() {
  const [config, setConfig] = useState<AIConfig>(DEFAULT_CONFIG);
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState<TestResult>({ status: 'idle', message: '' });
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConfig().then(setConfig);
    setMessages(loadConversations());
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function updateConfig(updates: Partial<AIConfig>) {
    const next = { ...config, ...updates };
    setConfig(next);
    saveConfig(next);
  }

  const handleSend = useCallback(
    async (overrideContent?: string, regenerateFromId?: string) => {
      const text = (overrideContent ?? input).trim();
      if (!text || busy) return;
      if (!config.apiKey) {
        setShowSettings(true);
        return;
      }

      // 若是「重新生成」,刪掉 regenerateFromId 之後的所有訊息
      if (regenerateFromId) {
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === regenerateFromId);
          if (idx >= 0) return prev.slice(0, idx);
          return prev;
        });
      }

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: Date.now(),
      };

      setMessages((m) => [...m, userMsg]);
      if (!overrideContent) setInput('');
      setBusy(true);

      // 建立 streaming ai message (佔位)
      const aiMsgId = `ai-${Date.now()}`;
      const streamingMsg: ChatMessage = {
        id: aiMsgId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        streaming: true,
      };
      setMessages((m) => [...m, streamingMsg]);

      try {
        const result = await naturalLanguageQuery(config, text, {
          onSummaryDelta: (streamed) => {
            setMessages((m) =>
              m.map((msg) =>
                msg.id === aiMsgId
                  ? { ...msg, content: streamed, streaming: true }
                  : msg
              )
            );
          },
        });
        // 完成:把 streaming 標記移除
        setMessages((m) =>
          m.map((msg) =>
            msg.id === aiMsgId
              ? {
                  ...msg,
                  content: result.answer,
                  sql: result.sql,
                  results: result.results,
                  error: result.error,
                  durationMs: result.durationMs,
                  streaming: false,
                }
              : msg
          )
        );
        saveConversations(
          messages.concat([
            userMsg,
            {
              id: aiMsgId,
              role: 'assistant',
              content: result.answer,
              sql: result.sql,
              results: result.results,
              error: result.error,
              durationMs: result.durationMs,
              timestamp: Date.now(),
            },
          ])
        );

        if (config.enableAuditLog) {
          monitor.recordError(
            `AI 查詢: "${text.slice(0, 50)}" -> ${result.error ? '失敗' : `${result.results?.length ?? 0} 筆`}`,
            'ai.audit',
            'info',
            { question: text, sql: result.sql, error: result.error }
          );
        }
      } catch (err: any) {
        const friendlyMsg = friendlyError(err);
        // 把剛建立的 streaming message 換成錯誤訊息
        setMessages((m) =>
          m.map((msg) =>
            msg.id === aiMsgId
              ? { ...msg, content: `錯誤:${friendlyMsg}`, error: friendlyMsg, streaming: false }
              : msg
          )
        );
        saveConversations(
          messages.concat([
            userMsg,
            {
              id: aiMsgId,
              role: 'assistant',
              content: `錯誤:${friendlyMsg}`,
              error: friendlyMsg,
              timestamp: Date.now(),
            },
          ])
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, config, input, messages]
  );

  const handleTestConnection = async () => {
    if (!config.apiKey) {
      setTestResult({ status: 'error', message: '請先填入 API Key' });
      return;
    }
    setTestResult({ status: 'idle', message: '測試中...' });
    const t0 = performance.now();
    try {
      const res = await callLLM(
        config,
        [{ role: 'user', content: 'Say "OK" only.' }],
        { maxTokens: 10 }
      );
      const latency = performance.now() - t0;
      setTestResult({
        status: 'ok',
        message: `連線成功！回應: ${res.content.trim().slice(0, 30) || '(空白)'}`,
        latencyMs: latency,
        model: config.model,
      });
    } catch (err: any) {
      setTestResult({
        status: 'error',
        message: friendlyError(err),
      });
    }
  };

  const handleFetchModels = async () => {
    if (!config.apiKey) {
      setTestResult({ status: 'error', message: '請先填入 API Key' });
      return;
    }
    setModelsLoading(true);
    try {
      const list = await listModels(config);
      setModels(list);
      setTestResult({
        status: 'ok',
        message: `抓到 ${list.length} 個可用模型`,
      });
    } catch (err: any) {
      setTestResult({
        status: 'error',
        message: friendlyError(err),
      });
      setModels([]);
    } finally {
      setModelsLoading(false);
    }
  };

  const handleClear = () => {
    if (!confirm('清除所有對話紀錄?')) return;
    setMessages([]);
    clearConversations();
  };

  const handleUseExample = (q: string) => {
    setInput(q);
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback: do nothing
    }
  };

  const handleRegenerate = (msgId: string) => {
    // 找出該 ai message 之前的 user message
    const idx = messages.findIndex((m) => m.id === msgId);
    if (idx < 0) return;
    // 往前找 user message
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        handleSend(messages[i].content, messages[i].id);
        return;
      }
    }
  };

  const handleStartEdit = (msg: ChatMessage) => {
    setEditingId(msg.id);
    setEditingContent(msg.content);
  };

  const handleSaveEdit = async (msg: ChatMessage) => {
    if (!editingContent.trim()) return;
    // 更新該 message,並刪除後續所有 ai responses
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === msg.id);
      if (idx < 0) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], content: editingContent.trim() };
      // 刪除後續
      return next.slice(0, idx + 1);
    });
    setEditingId(null);
    // 觸發新查詢
    await handleSend(editingContent.trim(), msg.id);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingContent('');
  };

  const handleExportConversation = () => {
    if (messages.length === 0) return;
    const md = messages
      .map((m) => {
        const ts = new Date(m.timestamp).toLocaleString('zh-TW');
        const role = m.role === 'user' ? '👤 使用者' : '🤖 AI';
        let extra = '';
        if (m.sql) extra += `\n\`\`\`sql\n${m.sql}\n\`\`\``;
        if (m.results) extra += `\n*回傳 ${m.results.length} 筆*`;
        return `### ${role} · ${ts}\n\n${m.content}${extra}`;
      })
      .join('\n\n---\n\n');
    const blob = new Blob([`# AI 對話紀錄\n\n${md}\n`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-conversation-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tokenSummary = getTokenUsageSummary();

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="AI 助手"
        description="用自然語言查詢資料,AI 自動產生 SQL 並回傳結果"
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleExportConversation} disabled={messages.length === 0}>
              <Download className="w-4 h-4 mr-1" />
              匯出
            </Button>
            <Button variant="secondary" onClick={handleClear}>
              <Trash2 className="w-4 h-4 mr-2" />
              清除對話
            </Button>
            <Button variant="secondary" onClick={() => setShowSettings(!showSettings)}>
              <Settings className="w-4 h-4 mr-2" />
              {showSettings ? '隱藏設定' : '設定'}
            </Button>
          </div>
        }
      />

      {/* Token 用量摘要 — 月方案監測 */}
      <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-medium text-gray-700">月方案用量估算 (本次 session)</span>
          </div>
          <div className="flex gap-4 text-xs text-gray-600">
            <span>請求: <strong>{tokenSummary.requests}</strong></span>
            <span>輸入: <strong>{tokenSummary.promptTokens.toLocaleString()}</strong> tokens</span>
            <span>輸出: <strong>{tokenSummary.completionTokens.toLocaleString()}</strong> tokens</span>
            <span>合計: <strong>{tokenSummary.totalTokens.toLocaleString()}</strong> tokens</span>
          </div>
        </div>
        {tokenSummary.byModel.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {tokenSummary.byModel.slice(0, 5).map((m) => (
              <span key={m.model} className="px-2 py-0.5 bg-white rounded border">
                {m.model}: {m.tokens.toLocaleString()} tokens
              </span>
            ))}
          </div>
        )}
      </Card>

      {showSettings && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">AI 設定</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Provider</label>
              <select
                value={config.provider}
                onChange={(e) => {
                  const p = e.target.value as any;
                  const preset = getProviderPresets().find((x) => x.provider === p);
                  updateConfig({
                    provider: p,
                    baseUrl: preset?.baseUrl || config.baseUrl,
                    model: preset?.model || config.model,
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
              >
                {getProviderPresets().map((p) => (
                  <option key={p.provider} value={p.provider}>{p.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">
                <Key className="w-3 h-3 inline" /> API Key
              </label>
              <input
                type="password"
                value={config.apiKey}
                onChange={(e) => updateConfig({ apiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Base URL</label>
              <input
                type="text"
                value={config.baseUrl}
                onChange={(e) => updateConfig({ baseUrl: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1 flex items-center justify-between">
                <span>Model</span>
                <button
                  type="button"
                  onClick={handleFetchModels}
                  disabled={modelsLoading || !config.apiKey}
                  className="text-xs text-blue-600 hover:text-blue-700 disabled:text-gray-400 inline-flex items-center gap-1"
                  title="從 API 動態抓取可用模型"
                >
                  <RefreshCw className={`w-3 h-3 ${modelsLoading ? 'animate-spin' : ''}`} />
                  抓模型清單
                </button>
              </label>
              {models.length > 0 ? (
                <select
                  value={config.model}
                  onChange={(e) => updateConfig({ model: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label ?? m.id} {m.ownedBy ? `(${m.ownedBy})` : ''}
                    </option>
                  ))}
                </select>
              ) : config.provider === 'minimax' || config.provider === 'minimax-cn' ? (
                <select
                  value={config.model}
                  onChange={(e) => updateConfig({ model: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                >
                  {MINIMAX_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={config.model}
                  onChange={(e) => updateConfig({ model: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              )}
              <p className="text-xs text-gray-400 mt-1">
                {config.provider === 'minimax' && '🌍 國際版 (platform.MiniMax.io) 月方案模型'}
                {config.provider === 'minimax-cn' && '🇨🇳 中國版 (minimaxi.com)'}
                {config.provider === 'openai' && 'OpenAI 模型,可手動輸入任意 model ID'}
                {config.provider === 'anthropic' && 'Anthropic 模型,可手動輸入'}
                {config.provider === 'custom' && '自訂 API (Ollama / LM Studio 等)'}
              </p>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Temperature: {config.temperature}</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={config.temperature}
                onChange={(e) => updateConfig({ temperature: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Max Tokens</label>
              <input
                type="number"
                value={config.maxTokens}
                onChange={(e) => updateConfig({ maxTokens: parseInt(e.target.value) || 2000 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs text-gray-600 mb-1">自訂 System Prompt(選填)</label>
              <textarea
                value={config.systemPrompt || ''}
                onChange={(e) => updateConfig({ systemPrompt: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs"
                placeholder="額外指示,可留空"
              />
            </div>

            <div className="col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="enableStreaming"
                checked={config.enableStreaming}
                onChange={(e) => updateConfig({ enableStreaming: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="enableStreaming" className="text-xs text-gray-700 cursor-pointer">
                <Zap className="w-3 h-3 inline" />
                啟用 streaming 回應(邊生成邊顯示,推薦)
              </label>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <Button onClick={handleTestConnection} variant="primary" size="sm">
              <Zap className="w-3.5 h-3.5 mr-1" />
              測試連線
            </Button>
            {testResult.status === 'ok' && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="w-4 h-4" />
                <span>{testResult.message}</span>
                {testResult.latencyMs !== undefined && (
                  <span className="text-xs text-gray-500">({testResult.latencyMs.toFixed(0)} ms)</span>
                )}
              </div>
            )}
            {testResult.status === 'error' && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="w-4 h-4" />
                <span>{testResult.message}</span>
              </div>
            )}
            {testResult.status === 'idle' && testResult.message && (
              <span className="text-sm text-gray-500">{testResult.message}</span>
            )}
          </div>

          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
            <strong>安全提醒:</strong>AI 只能執行 SELECT 查詢,無法修改或刪除資料。所有查詢都會通過 SQL 驗證器並記錄在監測系統中。
          </div>
        </Card>
      )}

      {/* 對話區 */}
      <Card>
        <div ref={scrollRef} className="h-96 overflow-y-auto space-y-3 mb-4">
          {messages.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Sparkles className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="mb-4">開始用自然語言查詢你的資料</p>
              <div className="flex flex-wrap gap-2 justify-center max-w-2xl mx-auto">
                {EXAMPLE_QUERIES.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleUseExample(q)}
                    className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                onCopy={handleCopy}
                onRegenerate={m.role === 'assistant' && !busy ? () => handleRegenerate(m.id) : undefined}
                onEdit={m.role === 'user' && !busy ? () => handleStartEdit(m) : undefined}
                isEditing={editingId === m.id}
                editContent={editingContent}
                onEditChange={setEditingContent}
                onEditSave={() => handleSaveEdit(m)}
                onEditCancel={handleCancelEdit}
              />
            ))
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="問個問題吧,例如:本月總支出多少?"
            disabled={busy}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Button onClick={() => handleSend()} disabled={busy || !input.trim()}>
            {busy ? (
              <>
                <span className="w-4 h-4 mr-2 inline-block animate-spin rounded-full border-2 border-white border-t-transparent" />
                思考中
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                送出
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  onCopy: (text: string) => void;
  onRegenerate?: () => void;
  onEdit?: () => void;
  isEditing: boolean;
  editContent: string;
  onEditChange: (text: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
}

function MessageBubble({
  message,
  onCopy,
  onRegenerate,
  onEdit,
  isEditing,
  editContent,
  onEditChange,
  onEditSave,
  onEditCancel,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} group`}>
      <div className={`max-w-3xl ${isUser ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'} rounded-lg px-4 py-3`}>
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => onEditChange(e.target.value)}
              rows={3}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button onClick={onEditCancel} className="text-xs px-2 py-1 text-gray-600 hover:text-gray-800">
                取消
              </button>
              <button onClick={onEditSave} className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">
                送出重新查詢
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm whitespace-pre-wrap">
              {message.content || (message.streaming ? '' : '(空白回應)')}
              {message.streaming && (
                <span className="inline-block w-2 h-4 ml-1 bg-indigo-500 animate-pulse align-text-bottom" title="生成中..." />
              )}
            </p>
            {message.sql && (
              <details className="mt-2 text-xs">
                <summary className={`cursor-pointer ${isUser ? 'text-blue-100' : 'text-gray-500'}`}>
                  使用的 SQL
                </summary>
                <pre className={`mt-1 p-2 rounded text-xs overflow-x-auto ${isUser ? 'bg-blue-700 text-blue-50' : 'bg-white text-gray-800'}`}>
                  {message.sql}
                </pre>
                {message.results && (
                  <p className={`mt-1 text-xs ${isUser ? 'text-blue-100' : 'text-gray-500'}`}>
                    回傳 {message.results.length} 筆
                  </p>
                )}
              </details>
            )}
            {message.error && (
              <Badge variant="danger" className="mt-2">錯誤</Badge>
            )}
            {message.streaming && (
              <span className={`text-xs mt-2 inline-flex items-center gap-1 ${isUser ? 'text-blue-100' : 'text-indigo-600'}`}>
                <span className="inline-block w-1.5 h-1.5 bg-current rounded-full animate-pulse" />
                <span className="inline-block w-1.5 h-1.5 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.15s' }} />
                <span className="inline-block w-1.5 h-1.5 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
                生成中...
              </span>
            )}
            <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onCopy(message.content)}
                className={`text-xs ${isUser ? 'text-blue-100 hover:text-white' : 'text-gray-500 hover:text-gray-700'} inline-flex items-center gap-0.5`}
                title="複製訊息"
              >
                <Copy className="w-3 h-3" />
              </button>
              {onEdit && (
                <button
                  onClick={onEdit}
                  className={`text-xs ${isUser ? 'text-blue-100 hover:text-white' : 'text-gray-500 hover:text-gray-700'} inline-flex items-center gap-0.5`}
                  title="編輯並重新查詢"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
              {onRegenerate && (
                <button
                  onClick={onRegenerate}
                  className={`text-xs ${isUser ? 'text-blue-100 hover:text-white' : 'text-gray-500 hover:text-gray-700'} inline-flex items-center gap-0.5`}
                  title="重新生成回應"
                >
                  <RotateCw className="w-3 h-3" />
                </button>
              )}
            </div>
            {message.durationMs !== undefined && (
              <p className={`text-xs mt-1 ${isUser ? 'text-blue-100' : 'text-gray-500'}`}>
                耗時 {message.durationMs.toFixed(0)}ms
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}