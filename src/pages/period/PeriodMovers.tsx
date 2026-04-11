import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { FilterBar } from '@/components/filters/FilterBar';
import { InfoPopover } from '@/components/ui/InfoPopover';
import { ExportMenu } from '@/components/export/ExportMenu';
import { usePeriodFilterStore } from '@/store/usePeriodFilterStore';
import { usePeriodStore } from '@/store/usePeriodStore';
import { usePeriodCompare } from './usePeriodCompare';
import { topMovers, type MoverMetric, type MoverRow } from '@/lib/period-compare';
import { fmtCompact, fmtDate, fmtNumber, fmtPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { LoanRecord } from '@/lib/types';
import type { FilterField } from '@/store/useDataStore';

/**
 * Trang 3 — Top tăng/giảm theo nhóm. Người dùng chọn dimension (PGD/Xã/
 * ĐVUT/Chương trình/Tổ TK&VV) × metric (Tổng dư nợ / Tỷ lệ NQH / Roll
 * rate). Hiển thị hai cột Top 10 cải thiện vs Top 10 giảm sút bên cạnh
 * nhau. Click một dòng sẽ drilldown sang trang "Khế ước biến động" với
 * bộ lọc đã được áp đặt sẵn.
 */

interface Dimension {
  id: keyof LoanRecord;
  filterField: FilterField;
  label: string;
}

const DIMENSIONS: Dimension[] = [
  { id: 'tenPGD', filterField: 'tenPGD', label: 'PGD' },
  { id: 'tenXa', filterField: 'tenXa', label: 'Xã' },
  { id: 'tenDVUT', filterField: 'tenDVUT', label: 'ĐVUT' },
  { id: 'tenChuongTrinh', filterField: 'tenChuongTrinh', label: 'Chương trình' },
  { id: 'tenTo', filterField: 'tenTo', label: 'Tổ TK&VV' },
];

const METRICS: { id: MoverMetric; label: string; help: string }[] = [
  { id: 'tongDuNo', label: 'Tổng dư nợ', help: 'Δ tuyệt đối dư nợ kỳ sau − kỳ trước' },
  { id: 'tyLeNQH', label: 'Tỷ lệ NQH', help: 'Δ tuyệt đối tỷ lệ NQH (điểm phần trăm)' },
  { id: 'rollRate', label: 'Roll rate', help: 'Tỷ lệ chuyển xấu trong kỳ — chỉ xếp giảm sút' },
];

export function PeriodMoversPage() {
  const navigate = useNavigate();
  const setPendingDrill = usePeriodStore((s) => s.setPendingDrill);
  const { hasData, loanJoin, currRows, kpiDelta, prevDate, currDate } = usePeriodCompare();
  const [dim, setDim] = useState<Dimension>(DIMENSIONS[0]);
  const [metric, setMetric] = useState<MoverMetric>('tongDuNo');

  const movers = useMemo(
    () => topMovers(loanJoin.joined, dim.id, metric),
    [loanJoin, dim, metric]
  );

  // Lọc bỏ các nhóm có dư nợ quá nhỏ ở cả hai kỳ để tránh nhiễu thống kê.
  const minBase = useMemo(() => {
    const totals = movers.map((m) => Math.max(m.prevTongDuNo, m.currTongDuNo));
    totals.sort((a, b) => b - a);
    // Giữ lại nhóm có dư nợ ≥ 0,5% nhóm lớn nhất
    return (totals[0] ?? 0) * 0.005;
  }, [movers]);

  const filtered = useMemo(
    () => movers.filter((m) => Math.max(m.prevTongDuNo, m.currTongDuNo) >= minBase),
    [movers, minBase]
  );

  const { topImproved, topWorsened } = useMemo(() => {
    if (metric === 'rollRate') {
      // Roll rate càng cao càng xấu — không có khái niệm "cải thiện" thuần
      const sorted = [...filtered].sort((a, b) => b.currValue - a.currValue);
      return {
        topImproved: [] as MoverRow[],
        topWorsened: sorted.slice(0, 10),
      };
    }
    const isBadUp = metric === 'tyLeNQH';
    // Improved: nếu metric là "good-up" thì delta>0 là cải thiện;
    // nếu là "bad-up" thì delta<0 là cải thiện.
    const improved = [...filtered].sort((a, b) => (isBadUp ? a.delta - b.delta : b.delta - a.delta));
    const worsened = [...filtered].sort((a, b) => (isBadUp ? b.delta - a.delta : a.delta - b.delta));
    return {
      topImproved: improved.slice(0, 10),
      topWorsened: worsened.slice(0, 10),
    };
  }, [filtered, metric]);

  if (!hasData) return <div className="p-6 text-sm text-slate-500">Chưa có dữ liệu so sánh.</div>;

  const handleDrill = (groupKey: string) => {
    setPendingDrill({
      to: '/period/khe-uoc',
      filters: [{ field: dim.filterField, value: groupKey }],
    });
    navigate('/period/khe-uoc');
  };

  return (
    <div className="space-y-5 p-6">
      <header>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Top tăng / giảm theo nhóm</h1>
            <InfoPopover metricKey="pagePeriodMovers" />
          </div>
          <ExportMenu
            pageTitle="Top tăng / giảm theo nhóm — So sánh hai kỳ"
            subtitle={`${fmtDate(prevDate)} → ${fmtDate(currDate)} · ${fmtNumber(currRows.length)} khế ước kỳ sau`}
            rows={currRows}
            kpi={kpiDelta.curr}
            size="sm"
          />
        </div>
        <p className="text-sm text-slate-600">
          Xếp hạng các nhóm có biến động lớn nhất giữa hai kỳ. Bấm vào một dòng để mở bảng khế ước
          biến động đã lọc sẵn theo nhóm đó.
        </p>
      </header>

      <Card>
        <CardContent className="py-3">
          <FilterBar useStore={usePeriodFilterStore} accent="period" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Phân theo
            </div>
            <div className="inline-flex flex-wrap gap-1 rounded-md border border-slate-200 bg-slate-50 p-0.5">
              {DIMENSIONS.map((d) => (
                <button
                  key={d.id as string}
                  type="button"
                  onClick={() => setDim(d)}
                  className={cn(
                    'rounded px-2.5 py-1 text-[11px] font-medium transition-colors',
                    dim.id === d.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Chỉ tiêu
            </div>
            <div className="inline-flex flex-wrap gap-1 rounded-md border border-slate-200 bg-slate-50 p-0.5">
              {METRICS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMetric(m.id)}
                  className={cn(
                    'rounded px-2.5 py-1 text-[11px] font-medium transition-colors',
                    metric === m.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="text-[11px] text-slate-500">
              {METRICS.find((m) => m.id === metric)?.help}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RankingCard
          title="Top 10 cải thiện"
          subtitle={metric === 'rollRate' ? '— không áp dụng cho roll rate' : 'Nhóm có biến động tích cực nhất'}
          rows={topImproved}
          metric={metric}
          tone="good"
          onPick={handleDrill}
        />
        <RankingCard
          title="Top 10 giảm sút"
          subtitle={
            metric === 'rollRate'
              ? 'Nhóm có roll rate cao nhất kỳ này'
              : 'Nhóm có biến động tiêu cực nhất'
          }
          rows={topWorsened}
          metric={metric}
          tone="bad"
          onPick={handleDrill}
        />
      </div>
    </div>
  );
}

function RankingCard({
  title,
  subtitle,
  rows,
  metric,
  tone,
  onPick,
}: {
  title: string;
  subtitle: string;
  rows: MoverRow[];
  metric: MoverMetric;
  tone: 'good' | 'bad';
  onPick: (key: string) => void;
}) {
  const accent = tone === 'good' ? 'text-emerald-700' : 'text-rose-700';
  const accentBg = tone === 'good' ? 'bg-emerald-50' : 'bg-rose-50';
  const borderColor = tone === 'good' ? 'border-emerald-200' : 'border-rose-200';
  const Icon = tone === 'good' ? ArrowUpRight : ArrowDownRight;

  const formatValue = (v: number) => {
    if (metric === 'tongDuNo') return fmtCompact(v);
    return fmtPercent(v * 100, 3);
  };
  const formatDelta = (delta: number) => {
    if (metric === 'tongDuNo') return `${delta > 0 ? '+' : ''}${fmtCompact(delta)}`;
    return `${delta > 0 ? '+' : ''}${(delta * 100).toFixed(3)}%`;
  };

  return (
    <Card className={cn(borderColor, accentBg)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Icon className={cn('h-4 w-4', accent)} />
              {title}
            </CardTitle>
            <div className="text-[11px] text-slate-500">{subtitle}</div>
          </div>
          <InfoPopover metricKey="periodMoversRanking" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-slate-400">Không có dữ liệu</div>
        ) : (
          <table className="w-full text-xs">
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.key}
                  onClick={() => onPick(r.key)}
                  className="cursor-pointer border-t border-white/70 hover:bg-white/60"
                >
                  <td className="w-7 px-3 py-2 text-[10px] font-semibold text-slate-400">
                    {i + 1}
                  </td>
                  <td className="px-2 py-2">
                    <div className="truncate font-medium text-slate-800">{r.key}</div>
                    {metric !== 'rollRate' && (
                      <div className="text-[10px] text-slate-500">
                        {formatValue(r.prevValue)} → {formatValue(r.currValue)}
                      </div>
                    )}
                    {metric === 'rollRate' && (
                      <div className="text-[10px] text-slate-500">
                        Cơ sở dư nợ trong hạn kỳ trước: {fmtCompact(r.prevTongDuNo)}
                      </div>
                    )}
                  </td>
                  <td className={cn('whitespace-nowrap px-3 py-2 text-right font-bold', accent)}>
                    {metric === 'rollRate' ? formatValue(r.currValue) : formatDelta(r.delta)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
