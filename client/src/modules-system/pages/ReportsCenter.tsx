import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { PieChart } from 'lucide-react';
import { modules, type ReportData } from '@/modules-system/registry';

export function ReportsCenter() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(0, 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  // 收集所有啟用模組提供的 reports
  const allReports = modules.enabled().flatMap((m) =>
    (m.reports || []).map((r) => ({ ...r, moduleName: m.name, moduleId: m.id }))
  );

  async function generate(reportId: string) {
    const moduleId = modules.all().find((m) => m.reports?.some((r) => r.id === reportId))?.id;
    if (!moduleId) return;
    const report = modules.get(moduleId)?.reports?.find((r) => r.id === reportId);
    if (!report) return;

    setLoading(true);
    setSelectedReport(reportId);
    try {
      const result = await report.generate({ startDate, endDate });
      setData(result);
    } catch (err: any) {
      alert('報表產生失敗：' + err.message);
    } finally {
      setLoading(false);
    }
  }

  if (allReports.length === 0) {
    return (
      <div className="p-12 text-center text-gray-500">
        <PieChart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p>目前沒有啟用的報表模組</p>
        <p className="text-xs mt-2">到「模組管理」啟用報表相關模組</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <PageHeader title="報表中心" description="所有啟用模組的報表統一入口" />

      <Card>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">開始日期</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">結束日期</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md" />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {allReports.map((r) => (
          <button
            key={r.id}
            onClick={() => generate(r.id)}
            disabled={loading}
            className={`p-4 text-left bg-white rounded-lg border-2 transition-colors hover:border-blue-400 ${
              selectedReport === r.id ? 'border-blue-500' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <PieChart className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-900">{r.name}</span>
            </div>
            <p className="text-xs text-gray-500">由「{r.moduleName}」提供</p>
          </button>
        ))}
      </div>

      {data && (
        <Card>
          <h3 className="text-lg font-semibold mb-4">{data.title}</h3>
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
                    <th key={c.key} className="px-4 py-2 text-left text-sm font-medium">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, i) => (
                  <tr key={i} className="border-b">
                    {data.columns.map((c) => (
                      <td key={c.key} className="px-4 py-2 text-sm">
                        {(() => {
                          const v = (row as any)[c.key];
                          return typeof v === 'number' ? v.toLocaleString() : v;
                        })()}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
