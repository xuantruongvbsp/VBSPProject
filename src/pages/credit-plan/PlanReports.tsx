import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/Card';
import { useCreditPlanStore } from '@/store/useCreditPlanStore';
import { nguonVonLabel, xaLabel } from '@/lib/credit-plan-types';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

function fmtMoney(n: number) {
  return n.toLocaleString('vi-VN');
}

function PctBadge({ pct }: { pct: number }) {
  const color =
    pct >= 100
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300'
      : pct >= 80
        ? 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300'
        : 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-300';
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${color}`}>
      {pct.toFixed(1)}%
    </span>
  );
}

export function PlanReports() {
  const plans = useCreditPlanStore((s) => s.plans);
  const actuals = useCreditPlanStore((s) => s.actuals);
  const getPlanVsActual = useCreditPlanStore((s) => s.getPlanVsActual);
  const [groupBy, setGroupBy] = useState<'xa' | 'chuongtrinh' | 'nguonvon'>('xa');

  const comparison = useMemo(() => getPlanVsActual(), [getPlanVsActual, plans, actuals]);

  const hasData = plans.length > 0 || actuals.length > 0;

  // Aggregate comparison by groupBy
  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; plan: number; actual: number }>();
    for (const c of comparison) {
      let key: string;
      let label: string;
      if (groupBy === 'xa') {
        key = c.maXa;
        label = c.tenXa;
      } else if (groupBy === 'chuongtrinh') {
        key = c.maChuongTrinh;
        label = c.tenChuongTrinh;
      } else {
        key = c.maNguonVon;
        label = nguonVonLabel(c.maNguonVon);
      }
      const existing = map.get(key);
      if (existing) {
        existing.plan += c.planAmount;
        existing.actual += c.actualAmount;
      } else {
        map.set(key, { label, plan: c.planAmount, actual: c.actualAmount });
      }
    }
    return Array.from(map.values()).map((d) => ({
      ...d,
      plan: Math.round(d.plan),
      actual: Math.round(d.actual),
      pct: d.plan > 0 ? Math.round((d.actual / d.plan) * 10000) / 100 : 0,
    }));
  }, [comparison, groupBy]);

  // Overall totals
  const totalPlan = comparison.reduce((s, c) => s + c.planAmount, 0);
  const totalActual = comparison.reduce((s, c) => s + c.actualAmount, 0);
  const overallPct = totalPlan > 0 ? (totalActual / totalPlan) * 100 : 0;

  // Pie data for plan distribution by xa
  const piePlan = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of plans) {
      map.set(p.tenXa || p.maXa, (map.get(p.tenXa || p.maXa) || 0) + p.soTien);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [plans]);

  if (!hasData) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-center text-slate-400">
          <p className="text-lg font-medium">Chưa có dữ liệu</p>
          <p className="mt-1 text-sm">Vui lòng nhập kế hoạch và/hoặc dữ liệu thực tế trước.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Báo cáo Kế hoạch vs Thực tế</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          So sánh kế hoạch dư nợ với dư nợ thực tế theo từng nhóm
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Tổng kế hoạch</div>
            <div className="mt-1 text-2xl font-bold text-blue-600">{fmtMoney(Math.round(totalPlan))}</div>
            <div className="text-xs text-slate-500">triệu đồng</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Tổng thực tế</div>
            <div className="mt-1 text-2xl font-bold text-emerald-600">{fmtMoney(Math.round(totalActual))}</div>
            <div className="text-xs text-slate-500">triệu đồng</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Chênh lệch</div>
            <div className={`mt-1 text-2xl font-bold ${totalActual - totalPlan >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {totalActual - totalPlan >= 0 ? '+' : ''}{fmtMoney(Math.round(totalActual - totalPlan))}
            </div>
            <div className="text-xs text-slate-500">triệu đồng</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Tỷ lệ hoàn thành</div>
            <div className={`mt-1 text-2xl font-bold ${overallPct >= 100 ? 'text-emerald-600' : overallPct >= 80 ? 'text-amber-600' : 'text-rose-600'}`}>
              {overallPct.toFixed(1)}%
            </div>
            <div className="text-xs text-slate-500">thực tế / kế hoạch</div>
          </CardContent>
        </Card>
      </div>

      {/* Group by selector */}
      <div className="flex gap-2">
        <span className="self-center text-sm text-slate-600 dark:text-slate-300">Nhóm theo:</span>
        {([
          ['xa', 'Xã'],
          ['chuongtrinh', 'Chương trình'],
          ['nguonvon', 'Nguồn vốn'],
        ] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setGroupBy(val)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              groupBy === val
                ? 'bg-plan-700 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Bar chart: Plan vs Actual */}
      {grouped.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Kế hoạch vs Thực tế</CardTitle>
            <CardDescription>Đơn vị: triệu đồng</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={grouped} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => fmtMoney(v)} />
                <YAxis dataKey="label" type="category" width={180} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => fmtMoney(value) + ' tr.đ'}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Legend />
                <Bar dataKey="plan" name="Kế hoạch" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                <Bar dataKey="actual" name="Thực tế" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pie chart: Plan distribution */}
        {piePlan.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Cơ cấu kế hoạch theo xã</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={piePlan}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {piePlan.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => fmtMoney(value) + ' tr.đ'} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Completion rate by group */}
        {grouped.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Tỷ lệ hoàn thành</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {grouped.map((g) => (
                  <div key={g.label}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-slate-700 dark:text-slate-200">{g.label}</span>
                      <PctBadge pct={g.pct} />
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className={`h-full rounded-full transition-all ${
                          g.pct >= 100 ? 'bg-emerald-500' : g.pct >= 80 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(g.pct, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Detail comparison table */}
      <Card>
        <CardHeader>
          <CardTitle>Chi tiết so sánh</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Xã</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Nguồn vốn</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Chương trình</th>
                  <th className="px-4 py-3 text-right font-medium text-blue-600">KH (tr.đ)</th>
                  <th className="px-4 py-3 text-right font-medium text-emerald-600">TT (tr.đ)</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">Chênh lệch</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">Tỷ lệ</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((c) => (
                  <tr
                    key={`${c.maXa}-${c.maNguonVon}-${c.maChuongTrinh}`}
                    className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-4 py-2 text-slate-900 dark:text-white">{c.tenXa}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{nguonVonLabel(c.maNguonVon)}</td>
                    <td className="max-w-[220px] truncate px-4 py-2 text-slate-600 dark:text-slate-300">{c.tenChuongTrinh}</td>
                    <td className="px-4 py-2 text-right font-mono text-blue-600">{fmtMoney(Math.round(c.planAmount))}</td>
                    <td className="px-4 py-2 text-right font-mono text-emerald-600">{fmtMoney(Math.round(c.actualAmount))}</td>
                    <td className={`px-4 py-2 text-right font-mono ${c.diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {c.diff >= 0 ? '+' : ''}{fmtMoney(Math.round(c.diff))}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {c.planAmount > 0 ? <PctBadge pct={c.pct} /> : <span className="text-xs text-slate-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              {comparison.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold dark:border-slate-600 dark:bg-slate-800">
                    <td colSpan={3} className="px-4 py-2.5 text-slate-700 dark:text-slate-200">Tổng cộng</td>
                    <td className="px-4 py-2.5 text-right font-mono text-blue-600">{fmtMoney(Math.round(totalPlan))}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-emerald-600">{fmtMoney(Math.round(totalActual))}</td>
                    <td className={`px-4 py-2.5 text-right font-mono ${totalActual - totalPlan >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {totalActual - totalPlan >= 0 ? '+' : ''}{fmtMoney(Math.round(totalActual - totalPlan))}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <PctBadge pct={overallPct} />
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
