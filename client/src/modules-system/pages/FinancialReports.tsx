/**
 * 財務報表 (Financial Reports)
 *
 * M-61 修復 (2026-07-01): 從 doubleEntryManifest.reports (client-side throw-stub)
 *   → server-side accountingReportsApi (M-56 backend)
 *
 * 提供 4 種報表:
 *   - Trial Balance (試算表)
 *   - Balance Sheet (資產負債表) — 不需 startDate
 *   - Income Statement (損益表)
 *   - Cash Flow Statement (現金流量表)
 */

import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { BarChart3, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  accountingReportsApi,
  type TrialBalance,
  type BalanceSheet,
  type IncomeStatement,
  type CashFlowStatement,
} from '@/api/accounting-reports';

type ReportType = 'trial-balance' | 'balance-sheet' | 'income-statement' | 'cash-flow';

const REPORT_META: Record<ReportType, { label: string; needsStartDate: boolean; description: string }> = {
  'trial-balance': { label: '試算表', needsStartDate: true, description: '所有會計科目在指定期間的借貸彙總' },
  'balance-sheet': { label: '資產負債表', needsStartDate: false, description: '特定日期的資產 / 負債 / 權益狀態' },
  'income-statement': { label: '損益表', needsStartDate: true, description: '指定期間的收入 / 費用 / 淨利' },
  'cash-flow': { label: '現金流量表', needsStartDate: true, description: '現金帳戶在指定期間的流入流出' },
};

