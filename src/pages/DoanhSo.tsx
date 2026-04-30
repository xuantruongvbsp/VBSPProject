// Trang "Báo cáo doanh số": cho vay & thu nợ dự kiến (phân bổ tuyến tính
// theo trục BH = ngayVay → ĐH = ngayDHGDXA) gom theo Tháng / Quý / Năm.
//
// Lưu ý: thu nợ ở đây là LỊCH dự kiến (theo hợp đồng), không phải thực thu.
// Báo cáo 31 không có dữ liệu giao dịch chi tiết theo ngày, nên mọi đường cong
// thu nợ trên trang này đều là phân bổ đều theo BH→ĐH.

import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Banknote,
  HandCoins,
  Wallet,
  FileText,
  Hourglass,
  Tags,
} from 'lucide-react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Cell,
} from 'recharts';

import { applyFilters, useDataStore } from '@/store/useDataStore';
import {
  salesByPeriod,
  latestPeriodKpi,
  salesBreakdown,
  periodKey,
  type Granularity,
} from '@/lib/sales-metrics';
import { fmtNumber, fmtTy, fmtTyAxis } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';
import { InfoPopover } from '@/components/ui/InfoPopover';
import { FilterBar } from '@/components/filters/FilterBar';
import { useChartColors } from '@/lib/useChartColors';
import { cn } from '@/lib/utils';

/* ── Cửa sổ hiển thị mặc định theo granularity ───────────────────────── */
const WINDOW: Record<Granularity, number> = {
  month: 24,
  quarter: 8,
  year: 5,
};

const GRAN_LABEL: Record<Granularity, string> = {
  month: 'Tháng',
  quarter: 'Quý',
  year: 'Năm',
};

const GRAN_OPTIONS: Granularity[] = ['month', 'quarter', 'year'];

