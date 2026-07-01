import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { BarChart3 } from 'lucide-react';
import { doubleEntryManifest } from '@/modules-system/modules/double-entry';
import type { ReportData } from '@/modules-system/registry';

export function FinancialReports() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(0, 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reportType, setReportType] = useState<string>('income-statement');
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const report = doubleEntryManifest.reports?.find((r) => r.id === reportType);
      if (!report) return;
      const result = await report.generate({ startDate, endDate });
      setData(result);
    } catch (err: any) {
      alert('產生報表失敗：' + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reports = doubleEntryManifest.reports || [];

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
              onChange={(e) => setReportType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              {reports.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">開始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">結束日期</label>
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
      </Card>

      {data && (
        <Card>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            {data.title}
          </h3>

          {data.summary && (
            <div className="grid grid-cols-3 gap-4 mb-4 p-4 bg-blue-50 rounded-lg">
              {Object.entries(data.summary).map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-gray-600">{k}</p>
                  <p className="text-xl font-bold text-gray-900">
                    {typeof v === 'number' ? v.toLocaleString() : String(v)}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2">
                  {data.columns.map((c) => (
                    <th key={c.key} className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, i) => {
                  const isSection = (row as any).section;
                  const isTotal = (row as any).total;
                  return (
                    <tr key={i} className={`border-b ${isSection ? 'bg-gray-100' : isTotal ? 'bg-blue-50 font-medium' : ''}`}>
                      {data.columns.map((c) => {
                        const v = (row as any)[c.key];
                        return (
                          <td key={c.key} className="px-4 py-2 text-sm">
                            {isSection ? <span className="font-medium">{v}</span> : isTotal ? v : v}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