function formatCurrency(n: number): string {
  return n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function FinancialReports() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(0, 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reportType, setReportType] = useState<ReportType>('income-statement');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trialBalance, setTrialBalance] = useState<TrialBalance | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheet | null>(null);
  const [incomeStatement, setIncomeStatement] = useState<IncomeStatement | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowStatement | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    // 清空所有報表,避免舊資料殘留
    setTrialBalance(null);
    setBalanceSheet(null);
    setIncomeStatement(null);
    setCashFlow(null);
    try {
      switch (reportType) {
        case 'trial-balance':
          setTrialBalance(await accountingReportsApi.trialBalance(startDate, endDate));
          break;
        case 'balance-sheet':
          setBalanceSheet(await accountingReportsApi.balanceSheet(endDate));
          break;
        case 'income-statement':
          setIncomeStatement(await accountingReportsApi.incomeStatement(startDate, endDate));
          break;
        case 'cash-flow':
          setCashFlow(await accountingReportsApi.cashFlow(startDate, endDate));
          break;
      }
    } catch (err: any) {
      setError(err.message ?? '產生報表失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="財務報表"
        description="依會計期間產生專業財務報表"
      />

      <Card>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">報表類型</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
            >
              {(Object.keys(REPORT_META) as ReportType[]).map((k) => (
                <option key={k} value={k}>{REPORT_META[k].label}</option>
              ))}
            </select>
          </div>
          {REPORT_META[reportType].needsStartDate && (
            <div>
              <label className="block text-xs text-gray-600 mb-1">開始日期</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          )}
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              {REPORT_META[reportType].needsStartDate ? '結束日期' : '基準日期'}
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={generate} disabled={loading} className="w-full">
              {loading ? '產生中...' : '產生報表'}
            </Button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">{REPORT_META[reportType].description}</p>
      </Card>

      {error && (
        <Card className="bg-red-50 border-red-200">
          <div className="text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        </Card>
      )}

      {/* Trial Balance */}
      {trialBalance && (
        <Card>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            試算表 ({trialBalance.startDate} ~ {trialBalance.endDate})
            {trialBalance.balanced ? (
              <span className="ml-2 text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                借貸平衡
              </span>
            ) : (
              <span className="ml-2 text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded inline-flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                借貸不平衡!
              </span>
            )}
          </h3>

          <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-blue-50 rounded-lg">
            <div>
              <p className="text-xs text-gray-600">借方合計</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(trialBalance.totalDebit)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">貸方合計</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(trialBalance.totalCredit)}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 text-left text-xs text-gray-600">
                  <th className="px-2 py-2">代碼</th>
                  <th className="px-2 py-2">科目</th>
                  <th className="px-2 py-2 text-right">期初借</th>
                  <th className="px-2 py-2 text-right">期初貸</th>
                  <th className="px-2 py-2 text-right">本期借</th>
                  <th className="px-2 py-2 text-right">本期貸</th>
                  <th className="px-2 py-2 text-right">期末借</th>
                  <th className="px-2 py-2 text-right">期末貸</th>
                </tr>
              </thead>
              <tbody>
                {trialBalance.accounts.map((a) => (
                  <tr key={a.accountId} className="border-b hover:bg-gray-50">
                    <td className="px-2 py-1.5 font-mono text-xs">{a.code}</td>
                    <td className="px-2 py-1.5">{a.name}</td>
                    <td className="px-2 py-1.5 text-right">{formatCurrency(a.openingDebit)}</td>
                    <td className="px-2 py-1.5 text-right">{formatCurrency(a.openingCredit)}</td>
                    <td className="px-2 py-1.5 text-right">{formatCurrency(a.periodDebit)}</td>
                    <td className="px-2 py-1.5 text-right">{formatCurrency(a.periodCredit)}</td>
                    <td className="px-2 py-1.5 text-right">{formatCurrency(a.closingDebit)}</td>
                    <td className="px-2 py-1.5 text-right">{formatCurrency(a.closingCredit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Balance Sheet */}
      {balanceSheet && (
        <Card>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            資產負債表 (基準日: {balanceSheet.endDate})
            {balanceSheet.balanced ? (
              <span className="ml-2 text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                平衡
              </span>
            ) : (
              <span className="ml-2 text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded inline-flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                不平衡!
              </span>
            )}
          </h3>

          <div className="grid grid-cols-2 gap-4">
            {/* 資產 */}
            <div className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-blue-700">資產</h4>
                <span className="text-sm font-mono">{formatCurrency(balanceSheet.assets.total)}</span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {balanceSheet.assets.items.map((it) => (
                    <tr key={it.code} className="border-b last:border-0">
                      <td className="py-1 font-mono text-xs">{it.code}</td>
                      <td className="py-1">{it.name}</td>
                      <td className="py-1 text-right">{formatCurrency(it.balance)}</td>
                    </tr>
                  ))}
                  {balanceSheet.assets.items.length === 0 && (
                    <tr><td colSpan={3} className="py-2 text-center text-gray-400 text-xs">(無資料)</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 負債 + 權益 */}
            <div className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-red-700">負債</h4>
                <span className="text-sm font-mono">{formatCurrency(balanceSheet.liabilities.total)}</span>
              </div>
              <table className="w-full text-sm mb-3">
                <tbody>
                  {balanceSheet.liabilities.items.map((it) => (
                    <tr key={it.code} className="border-b last:border-0">
                      <td className="py-1 font-mono text-xs">{it.code}</td>
                      <td className="py-1">{it.name}</td>
                      <td className="py-1 text-right">{formatCurrency(it.balance)}</td>
                    </tr>
                  ))}
                  {balanceSheet.liabilities.items.length === 0 && (
                    <tr><td colSpan={3} className="py-2 text-center text-gray-400 text-xs">(無資料)</td></tr>
                  )}
                </tbody>
              </table>

              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-purple-700">權益</h4>
                <span className="text-sm font-mono">{formatCurrency(balanceSheet.equity.total)}</span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {balanceSheet.equity.items.map((it) => (
                    <tr key={it.code} className="border-b last:border-0">
                      <td className="py-1 font-mono text-xs">{it.code}</td>
                      <td className="py-1">{it.name}</td>
                      <td className="py-1 text-right">{formatCurrency(it.balance)}</td>
                    </tr>
                  ))}
                  {balanceSheet.equity.items.length === 0 && (
                    <tr><td colSpan={3} className="py-2 text-center text-gray-400 text-xs">(無資料)</td></tr>
                  )}
                  <tr className="border-t">
                    <td colSpan={2} className="py-1 text-xs text-gray-500">本期損益</td>
                    <td className="py-1 text-right text-xs">{formatCurrency(balanceSheet.netIncome)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-3 p-3 bg-gray-50 rounded text-sm flex justify-between">
            <span>負債 + 權益合計</span>
            <span className="font-mono font-semibold">{formatCurrency(balanceSheet.totalLiabilitiesAndEquity)}</span>
          </div>
        </Card>
      )}

      {/* Income Statement */}
      {incomeStatement && (
        <Card>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            損益表 ({incomeStatement.startDate} ~ {incomeStatement.endDate})
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-green-700">收入</h4>
                <span className="text-sm font-mono">{formatCurrency(incomeStatement.revenues.total)}</span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {incomeStatement.revenues.items.map((it) => (
                    <tr key={it.code} className="border-b last:border-0">
                      <td className="py-1 font-mono text-xs">{it.code}</td>
                      <td className="py-1">{it.name}</td>
                      <td className="py-1 text-right">{formatCurrency(it.amount)}</td>
                    </tr>
                  ))}
                  {incomeStatement.revenues.items.length === 0 && (
                    <tr><td colSpan={3} className="py-2 text-center text-gray-400 text-xs">(無收入)</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-orange-700">費用</h4>
                <span className="text-sm font-mono">{formatCurrency(incomeStatement.expenses.total)}</span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {incomeStatement.expenses.items.map((it) => (
                    <tr key={it.code} className="border-b last:border-0">
                      <td className="py-1 font-mono text-xs">{it.code}</td>
                      <td className="py-1">{it.name}</td>
                      <td className="py-1 text-right">{formatCurrency(it.amount)}</td>
                    </tr>
                  ))}
                  {incomeStatement.expenses.items.length === 0 && (
                    <tr><td colSpan={3} className="py-2 text-center text-gray-400 text-xs">(無費用)</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-3 p-3 bg-blue-50 rounded flex justify-between font-semibold">
            <span>本期淨利</span>
            <span className={`font-mono ${incomeStatement.netIncome >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {formatCurrency(incomeStatement.netIncome)}
            </span>
          </div>
        </Card>
      )}

      {/* Cash Flow */}
      {cashFlow && (
        <Card>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            現金流量表 ({cashFlow.startDate} ~ {cashFlow.endDate})
          </h3>

          <div className="grid grid-cols-3 gap-4 mb-4 p-4 bg-blue-50 rounded-lg">
            <div>
              <p className="text-xs text-gray-600">期初現金</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(cashFlow.openingCash)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">期末現金</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(cashFlow.closingCash)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">本期淨流</p>
              <p className={`text-lg font-bold ${cashFlow.netCashFlow >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {formatCurrency(cashFlow.netCashFlow)}
              </p>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 text-left text-xs text-gray-600">
                <th className="px-2 py-2">代碼</th>
                <th className="px-2 py-2">現金帳戶</th>
                <th className="px-2 py-2 text-right">期初</th>
                <th className="px-2 py-2 text-right">流入</th>
                <th className="px-2 py-2 text-right">流出</th>
                <th className="px-2 py-2 text-right">期末</th>
              </tr>
            </thead>
            <tbody>
              {cashFlow.accounts.map((a) => (
                <tr key={a.code} className="border-b hover:bg-gray-50">
                  <td className="px-2 py-1.5 font-mono text-xs">{a.code}</td>
                  <td className="px-2 py-1.5">{a.name}</td>
                  <td className="px-2 py-1.5 text-right">{formatCurrency(a.opening)}</td>
                  <td className="px-2 py-1.5 text-right">{formatCurrency(cashFlow.totalInflow)}</td>
                  <td className="px-2 py-1.5 text-right">{formatCurrency(cashFlow.totalOutflow)}</td>
                  <td className="px-2 py-1.5 text-right">{formatCurrency(a.closing)}</td>
                </tr>
              ))}
              {cashFlow.accounts.length === 0 && (
                <tr><td colSpan={6} className="py-3 text-center text-gray-400">(無現金帳戶或無變動)</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}