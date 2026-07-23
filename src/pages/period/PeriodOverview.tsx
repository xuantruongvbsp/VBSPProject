import { useMemo, useState } from 'react';
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { FilterBar } from '@/components/filters/FilterBar';
import { InfoPopover } from '@/components/ui/InfoPopover';
import { ExportMenu } from '@/components/export/ExportMenu';
import { DeltaCard, DualDeltaCard, FlowCard } from '@/components/period/DeltaCard';
import { PeriodGrowthStacked, type GrowthDimension } from '@/components/charts/PeriodGrowthStacked';
import { usePeriodFilterStore } from '@/store/usePeriodFilterStore';
import { usePeriodStore, PERIOD_SLOT_LABEL, type PeriodSlotKey } from '@/store/usePeriodStore';
import { usePeriodCompare } from './usePeriodCompare';
import { computeKpi, groupBy } from '@/lib/metrics';
import { MultiSeriesBar, type BarSeries, type MultiSeriesRow } from '@/components/charts/MultiSeriesBar';
import type { LoanRecord } from '@/lib/types';
import { fmtCompact, fmtCurrency, fmtDate, fmtNguonVon, fmtNumber, fmtPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

// ─── Dữ liệu "diễn biến qua các kỳ" cho biểu đồ cột nhóm xuất PDF ────────────
// Mỗi category (Hội/CT/chỉ tiêu) một hàng; mỗi kỳ (lastYear → lastMonth → now)
// một thanh trong nhóm. Dùng RAW rows (không áp bộ lọc period — báo cáo nhìn
// toàn danh mục).

interface PeriodCol {
  key: string;
  name: string;
  rows: LoanRecord[];
}

/** Grouped bar: mỗi category (Hội/CT) một hàng, mỗi kỳ một thanh (dư nợ).
 *  Chỉ giữ `limit` category có dư nợ lớn nhất ở kỳ mới nhất. */
function acrossByField(
  periods: PeriodCol[],
  field: 'tenDVUT' | 'tenChuongTrinh',
  limit = 8
): MultiSeriesRow[] {
  const maps = periods.map(
    (p) => new Map(groupBy(p.rows, field).map((g) => [g.label, g.tongDuNo]))
  );
  const lastMap = maps[maps.length - 1] ?? new Map<string, number>();
  const allLabels = new Set<string>();
  maps.forEach((m) => m.forEach((_, k) => allLabels.add(k)));
  const ranked = Array.from(allLabels)
    .sort((a, b) => (lastMap.get(b) ?? 0) - (lastMap.get(a) ?? 0))
    .slice(0, limit);
  return ranked.map((label) => {
    const row: MultiSeriesRow = { label };
    periods.forEach((p, i) => {
      row[p.key] = maps[i].get(label) ?? 0;
    });
    return row;
  });
}

/** Grouped bar: mỗi chỉ tiêu chất lượng một hàng, mỗi kỳ một thanh. */
function qualityAcross(periods: PeriodCol[]): MultiSeriesRow[] {
  const kpis = periods.map((p) => computeKpi(p.rows));
  const metrics: Array<[string, 'duNoQuaHan' | 'duNoKhoanh' | 'laiTonTH']> = [
    ['Nợ quá hạn', 'duNoQuaHan'],
    ['Nợ khoanh', 'duNoKhoanh'],
    ['Lãi tồn trong hạn', 'laiTonTH'],
  ];
  return metrics.map(([label, mk]) => {
    const row: MultiSeriesRow = { label };
    periods.forEach((p, i) => {
      row[p.key] = kpis[i][mk];
    });
    return row;
  });
}

/**
 * Trang đầu của ứng dụng so sánh — "Diễn biến". Tập trung vào các chỉ
 * tiêu cốt lõi mà người quản lý PGD quan tâm khi nhìn diễn biến giữa
 * hai kỳ:
 *  - 8 KPI deltas
 *  - Tăng trưởng tổng dư nợ (stacked column theo dimension)
 *  - Vòng đời khế ước (KƯ T-1 → tất toán / duy trì / mới → KƯ T)
 *  - Vòng đời khách hàng (KH T-1 → rời / còn / mới → KH T)
 *  - Quality stacked bar (Trong hạn / Quá hạn / Khoanh)
 */
export function PeriodOverviewPage() {
  const {
    hasData,
    prevDate,
    currDate,
    kpiDelta,
    lifecycle,
    qualityPrev,
    qualityCurr,
    loanJoin,
    customerJoin,
    prevRows,
    currRows,
  } = usePeriodCompare();

  const [growthDim, setGrowthDim] = useState<GrowthDimension>('tenChuongTrinh');
  const [growthFocus, setGrowthFocus] = useState<string>('');

  // 3 slot thời gian (lastYear → lastMonth → now) cho biểu đồ "diễn biến qua
  // các kỳ" trong bản xuất PDF. Chỉ lấy các slot đã có dữ liệu.
  const slotLastYear = usePeriodStore((s) => s.lastYear);
  const slotLastMonth = usePeriodStore((s) => s.lastMonth);
  const slotNow = usePeriodStore((s) => s.now);
  const periodCols = useMemo<PeriodCol[]>(() => {
    const raw: Array<{ key: PeriodSlotKey; snap: typeof slotNow }> = [
      { key: 'lastYear', snap: slotLastYear },
      { key: 'lastMonth', snap: slotLastMonth },
      { key: 'now', snap: slotNow },
    ];
    return raw
      .filter((r) => r.snap && r.snap.rows.length > 0)
      .map((r) => ({
        key: r.key,
        name: r.snap!.ngaySoLieu ? fmtDate(r.snap!.ngaySoLieu) : PERIOD_SLOT_LABEL[r.key],
        rows: r.snap!.rows,
      }));
  }, [slotLastYear, slotLastMonth, slotNow]);
  const periodSeries = useMemo<BarSeries[]>(
    () => periodCols.map((p) => ({ key: p.key, name: p.name })),
    [periodCols]
  );
  const qualityAcrossData = useMemo(() => qualityAcross(periodCols), [periodCols]);
  const dvutAcrossData = useMemo(() => acrossByField(periodCols, 'tenDVUT'), [periodCols]);
  const programAcrossData = useMemo(
    () => acrossByField(periodCols, 'tenChuongTrinh', 6),
    [periodCols]
  );

  const focusOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of prevRows) set.add(String(r[growthDim] ?? '—') || '—');
    for (const r of currRows) set.add(String(r[growthDim] ?? '—') || '—');
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [prevRows, currRows, growthDim]);

  const focusedPrev = useMemo(
    () => (growthFocus ? prevRows.filter((r) => String(r[growthDim] ?? '—') === growthFocus) : prevRows),
    [prevRows, growthDim, growthFocus],
  );
  const focusedCurr = useMemo(
    () => (growthFocus ? currRows.filter((r) => String(r[growthDim] ?? '—') === growthFocus) : currRows),
    [currRows, growthDim, growthFocus],
  );

  // Doanh số cho vay = tổng giải ngân của các khế ước được giải ngân trong
  // khoảng thời gian Kỳ A → Kỳ B, dựa trên `ngayVay` (đồng bộ logic biểu đồ
  // "Giải ngân theo thời gian"). Cửa sổ (prevDate, currDate].
  const doanhSoChoVay = useMemo(() => {
    if (!prevDate || !currDate) return { total: 0, count: 0 };
    const lo = prevDate.getTime();
    const hi = currDate.getTime();
    let total = 0;
    let count = 0;
    for (const r of currRows) {
      if (!r.ngayVay) continue;
      const t = r.ngayVay.getTime();
      if (t > lo && t <= hi) {
        total += r.tongGiaiNgan;
        count += 1;
      }
    }
    return { total, count };
  }, [currRows, prevDate, currDate]);

  if (!hasData) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-slate-500">
        Chưa có dữ liệu so sánh.
      </div>
    );
  }

  const { prev, curr } = kpiDelta;

  // Tỷ lệ nợ khoanh = Dư nợ khoanh / Tổng dư nợ (đơn vị %, đồng bộ với tyLeNoQuaHan).
  const prevTyLeKhoanh = prev.tongDuNo > 0 ? (prev.duNoKhoanh / prev.tongDuNo) * 100 : 0;
  const currTyLeKhoanh = curr.tongDuNo > 0 ? (curr.duNoKhoanh / curr.tongDuNo) * 100 : 0;

  const collisionWarning = loanJoin.collisions > 0;

  return (
    <div className="space-y-5 p-6">
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Diễn biến danh mục</h1>
            <InfoPopover metricKey="pagePeriodOverview" />
          </div>
          <ExportMenu
            pageTitle="Diễn biến danh mục — So sánh hai kỳ"
            subtitle={`${fmtDate(prevDate)} → ${fmtDate(currDate)} · ${fmtNumber(currRows.length)} khế ước kỳ sau`}
            rows={currRows}
            kpi={kpiDelta.curr}
            chartSelectors={[
              '#chart-period-quality-export',
              '#chart-period-dvut-export',
              '#chart-period-program-export',
            ]}
            size="sm"
          />
        </div>
        <p className="text-sm text-slate-600">
          So sánh{' '}
          <span className="font-semibold text-slate-800">{fmtDate(prevDate)}</span>{' '}
          <ArrowRight className="inline h-3.5 w-3.5 text-period-600" />{' '}
          <span className="font-semibold text-period-700">{fmtDate(currDate)}</span> · áp dụng các bộ lọc bên dưới đồng thời cho cả hai kỳ
        </p>
      </header>

      <Card>
        <CardContent className="py-3">
          <FilterBar useStore={usePeriodFilterStore} accent="period" />
        </CardContent>
      </Card>

      {collisionWarning && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            Phát hiện <strong>{loanJoin.collisions}</strong> cặp khế ước trùng khóa (cùng số khế
            ước + mã KH) trong nguồn. Số liệu vẫn được tính nhưng nên kiểm tra lại tệp gốc để
            tránh bỏ sót bản ghi.
          </div>
        </div>
      )}

      {/* 8 KPI deltas */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            8 chỉ tiêu cốt lõi · Δ giữa hai kỳ
          </h2>
          <InfoPopover metricKey="periodKpiDeltas" />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <DeltaCard
          label="Tổng dư nợ"
          prevValue={prev.tongDuNo}
          currValue={curr.tongDuNo}
          formatter={fmtCompact}
          tone="good-up"
        />
        <DeltaCard
          label="Số khế ước"
          prevValue={prev.soKheUoc}
          currValue={curr.soKheUoc}
          formatter={(n) => fmtNumber(Math.round(n))}
          tone="neutral"
        />
        <DeltaCard
          label="Số khách hàng"
          prevValue={prev.soKhachHang}
          currValue={curr.soKhachHang}
          formatter={(n) => fmtNumber(Math.round(n))}
          tone="neutral"
        />
        <FlowCard
          label="Doanh số cho vay"
          value={doanhSoChoVay.total}
          formatter={fmtCompact}
          caption={`Giải ngân ${fmtDate(prevDate)} → ${fmtDate(currDate)} · ${fmtNumber(doanhSoChoVay.count)} khế ước`}
        />
        <DualDeltaCard
          left={{
            label: 'Dư nợ quá hạn',
            prevValue: prev.duNoQuaHan,
            currValue: curr.duNoQuaHan,
            formatter: fmtCompact,
            tone: 'bad-up',
          }}
          right={{
            label: 'Tỷ lệ NQH',
            prevValue: prev.tyLeNoQuaHan,
            currValue: curr.tyLeNoQuaHan,
            formatter: (n) => fmtPercent(n, 3),
            primary: 'abs',
            tone: 'bad-up',
          }}
        />
        <DualDeltaCard
          left={{
            label: 'Dư nợ khoanh',
            prevValue: prev.duNoKhoanh,
            currValue: curr.duNoKhoanh,
            formatter: fmtCompact,
            tone: 'bad-up',
          }}
          right={{
            label: 'Tỷ lệ nợ khoanh',
            prevValue: prevTyLeKhoanh,
            currValue: currTyLeKhoanh,
            formatter: (n) => fmtPercent(n, 3),
            primary: 'abs',
            tone: 'bad-up',
          }}
        />
        <DeltaCard
          label="Lãi tồn TH"
          prevValue={prev.laiTonTH}
          currValue={curr.laiTonTH}
          formatter={fmtCompact}
          tone="bad-up"
        />
        <DeltaCard
          label="Mức BQ/KH"
          prevValue={prev.mucVayBQ}
          currValue={curr.mucVayBQ}
          formatter={fmtCompact}
          tone="neutral"
        />
        </div>
      </section>

      {/* Tăng trưởng tổng dư nợ — stacked bar */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>
              Tăng trưởng tổng dư nợ theo{' '}
              {growthDim === 'tenChuongTrinh'
                ? 'Chương trình tín dụng'
                : growthDim === 'nguonVon'
                  ? 'Nguồn vốn'
                  : 'Xã'}
              {growthFocus && (
                <span className="ml-1 text-slate-500 dark:text-slate-400">
                  · <span className="font-semibold text-period-700 dark:text-period-300">
                    {growthDim === 'nguonVon' ? fmtNguonVon(growthFocus) : growthFocus}
                  </span>
                </span>
              )}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-800">
                {([
                  ['tenChuongTrinh', 'Chương trình tín dụng'],
                  ['nguonVon', 'Nguồn vốn'],
                  ['tenXa', 'Xã'],
                ] as const).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      setGrowthDim(val);
                      setGrowthFocus('');
                    }}
                    className={`rounded px-2.5 py-1 font-medium transition-colors ${
                      growthDim === val
                        ? 'bg-period-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <select
                value={growthFocus}
                onChange={(e) => setGrowthFocus(e.target.value)}
                className="h-7 max-w-[220px] rounded border border-slate-200 bg-white px-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                title="Tập trung vào một mục"
              >
                <option value="">Tất cả</option>
                {focusOptions.map((o) => (
                  <option key={o} value={o}>
                    {growthDim === 'nguonVon' ? fmtNguonVon(o) : o}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <PeriodGrowthStacked
            prevRows={focusedPrev}
            currRows={focusedCurr}
            prevDate={prevDate}
            currDate={currDate}
            dimension={growthDim}
          />
        </CardContent>
      </Card>

      {/* Lifecycle: loans + customers */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Vòng đời khế ước</CardTitle>
              <InfoPopover metricKey="periodLifecycleLoans" />
            </div>
          </CardHeader>
          <CardContent>
            <FlowDiagram
              prevLabel={`KƯ ${fmtDate(prevDate)}`}
              currLabel={`KƯ ${fmtDate(currDate)}`}
              prevTotal={lifecycle.prevTotalLoans}
              currTotal={lifecycle.currTotalLoans}
              segments={[
                {
                  key: 'closed',
                  label: 'Đã tất toán',
                  count: lifecycle.closedLoans,
                  color: 'slate',
                  side: 'left',
                },
                {
                  key: 'retained',
                  label: 'Duy trì',
                  count: lifecycle.retainedLoans,
                  color: 'period',
                  side: 'middle',
                },
                {
                  key: 'new',
                  label: 'Khế ước mới',
                  count: lifecycle.newLoans,
                  color: 'emerald',
                  side: 'right',
                },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Vòng đời khách hàng</CardTitle>
              <InfoPopover metricKey="periodLifecycleCustomers" />
            </div>
          </CardHeader>
          <CardContent>
            <FlowDiagram
              prevLabel={`KH ${fmtDate(prevDate)}`}
              currLabel={`KH ${fmtDate(currDate)}`}
              prevTotal={lifecycle.prevTotalCustomers}
              currTotal={lifecycle.currTotalCustomers}
              segments={[
                {
                  key: 'churned',
                  label: 'Đã rời danh mục',
                  count: lifecycle.churnedCustomers,
                  color: 'slate',
                  side: 'left',
                },
                {
                  key: 'retained',
                  label: 'Còn vay',
                  count: lifecycle.retainedCustomers,
                  color: 'period',
                  side: 'middle',
                  badge:
                    lifecycle.reactivatedCustomers > 0
                      ? `+${fmtNumber(lifecycle.reactivatedCustomers)} kích hoạt lại`
                      : undefined,
                },
                {
                  key: 'new',
                  label: 'Khách hàng mới',
                  count: lifecycle.newCustomers,
                  color: 'emerald',
                  side: 'right',
                },
              ]}
            />
            {customerJoin.reactivatedCount > 0 && (
              <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                <CheckCircle2 className="h-3 w-3" />
                {fmtNumber(customerJoin.reactivatedCount)} khách hàng đã ngừng giao dịch ≥ 6 tháng
                quay trở lại
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quality stacked bar prev vs curr */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Cơ cấu chất lượng dư nợ</CardTitle>
            <InfoPopover metricKey="periodQualityComposition" />
          </div>
        </CardHeader>
        <CardContent>
          <QualityStackedBars prev={qualityPrev} curr={qualityCurr} prevDate={prevDate} currDate={currDate} />
        </CardContent>
      </Card>

      {/* Biểu đồ ẩn CHỈ để xuất PDF — diễn biến qua 3 kỳ thời gian
          (lastYear → lastMonth → now), bám theo báo cáo BĐD-HĐQT. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: -99999,
          top: 0,
          width: 900,
          background: '#ffffff',
        }}
      >
        <h3>Diễn biến chất lượng tín dụng qua các kỳ</h3>
        <div id="chart-period-quality-export">
          <MultiSeriesBar data={qualityAcrossData} series={periodSeries} />
        </div>

        <h3>Dư nợ theo Hội đoàn thể qua các kỳ</h3>
        <div id="chart-period-dvut-export">
          <MultiSeriesBar data={dvutAcrossData} series={periodSeries} />
        </div>

        <h3>Cơ cấu dư nợ theo chương trình tín dụng qua các kỳ</h3>
        <div id="chart-period-program-export">
          <MultiSeriesBar data={programAcrossData} series={periodSeries} />
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components (chỉ dùng trong trang này) ───────────────────────────────

interface FlowSegment {
  key: string;
  label: string;
  count: number;
  color: 'slate' | 'period' | 'emerald';
  side: 'left' | 'middle' | 'right';
  badge?: string;
}

function FlowDiagram({
  prevLabel,
  currLabel,
  prevTotal,
  currTotal,
  segments,
}: {
  prevLabel: string;
  currLabel: string;
  prevTotal: number;
  currTotal: number;
  segments: FlowSegment[];
}) {
  const closed = segments.find((s) => s.side === 'left');
  const retained = segments.find((s) => s.side === 'middle');
  const newSeg = segments.find((s) => s.side === 'right');

  const colorMap = {
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
    period: 'bg-period-100 text-period-800 ring-period-200',
    emerald: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 items-center gap-3">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">{prevLabel}</div>
          <div className="text-2xl font-bold text-slate-900">{fmtNumber(prevTotal)}</div>
        </div>
        <div className="text-center text-[10px] text-slate-400">→</div>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-wide text-period-700">{currLabel}</div>
          <div className="text-2xl font-bold text-period-800">{fmtNumber(currTotal)}</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[closed, retained, newSeg].map((s) => {
          if (!s) return null;
          return (
            <div
              key={s.key}
              className={cn(
                'rounded-lg p-3 text-center ring-1',
                colorMap[s.color]
              )}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide opacity-75">
                {s.label}
              </div>
              <div className="text-xl font-bold">{fmtNumber(s.count)}</div>
              {s.badge && <div className="mt-1 text-[10px] font-semibold">{s.badge}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QualityStackedBars({
  prev,
  curr,
  prevDate,
  currDate,
}: {
  prev: { trongHan: number; quaHan: number; khoanh: number; total: number };
  curr: { trongHan: number; quaHan: number; khoanh: number; total: number };
  prevDate: Date | null;
  currDate: Date | null;
}) {
  const max = Math.max(prev.total, curr.total, 1);

  const Row = ({
    label,
    snap,
  }: {
    label: string;
    snap: { trongHan: number; quaHan: number; khoanh: number; total: number };
  }) => {
    const widthPct = (snap.total / max) * 100;
    const thPct = snap.total > 0 ? (snap.trongHan / snap.total) * 100 : 0;
    const qhPct = snap.total > 0 ? (snap.quaHan / snap.total) * 100 : 0;
    const khPct = snap.total > 0 ? (snap.khoanh / snap.total) * 100 : 0;
    return (
      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-xs font-semibold text-slate-700">{label}</span>
          <span className="text-[11px] text-slate-500">{fmtCurrency(snap.total)}</span>
        </div>
        <div className="relative h-7 w-full overflow-hidden rounded-md bg-slate-100">
          <div
            className="absolute inset-y-0 left-0 flex"
            style={{ width: `${widthPct}%` }}
          >
            <div
              style={{ width: `${thPct}%` }}
              className="bg-emerald-400"
              title={`Trong hạn ${fmtCurrency(snap.trongHan)}`}
            />
            <div
              style={{ width: `${qhPct}%` }}
              className="bg-rose-500"
              title={`Quá hạn ${fmtCurrency(snap.quaHan)}`}
            />
            <div
              style={{ width: `${khPct}%` }}
              className="bg-amber-400"
              title={`Khoanh ${fmtCurrency(snap.khoanh)}`}
            />
          </div>
        </div>
        <div className="mt-1 grid grid-cols-3 text-[10px] text-slate-500">
          <span>
            Trong hạn: <strong className="text-emerald-700">{fmtPercent(thPct)}</strong>
          </span>
          <span className="text-center">
            Quá hạn: <strong className="text-rose-600">{fmtPercent(qhPct)}</strong>
          </span>
          <span className="text-right">
            Khoanh: <strong className="text-amber-700">{fmtPercent(khPct)}</strong>
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Row label={`Kỳ trước · ${fmtDate(prevDate)}`} snap={prev} />
      <Row label={`Kỳ sau · ${fmtDate(currDate)}`} snap={curr} />
    </div>
  );
}
