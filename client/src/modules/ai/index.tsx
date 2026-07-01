/**
 * AI 助手頁面
 * - 設定 API Key / Provider
 * - 自然語言查詢
 * - 對話歷史
 * - 預設範例
 */

import { useState, useEffect, useRef } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Sparkles, Send, Settings, Trash2, Key, AlertCircle, CheckCircle } from 'lucide-react';
import { AIConfig, DEFAULT_CONFIG, loadConfig, saveConfig, getProviderPresets, MINIMAX_MODELS } from '@/ai/config';
import { ChatMessage, loadConversations, saveConversations, clearConversations, callLLM } from '@/ai/service';
import { naturalLanguageQuery } from '@/ai/query';
import { monitor } from '@/monitoring/core';

const EXAMPLE_QUERIES = [
  '這個月總共有多少筆支出？總金額多少？',
  '列出所有逾期未繳管理費的住戶',
  '本週有哪些國定假日？',
  '找出 3 樓的所有住戶',
  '過去 30 天支出最高的 5 個類別',
];

export function AIModule() {
  const [config, setConfig] = useState<AIConfig>(DEFAULT_CONFIG);
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
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
    saveConfig(next); // fire-and-forget，內部已 catch 錯誤
  }

  async function handleSend() {
    if (!input.trim() || busy) return;
    if (!config.apiKey) {
      setShowSettings(true);
      return;
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages((m) => [...m, userMsg]);
    setInput('');
    setBusy(true);

    try {
      const result = await naturalLanguageQuery(config, userMsg.content);
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: result.answer,
        sql: result.sql,
        results: result.results,
        error: result.error,
        durationMs: result.durationMs,
        timestamp: Date.now(),
      };
      setMessages((m) => {
        const next = [...m, aiMsg];
        saveConversations(next);
        return next;
      });

      // 審計日誌
      if (config.enableAuditLog) {
        monitor.recordError(
          `AI 查詢: "${userMsg.content.slice(0, 50)}" -> ${result.error ? '失敗' : `${result.results?.length} 筆`}`,
          'ai.audit',
          'info',
          { question: userMsg.content, sql: result.sql, error: result.error }
        );
      }
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `錯誤：${err.message}`,
        error: err.message,
        timestamp: Date.now(),
      };
      setMessages((m) => {
        const next = [...m, errMsg];
        saveConversations(next);
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleTestConnection() {
    if (!config.apiKey) {
      setTestStatus('error');
      setTestMessage('請先填入 API Key');
      return;
    }
    setTestStatus('idle');
    setTestMessage('測試中...');
    try {
      const res = await callLLM(
        config,
        [{ role: 'user', content: 'Say "OK" only.' }],
        { maxTokens: 10 }
      );
      setTestStatus('ok');
      setTestMessage(`連線成功！回應：${res.content.trim()}`);
    } catch (err: any) {
      setTestStatus('error');
      setTestMessage(err.message);
    }
  }

  function handleClear() {
    if (!confirm('清除所有對話紀錄？')) return;
    setMessages([]);
    clearConversations();
  }

  function handleUseExample(q: string) {
    setInput(q);
  }

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="AI 助手"
        description="用自然語言查詢資料，AI 自動產生 SQL 並回傳結果"
        actions={
          <div className="flex gap-2">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
              <label className="block text-xs text-gray-600 mb-1">Model</label>
              {config.provider === 'minimax' || config.provider === 'minimax-cn' ? (
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
                {config.provider === 'minimax' && '🌍 國際版（platform.MiniMax.io）月方案模型'}
                {config.provider === 'minimax-cn' && '🇨🇳 中國版（minimaxi.com）'}
                {config.provider === 'openai' && 'OpenAI 模型，可手動輸入任意 model ID'}
                {config.provider === 'anthropic' && 'Anthropic 模型，可手動輸入'}
                {config.provider === 'custom' && '自訂 API（Ollama / LM Studio 等）'}
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
              <label className="block text-xs text-gray-600 mb-1">自訂 System Prompt（選填）</label>
              <textarea
                value={config.systemPrompt || ''}
                onChange={(e) => updateConfig({ systemPrompt: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs"
                placeholder="額外指示，可留空"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Button onClick={handleTestConnection}>
              測試連線
            </Button>
            {testStatus === 'ok' && (
              <div className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle className="w-4 h-4" />
                <span>{testMessage}</span>
              </div>
            )}
            {testStatus === 'error' && (
              <div className="flex items-center gap-1 text-sm text-red-600">
                <AlertCircle className="w-4 h-4" />
                <span>{testMessage}</span>
              </div>
            )}
          </div>

          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
            <strong>安全提醒：</strong>AI 只能執行 SELECT 查詢，無法修改或刪除資料。所有查詢都會通過 SQL 驗證器並記錄在監測系統中。
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
            messages.map((m) => <MessageBubble key={m.id} message={m} />)
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
            placeholder="問個問題吧，例如：本月總支出多少？"
            disabled={busy}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Button onClick={handleSend} disabled={busy || !input.trim()}>
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

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-3xl ${isUser ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'} rounded-lg px-4 py-3`}>
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
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
        {message.durationMs !== undefined && (
          <p className={`text-xs mt-1 ${isUser ? 'text-blue-100' : 'text-gray-500'}`}>
            耗時 {message.durationMs.toFixed(0)}ms
          </p>
        )}
      </div>
    </div>
  );
}
