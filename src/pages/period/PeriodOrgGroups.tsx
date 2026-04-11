import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ListOrdered } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { FilterBar } from '@/components/filters/FilterBar';
import { InfoPopover } from '@/components/ui/InfoPopover';
import { ExportMenu } from '@/components/export/ExportMenu';
import { usePeriodFilterStore } from '@/store/usePeriodFilterStore';
import { usePeriodStore } from '@/store/usePeriodStore';
import { usePeriodCompare } from './usePeriodCompare';
import { fmtCompact, fmtCurrency, fmtDate, fmtNumber, fmtPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { LoanRecord } from '@/lib/types';
import type { FilterField } from '@/store/useDataStore';

/**
 * Trang 6 — "Hội đoàn thể & Tổ TK&VV". Tập trung vào hai trục đặc thù
 * của VBSP: 4 đơn vị ủy thác (HLHPN/HND/HCCB/ĐTN) và các Tổ tiết kiệm
 * và vay vốn. Mỗi nhóm so sánh dư nợ kỳ trước → kỳ sau, NQH, số khế ước
 * và roll/cure tương đối.
 */

interface RowAgg {
  key: string;
  prevTongDuNo: number;
  currTongDuNo: number;
  prevDuNoQH: number;
  currDuNoQH: number;
  prevCount: number;
  currCount: number;
  prevSoKH: Set<string>;
  currSoKH: Set<string>;
}

function aggregateBy(rows: LoanRecord[], field: keyof LoanRecord, slot: 'prev' | 'curr', map: Map<string, RowAgg>) {
  for (const r of rows) {
    const k = String(r[field] ?? '—') || '—';
    let g = map.get(k);
    if (!g) {
      g = {
        key: k,
        prevTongDuNo: 0,
        currTongDuNo: 0,
        prevDuNoQH: 0,
        currDuNoQH: 0,
        prevCount: 0,
        currCount: 0,
        prevSoKH: new Set(),
        currSoKH: new Set(),
      };
      map.set(k, g);
    }
    if (slot === 'prev') {
      g.prevTongDuNo += r.tongDuNo;
      g.prevDuNoQH += r.duNoQuaHan;
      g.prevCount += 1;
      if (r.maKH) g.prevSoKH.add(r.maKH);
    } else {
      g.currTongDuNo += r.tongDuNo;
      g.currDuNoQH += r.duNoQuaHan;
      g.currCount += 1;
      if (r.maKH) g.currSoKH.add(r.maKH);
    }
  }
}

function compute(rows: RowAgg[]) {
  return rows
    .map((g) => {
      const prevPct = g.prevTongDuNo > 0 ? g.prevDuNoQH / g.prevTongDuNo : 0;
      const currPct = g.currTongDuNo > 0 ? g.currDuNoQH / g.currTongDuNo : 0;
      return {
        ...g,
        deltaDuNo: g.currTongDuNo - g.prevTongDuNo,
        prevPct,
        currPct,
        deltaPct: currPct - prevPct,
      };
    })
    .sort((a, b) => b.currTongDuNo - a.currTongDuNo);
}

export function PeriodOrgGroupsPage() {
  const navigate = useNavigate();
  const setPendingDrill = usePeriodStore((s) => s.setPendingDrill);
  const { hasData, prevRows, currRows, prevDate, currDate, kpiDelta } = usePeriodCompare();

  const dvut = useMemo(() => {
    const m = new Map<string, RowAgg>();
    aggregateBy(prevRows, 'tenDVUT', 'prev', m);
    aggregateBy(currRows, 'tenDVUT', 'curr', m);
    return compute(Array.from(m.values()));
  }, [prevRows, currRows]);

  const tos = useMemo(() => {
    const m = new Map<string, RowAgg>();
    aggregateBy(prevRows, 'tenTo', 'prev', m);
    aggregateBy(currRows, 'tenTo', 'curr', m);
    return compute(Array.from(m.values()));
  }, [prevRows, currRows]);

  // Phân loại các Tổ theo biến động NQH
  const tosBuckets = useMemo(() => {
    const worsened = [...tos]
      .filter((t) => t.deltaPct > 0.0005 && t.currTongDuNo > 0)
      .sort((a, b) => b.deltaPct - a.deltaPct)
      .slice(0, 15);
    const improved = [...tos]
      .filter((t) => t.deltaPct < -0.0005 && t.prevTongDuNo > 0)
      .sort((a, b) => a.deltaPct - b.deltaPct)
      .slice(0, 15);
    return { worsened, improved };
  }, [tos]);

  if (!hasData) return <div className="p-6 text-sm text-slate-500">Chưa có dữ liệu so sánh.</div>;

  const handleDrill = (field: FilterField, value: string) => {
    setPendingDrill({ to: '/period/khe-uoc', filters: [{ field, value }] });
    navigate('/period/khe-uoc');
  };

  return (
    <div className="space-y-5 p-6">
      <header>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Hội đoàn thể & Tổ TK&VV</h1>
            <InfoPopover metricKey="pagePeriodOrgGroups" />
          </div>
          <ExportMenu
            pageTitle="Hội đoàn thể & Tổ TK&VV — So sánh hai kỳ"
            subtitle={`${fmtDate(prevDate)} → ${fmtDate(currDate)} · ${fmtNumber(currRows.length)} khế ước kỳ sau`}
            rows={currRows}
            kpi={kpiDelta.curr}
            size="sm"
          />
        </div>
        <p className="text-sm text-slate-600">
          Hiệu quả ủy thác qua bốn hội đoàn thể và các Tổ tiết kiệm và vay vốn. Bấm vào dòng để
          mở danh sách khế ước thuộc nhóm tương ứng.
        </p>
      </header>

      <Card>
        <CardContent className="py-3">
          <FilterBar useStore={usePeriodFilterStore} accent="period" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-period-700" />
              Bốn Đơn vị ủy thác
            </CardTitle>
            <InfoPopover metricKey="periodDvut" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-3 py-2">Đơn vị ủy thác</th>
                  <th className="px-3 py-2 text-right">KH kỳ sau</th>
                  <th className="px-3 py-2 text-right">KƯ kỳ sau</th>
                  <th className="px-3 py-2 text-right">Dư nợ kỳ trước</th>
                  <th className="px-3 py-2 text-right">Dư nợ kỳ sau</th>
                  <th className="px-3 py-2 text-right">Δ dư nợ</th>
                  <th className="px-3 py-2 text-right">% NQH kỳ trước</th>
                  <th className="px-3 py-2 text-right">% NQH kỳ sau</th>
                  <th className="px-3 py-2 text-right">Δ % NQH</th>
                </tr>
              </thead>
              <tbody>
                {dvut.map((g) => (
                  <tr
                    key={g.key}
                    onClick={() => handleDrill('tenDVUT', g.key)}
                    className="cursor-pointer border-t border-slate-100 hover:bg-period-50"
                  >
                    <td className="px-3 py-2 font-semibold text-slate-800">{g.key}</td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {fmtNumber(g.currSoKH.size)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">{fmtNumber(g.currCount)}</td>
                    <td className="px-3 py-2 text-right text-slate-600">
                      {fmtCompact(g.prevTongDuNo)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-900">
                      {fmtCompact(g.currTongDuNo)}
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right font-semibold',
                        g.deltaDuNo > 0 ? 'text-emerald-700' : g.deltaDuNo < 0 ? 'text-rose-600' : 'text-slate-500'
                      )}
                    >
                      {g.deltaDuNo > 0 ? '+' : ''}
                      {fmtCompact(g.deltaDuNo)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">
                      {fmtPercent(g.prevPct * 100)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {fmtPercent(g.currPct * 100)}
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right font-semibold',
                        g.deltaPct > 0.0005 ? 'text-rose-600' : g.deltaPct < -0.0005 ? 'text-emerald-700' : 'text-slate-500'
                      )}
                    >
                      {g.deltaPct > 0 ? '+' : ''}
                      {(g.deltaPct * 100).toFixed(3)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ListOrdered className="h-4 w-4 text-rose-600" />
                  Tổ TK&VV — biến động xấu nhất
                </CardTitle>
                <div className="text-[11px] text-slate-500">
                  Top 15 Tổ có Δ% NQH tăng cao nhất giữa hai kỳ
                </div>
              </div>
              <InfoPopover metricKey="periodToWorsened" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ToTable rows={tosBuckets.worsened} tone="bad" onPick={(k) => handleDrill('tenTo', k)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ListOrdered className="h-4 w-4 text-emerald-700" />
                  Tổ TK&VV — cải thiện nhiều nhất
                </CardTitle>
                <div className="text-[11px] text-slate-500">
                  Top 15 Tổ có Δ% NQH giảm nhiều nhất giữa hai kỳ
                </div>
              </div>
              <InfoPopover metricKey="periodToImproved" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ToTable rows={tosBuckets.improved} tone="good" onPick={(k) => handleDrill('tenTo', k)} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="py-3 text-[11px] text-slate-500">
          Tổng số Tổ TK&VV xuất hiện trong hai kỳ: <strong>{fmtNumber(tos.length)}</strong> · Tổng
          dư nợ kỳ sau: <strong>{fmtCurrency(tos.reduce((s, t) => s + t.currTongDuNo, 0))}</strong>
        </CardContent>
      </Card>
    </div>
  );
}

function ToTable({
  rows,
  tone,
  onPick,
}: {
  rows: ReturnType<typeof compute>;
  tone: 'good' | 'bad';
  onPick: (key: string) => void;
}) {
  const accent = tone === 'good' ? 'text-emerald-700' : 'text-rose-600';
  if (rows.length === 0) {
    return <div className="px-4 py-6 text-center text-xs text-slate-400">Không có biến động.</div>;
  }
  return (
    <div className="scrollbar-thin max-h-[440px] overflow-y-auto">
      <table className="w-full text-xs">
        <tbody>
          {rows.map((g, i) => (
            <tr
              key={g.key}
              onClick={() => onPick(g.key)}
              className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-period-50"
            >
              <td className="w-7 px-3 py-2 text-[10px] text-slate-400">{i + 1}</td>
              <td className="px-2 py-2">
                <div className="truncate font-medium text-slate-800">{g.key}</div>
                <div className="text-[10px] text-slate-500">
                  {fmtCompact(g.currTongDuNo)} dư nợ · {fmtNumber(g.currCount)} KƯ
                </div>
              </td>
              <td className="px-3 py-2 text-right">
                <div className={cn('font-bold', accent)}>
                  {g.deltaPct > 0 ? '+' : ''}
                  {(g.deltaPct * 100).toFixed(2)}%
                </div>
                <div className="text-[10px] text-slate-500">
                  {fmtPercent(g.prevPct * 100)} → {fmtPercent(g.currPct * 100)}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