/* ── Trang chính ─────────────────────────────────────────────────────── */
export function DoanhSoPage() {
  const { rows, filters, ranges, search, ngaySoLieu } = useDataStore();
  const navigate = useNavigate();
  const cc = useChartColors();
  const [granularity, setGranularity] = useState<Granularity>('month');
  const [breakdownDim, setBreakdownDim] = useState<'tenChuongTrinh' | 'tenPGD' | 'tenXa'>(
    'tenChuongTrinh'
  );

  const filtered = useMemo(
    () => applyFilters(rows, filters, ranges, search),
    [rows, filters, ranges, search]
  );

  const rawStats = useMemo(() => salesByPeriod(filtered, granularity), [filtered, granularity]);

  // Cắt chuỗi tại kỳ chứa ngày số liệu — không hiển thị thu nợ dự kiến của
  // tương lai (vốn lan đến ngày đáo hạn xa nhất, có thể tới 2050+) trong các
  // KPI/biểu đồ "doanh số đã đạt". Người dùng cần lịch trả nợ tương lai có
  // thể bật riêng sau (out of scope).
  const cutoffKey = useMemo(() => {
    const ref = ngaySoLieu ?? new Date();
    return periodKey(ref, granularity);
  }, [ngaySoLieu, granularity]);

  const series = useMemo(
    () => rawStats.series.filter((p) => p.key.localeCompare(cutoffKey) <= 0),
    [rawStats.series, cutoffKey]
  );

  const latest = useMemo(() => latestPeriodKpi(series), [series]);

  // Cửa sổ trục thời gian: lấy N kỳ gần nhất để biểu đồ không bị quá đông.
  const windowSeries = useMemo(() => {
    const n = WINDOW[granularity];
    return series.slice(Math.max(0, series.length - n));
  }, [series, granularity]);

  // Breakdown theo chương trình / PGD / xã của kỳ mới nhất.
  const latestKey = latest.curr?.key ?? null;
  const breakdown = useMemo(
    () => salesBreakdown(filtered, granularity, latestKey, breakdownDim).slice(0, 12),
    [filtered, granularity, latestKey, breakdownDim]
  );

  // Drill-down từ thanh chương trình / xã / PGD: áp filter rồi sang Explorer.
  const drillByDim = useCallback(
    (label: string) => {
      if (!label || label === '(Không rõ)') return;
      useDataStore.getState().drillDown(breakdownDim, label);
      navigate('/snapshot/du-lieu');
    },
    [breakdownDim, navigate]
  );

  // Drill-down theo kỳ trên trục thời gian: áp range ngayVay tương ứng.
  const drillByPeriod = useCallback(
    (key: string) => {
      const [y, rest] = key.split('-');
      const year = Number(y);
      if (!year) return;
      let start: string;
      let end: string;
      if (granularity === 'year') {
        start = `${y}-01-01`;
        end = `${y}-12-31`;
      } else if (granularity === 'quarter') {
        const q = Number(rest?.slice(1)) || 1; // "Q3" → 3
        const startMonth = (q - 1) * 3 + 1;
        const endMonth = startMonth + 2;
        const lastDay = new Date(year, endMonth, 0).getDate();
        start = `${y}-${String(startMonth).padStart(2, '0')}-01`;
        end = `${y}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      } else {
        const m = Number(rest);
        const lastDay = new Date(year, m, 0).getDate();
        start = `${y}-${String(m).padStart(2, '0')}-01`;
        end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      }
      useDataStore.getState().drillDownRange('ngayVay', [start, end]);
      navigate('/snapshot/du-lieu');
    },
    [granularity, navigate]
  );

  const trendData = windowSeries;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Báo cáo doanh số
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Cho vay (theo BH) &amp; thu nợ dự kiến (phân bổ BH → ĐH GDXA) — đơn vị: tỷ đồng.
          </p>
        </div>

        <SegmentedGranularity value={granularity} onChange={setGranularity} />
      </div>

      <FilterBar />

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label={`Cho vay — ${GRAN_LABEL[granularity]} ${latest.curr?.label ?? '—'}`}
          value={latest.kpi.choVay}
          formatter={(v) => fmtTy(v)}
          tone="primary"
          icon={<Banknote className="h-4 w-4" />}
          delta={latest.kpi.deltaChoVay ?? undefined}
          trend={trendOf(latest.kpi.deltaChoVay)}
          caption={
            latest.prev
              ? `Kỳ trước: ${fmtTy(latest.prev.choVay)}`
              : 'Chưa có kỳ trước để so sánh'
          }
          infoKey="doanhSoChoVay"
        />
        <KpiCard
          label={`Thu nợ dự kiến — ${GRAN_LABEL[granularity]} ${latest.curr?.label ?? '—'}`}
          value={latest.kpi.thuNoDuKien}
          formatter={(v) => fmtTy(v)}
          tone="warning"
          icon={<HandCoins className="h-4 w-4" />}
          delta={latest.kpi.deltaThuNo ?? undefined}
          trend={trendOf(latest.kpi.deltaThuNo)}
          caption={
            latest.prev
              ? `Kỳ trước: ${fmtTy(latest.prev.thuNoDuKien)}`
              : 'Lịch trả theo BH→ĐH'
          }
          infoKey="doanhSoThuNoDuKien"
        />
        <KpiCard
          label={`Net flow — ${GRAN_LABEL[granularity]} ${latest.curr?.label ?? '—'}`}
          value={latest.kpi.netFlow}
          formatter={(v) => fmtTy(v)}
          tone={latest.kpi.netFlow >= 0 ? 'success' : 'danger'}
          icon={<Wallet className="h-4 w-4" />}
          caption="Cho vay − Thu nợ dự kiến"
          infoKey="doanhSoNetFlow"
        />
        <KpiCard
          label="Số món vay mới"
          value={latest.kpi.soMonMoi}
          tone="default"
          icon={<FileText className="h-4 w-4" />}
          delta={latest.kpi.deltaSoMonMoi ?? undefined}
          trend={trendOf(latest.kpi.deltaSoMonMoi)}
          caption={`Kỳ ${latest.curr?.label ?? '—'}`}
          infoKey="doanhSoSoMonMoi"
        />
        <KpiCard
          label="Số món đáo hạn"
          value={latest.kpi.soMonDaoHan}
          tone="default"
          icon={<Hourglass className="h-4 w-4" />}
          caption={`Theo Ngày ĐH GDXA · kỳ ${latest.curr?.label ?? '—'}`}
          infoKey="doanhSoSoMonDaoHan"
        />
        <KpiCard
          label="Ticket trung bình"
          value={latest.kpi.ticketTB}
          formatter={(v) => fmtTy(v)}
          tone="default"
          icon={<Tags className="h-4 w-4" />}
          caption="Cho vay ÷ Số món mới"
          infoKey="doanhSoTicketTB"
        />
      </div>

      {/* Trend combo chart */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Xu hướng doanh số theo {GRAN_LABEL[granularity].toLowerCase()}</CardTitle>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Cột: cho vay (xanh) &amp; thu nợ dự kiến (đỏ). Đường: net flow.
              Hiển thị {trendData.length} kỳ gần nhất.
            </p>
          </div>
          <InfoPopover
            explanation={{
              title: 'Phương pháp tính',
              definition:
                'Cho vay được gán vào kỳ chứa "Ngày vay" (BH). Thu nợ dự kiến được phân bổ tuyến tính theo lịch hợp đồng giữa BH và "Ngày ĐH theo GDXA".',
              formula:
                'Cho vay kỳ = Σ tongGiaiNgan của khế ước có ngayVay ∈ kỳ. ' +
                'Thu nợ dự kiến kỳ = Σ (tongGiaiNgan ÷ số tháng [BH, ĐH]) đối với các tháng thuộc kỳ. ' +
                'Net flow = Cho vay − Thu nợ dự kiến.',
              note: `${rawStats.scheduled.toLocaleString('vi-VN')} khế ước có đủ BH/ĐH để phân bổ thu nợ. ${rawStats.excluded.toLocaleString('vi-VN')} khế ước có BH nhưng thiếu/không hợp lệ ĐH GDXA — chỉ tính cho phần cho vay, không tính thu nợ. Chỉ hiển thị các kỳ ≤ ngày số liệu (${cutoffKey}); lịch thu nợ tương lai bị ẩn.`,
            }}
          />
        </CardHeader>
        <CardContent>
          {trendData.length === 0 ? (
            <EmptyChart message="Không có dữ liệu doanh số trong phạm vi lọc." />
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart
                data={trendData}
                margin={{ top: 12, right: 16, left: 0, bottom: 8 }}
                onClick={(e: any) => {
                  const k = e?.activePayload?.[0]?.payload?.key;
                  if (k) drillByPeriod(k);
                }}
                style={{ cursor: 'pointer' }}
              >
                <CartesianGrid stroke={cc.grid} strokeDasharray="3 3" />
                <XAxis dataKey="label" fontSize={11} stroke={cc.axis} />
                <YAxis
                  yAxisId="left"
                  tickFormatter={fmtTyAxis}
                  fontSize={11}
                  stroke={cc.axis}
                  label={{
                    value: 'tỷ',
                    position: 'insideTopLeft',
                    fill: cc.axis,
                    fontSize: 10,
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={fmtTyAxis}
                  fontSize={11}
                  stroke={cc.axis}
                  hide
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    background: cc.tooltipBg,
                    borderColor: cc.tooltipBorder,
                    color: cc.text,
                  }}
                  formatter={(v: number, name: string) => {
                    const labels: Record<string, string> = {
                      choVay: 'Cho vay',
                      thuNoDuKien: 'Thu nợ dự kiến',
                      netFlow: 'Net flow',
                    };
                    return [fmtTy(v), labels[name] ?? name];
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: cc.text }}
                  formatter={(value) => {
                    const labels: Record<string, string> = {
                      choVay: 'Cho vay',
                      thuNoDuKien: 'Thu nợ dự kiến',
                      netFlow: 'Net flow',
                    };
                    return labels[value] ?? value;
                  }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="choVay"
                  fill={cc.semantic.duNoTrongHan}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  yAxisId="left"
                  dataKey="thuNoDuKien"
                  fill={cc.semantic.duNoQuaHan}
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="netFlow"
                  stroke={cc.semantic.areaBase}
                  strokeWidth={2}
                  dot={{ r: 3, fill: cc.semantic.areaBase }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Breakdown */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>
                Doanh số kỳ {latest.curr?.label ?? '—'} theo {dimLabel(breakdownDim)}
              </CardTitle>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Top 12 — sắp theo doanh số cho vay. Click để xem chi tiết khế ước.
              </p>
            </div>
            <SegmentedDim value={breakdownDim} onChange={setBreakdownDim} />
          </CardHeader>
          <CardContent>
            {breakdown.length === 0 ? (
              <EmptyChart message="Không có dữ liệu trong kỳ." />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(280, breakdown.length * 26 + 40)}>
                <BarChart
                  data={breakdown}
                  layout="vertical"
                  margin={{ top: 8, right: 24, left: 0, bottom: 8 }}
                >
                  <CartesianGrid stroke={cc.grid} strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={fmtTyAxis} fontSize={11} stroke={cc.axis} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={140}
                    fontSize={11}
                    stroke={cc.axis}
                    tick={{ fill: cc.text }}
                  />
                  <Tooltip
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      background: cc.tooltipBg,
                      borderColor: cc.tooltipBorder,
                      color: cc.text,
                    }}
                    formatter={(v: number) => [fmtTy(v), 'Cho vay']}
                  />
                  <Bar
                    dataKey="choVay"
                    radius={[0, 4, 4, 0]}
                    onClick={(d: any) => drillByDim(d?.label ?? d?.payload?.label)}
                    cursor="pointer"
                  >
                    {breakdown.map((_, i) => (
                      <Cell key={i} fill={cc.palette[i % cc.palette.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bảng chi tiết — kỳ {latest.curr?.label ?? '—'}</CardTitle>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Cho vay, thu nợ dự kiến và net flow theo {dimLabel(breakdownDim).toLowerCase()}.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <BreakdownTable rows={breakdown} onRowClick={drillByDim} />
          </CardContent>
        </Card>
      </div>

      {/* Footer note */}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        ⓘ Thu nợ trên trang này là <b>lịch dự kiến</b> — phân bổ tuyến tính theo BH→ĐH GDXA, không
        phải số tiền thực thu trong kỳ. Sai khác giữa lịch và thực thu cần đối chiếu với báo cáo
        giao dịch (Sao kê / Báo cáo 38).
      </p>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────── */

function SegmentedGranularity({
  value,
  onChange,
}: {
  value: Granularity;
  onChange: (g: Granularity) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      {GRAN_OPTIONS.map((g) => (
        <button
          key={g}
          type="button"
          onClick={() => onChange(g)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            value === g
              ? 'bg-brand-600 text-white shadow-sm dark:bg-brand-500 dark:text-slate-950'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          )}
        >
          {GRAN_LABEL[g]}
        </button>
      ))}
    </div>
  );
}

function SegmentedDim({
  value,
  onChange,
}: {
  value: 'tenChuongTrinh' | 'tenPGD' | 'tenXa';
  onChange: (d: 'tenChuongTrinh' | 'tenPGD' | 'tenXa') => void;
}) {
  const opts: Array<{ id: 'tenChuongTrinh' | 'tenPGD' | 'tenXa'; label: string }> = [
    { id: 'tenChuongTrinh', label: 'Chương trình' },
    { id: 'tenPGD', label: 'PGD' },
    { id: 'tenXa', label: 'Xã' },
  ];
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-900">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            'rounded-md px-2.5 py-1 font-medium transition-colors',
            value === o.id
              ? 'bg-brand-600 text-white dark:bg-brand-500 dark:text-slate-950'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function BreakdownTable({
  rows,
  onRowClick,
}: {
  rows: ReturnType<typeof salesBreakdown>;
  onRowClick: (label: string) => void;
}) {
  if (rows.length === 0) {
    return <EmptyChart message="Không có dữ liệu trong kỳ." />;
  }
  return (
    <div className="max-h-[420px] overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          <tr>
            <th className="px-4 py-2 font-semibold">Phân loại</th>
            <th className="px-4 py-2 text-right font-semibold">Cho vay</th>
            <th className="px-4 py-2 text-right font-semibold">Thu nợ DK</th>
            <th className="px-4 py-2 text-right font-semibold">Net</th>
            <th className="px-4 py-2 text-right font-semibold">Số món</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.key}
              onClick={() => onRowClick(r.label)}
              className="cursor-pointer border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
            >
              <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-100">
                {r.label}
              </td>
              <td className="px-4 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200">
                {fmtTy(r.choVay)}
              </td>
              <td className="px-4 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200">
                {fmtTy(r.thuNoDuKien)}
              </td>
              <td
                className={cn(
                  'px-4 py-2 text-right tabular-nums font-semibold',
                  r.netFlow >= 0
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-rose-700 dark:text-rose-300'
                )}
              >
                {fmtTy(r.netFlow)}
              </td>
              <td className="px-4 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200">
                {fmtNumber(r.soMonMoi)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-slate-400 dark:text-slate-500">
      {message}
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

function trendOf(delta: number | null): 'up' | 'down' | 'flat' {
  if (delta === null) return 'flat';
  if (delta > 0.5) return 'up';
  if (delta < -0.5) return 'down';
  return 'flat';
}

function dimLabel(d: 'tenChuongTrinh' | 'tenPGD' | 'tenXa'): string {
  return d === 'tenChuongTrinh' ? 'Chương trình' : d === 'tenPGD' ? 'PGD' : 'Xã';
}

