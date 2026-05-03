import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { FilterBar } from '@/components/filters/FilterBar';
import { InfoPopover } from '@/components/ui/InfoPopover';
import { ExportMenu } from '@/components/export/ExportMenu';
import { usePeriodFilterStore } from '@/store/usePeriodFilterStore';
import { useStaffStore } from '@/store/useStaffStore';
import { useTxnPointStore } from '@/store/useTxnPointStore';
import { usePeriodCompare } from './usePeriodCompare';
import { DeltaCard } from '@/components/period/DeltaCard';
import { vintageNQH, hhi, loansMaturingNext90 } from '@/lib/period-compare';
import { fmtCompact, fmtCurrency, fmtDate, fmtNumber, fmtPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { LoanRecord } from '@/lib/types';

type HHIDimensionId = 'tenPGD' | 'tenChuongTrinh' | 'tenDVUT' | 'tenXa' | 'maNV' | 'maDGD';
interface HHIDimension {
  id: HHIDimensionId;
  label: string;
  extractor: (r: LoanRecord) => string;
}
const BASE_HHI_DIMENSIONS: HHIDimension[] = [
  { id: 'tenPGD', label: 'PGD', extractor: (r) => String(r.tenPGD ?? '—') || '—' },
  {
    id: 'tenChuongTrinh',
    label: 'Chương trình',
    extractor: (r) => String(r.tenChuongTrinh ?? '—') || '—',
  },
  { id: 'tenDVUT', label: 'ĐVUT', extractor: (r) => String(r.tenDVUT ?? '—') || '—' },
  { id: 'tenXa', label: 'Xã', extractor: (r) => String(r.tenXa ?? '—') || '—' },
];

export function PeriodAssetQualityPage() {
  const {
    hasData,
    prevDate,
    currDate,
    parPrev,
    parCurr,
    prevRows,
    currRows,
    qualityPrev,
    qualityCurr,
    kpiDelta,
  } = usePeriodCompare();
  const staff = useStaffStore((s) => s.staff);
  const points = useTxnPointStore((s) => s.points);

  // Dimensions động — Cán bộ/ĐGD chỉ thêm khi danh mục đã có dữ liệu.
  const hhiDimensions = useMemo<HHIDimension[]>(() => {
    const out = [...BASE_HHI_DIMENSIONS];
    if (points.length > 0) {
      const thonToPoint = new Map<string, string[]>();
      for (const p of points) {
        for (const t of p.maThons) {
          const list = thonToPoint.get(t);
          if (list) list.push(p.id);
          else thonToPoint.set(t, [p.id]);
        }
      }
      const pointById = new Map(points.map((p) => [p.id, p]));
      out.push({
        id: 'maDGD',
        label: 'ĐGD',
        extractor: (r) => {
          const list = thonToPoint.get(r.maThon);
          if (!list || list.length === 0) return '(Chưa gán ĐGD)';
          if (list.length > 1) return '(Nhiều ĐGD)';
          const p = pointById.get(list[0]);
          return p ? `${p.maDGD} — ${p.tenDGD}` : '(Chưa gán ĐGD)';
        },
      });
    }
    if (staff.length > 0 && points.length > 0) {
      const dgdToStaff = new Map<string, string[]>();
      for (const s of staff) {
        for (const maDGD of s.maDGDs) {
          const list = dgdToStaff.get(maDGD);
          if (list) list.push(s.id);
          else dgdToStaff.set(maDGD, [s.id]);
        }
      }
      const thonToStaff = new Map<string, string[]>();
      for (const p of points) {
        const owners = dgdToStaff.get(p.maDGD) ?? [];
        if (owners.length === 0) continue;
        for (const t of p.maThons) {
          const list = thonToStaff.get(t);
          if (list) {
            for (const o of owners) if (!list.includes(o)) list.push(o);
          } else {
            thonToStaff.set(t, [...owners]);
          }
        }
      }
      const staffById = new Map(staff.map((s) => [s.id, s]));
      out.push({
        id: 'maNV',
        label: 'Cán bộ',
        extractor: (r) => {
          const list = thonToStaff.get(r.maThon);
          if (!list || list.length === 0) return '(Chưa gán cán bộ)';
          if (list.length > 1) return '(Nhiều cán bộ)';
          const s = staffById.get(list[0]);
          return s ? `${s.maNV} — ${s.tenNV}` : '(Chưa gán cán bộ)';
        },
      });
    }
    return out;
  }, [staff, points]);

  const [hhiDimId, setHhiDimId] = useState<HHIDimensionId>('tenPGD');
  const hhiDim = useMemo(
    () => hhiDimensions.find((d) => d.id === hhiDimId) ?? hhiDimensions[0],
    [hhiDimensions, hhiDimId]
  );

  const vintagePrev = useMemo(() => vintageNQH(prevRows), [prevRows]);
  const vintageCurr = useMemo(() => vintageNQH(currRows), [currRows]);
  const hhiPrev = useMemo(() => hhi(prevRows, hhiDim.extractor), [prevRows, hhiDim]);
  const hhiCurr = useMemo(() => hhi(currRows, hhiDim.extractor), [currRows, hhiDim]);
  const maturityCurr = useMemo(() => loansMaturingNext90(currRows, currDate), [currRows, currDate]);

  // Top-10 KH theo dư nợ — kỳ sau
  const top10Curr = useMemo(() => {
    const map = new Map<string, { maKH: string; tenKH: string; tongDuNo: number }>();
    for (const r of currRows) {
      if (!r.maKH) continue;
      const e = map.get(r.maKH);
      if (e) e.tongDuNo += r.tongDuNo;
      else map.set(r.maKH, { maKH: r.maKH, tenKH: r.tenKH, tongDuNo: r.tongDuNo });
    }
    const totalCurr = currRows.reduce((s, r) => s + r.tongDuNo, 0);
    const top = Array.from(map.values()).sort((a, b) => b.tongDuNo - a.tongDuNo).slice(0, 10);
    const top10Sum = top.reduce((s, x) => s + x.tongDuNo, 0);
    return { rows: top, top10Sum, totalCurr, sharePct: totalCurr > 0 ? (top10Sum / totalCurr) * 100 : 0 };
  }, [currRows]);

  if (!hasData) return <div className="p-6 text-sm text-slate-500">Chưa có dữ liệu so sánh.</div>;

  return (
    <div className="space-y-5 p-6">
      <header>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Chất lượng tài sản</h1>
            <InfoPopover metricKey="pagePeriodAssetQuality" />
          </div>
          <ExportMenu
            pageTitle="Chất lượng tài sản — So sánh hai kỳ"
            subtitle={`${fmtDate(prevDate)} → ${fmtDate(currDate)} · ${fmtNumber(currRows.length)} khế ước kỳ sau`}
            rows={currRows}
            kpi={kpiDelta.curr}
            size="sm"
          />
        </div>
        <p className="text-sm text-slate-600">
          Các chỉ tiêu rủi ro tín dụng giữa hai kỳ — PAR, vintage, tập trung HHI và lịch đáo hạn 90
          ngày tới.
        </p>
      </header>

      <Card>
        <CardContent className="py-3">
          <FilterBar useStore={usePeriodFilterStore} accent="period" />
        </CardContent>
      </Card>

      {/* PAR + Nợ khoanh deltas */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            PAR & Dư nợ khoanh — Δ giữa hai kỳ
          </h2>
          <InfoPopover metricKey="periodPar" />
        </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DeltaCard
          label="PAR30"
          prevValue={parPrev.par30}
          currValue={parCurr.par30}
          formatter={fmtCompact}
          tone="bad-up"
          caption={`${fmtPercent(parPrev.par30Pct * 100)} → ${fmtPercent(parCurr.par30Pct * 100)} dư nợ`}
        />
        <DeltaCard
          label="PAR90"
          prevValue={parPrev.par90}
          currValue={parCurr.par90}
          formatter={fmtCompact}
          tone="bad-up"
          caption={`${fmtPercent(parPrev.par90Pct * 100)} → ${fmtPercent(parCurr.par90Pct * 100)} dư nợ`}
        />
        <DeltaCard
          label="PAR180"
          prevValue={parPrev.par180}
          currValue={parCurr.par180}
          formatter={fmtCompact}
          tone="bad-up"
          caption={`${fmtPercent(parPrev.par180Pct * 100)} → ${fmtPercent(parCurr.par180Pct * 100)} dư nợ`}
        />
        <DeltaCard
          label="Dư nợ khoanh"
          prevValue={qualityPrev.khoanh}
          currValue={qualityCurr.khoanh}
          formatter={fmtCompact}
          tone="bad-up"
          caption={`${fmtPercent(
            qualityPrev.total > 0 ? (qualityPrev.khoanh / qualityPrev.total) * 100 : 0
          )} → ${fmtPercent(
            qualityCurr.total > 0 ? (qualityCurr.khoanh / qualityCurr.total) * 100 : 0
          )} dư nợ`}
        />
      </div>
      </section>

      {/* Vintage NQH curves */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Tỷ lệ NQH theo năm vay (vintage)</CardTitle>
            <InfoPopover metricKey="periodVintage" />
          </div>
        </CardHeader>
        <CardContent>
          <VintageTable prev={vintagePrev} curr={vintageCurr} />
        </CardContent>
      </Card>

      {/* HHI + Top 10 concentration */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CardTitle>Chỉ số tập trung HHI</CardTitle>
                <InfoPopover metricKey="periodHHI" />
              </div>
              <div className="inline-flex flex-wrap rounded-md border border-slate-200 bg-slate-50 p-0.5 text-[10px]">
                {hhiDimensions.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setHhiDimId(d.id)}
                    className={cn(
                      'rounded px-2 py-1 font-medium transition-colors',
                      hhiDim.id === d.id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-800'
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-slate-500">
                  HHI kỳ trước
                </div>
                <div className="text-xl font-bold text-slate-700">{Math.round(hhiPrev)}</div>
              </div>
              <div className="text-period-500">→</div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wide text-period-700">
                  HHI kỳ sau
                </div>
                <div className="text-xl font-bold text-period-800">{Math.round(hhiCurr)}</div>
              </div>
            </div>
            <div className="text-[11px] text-slate-500">
              Thang 0–10000. Càng cao càng tập trung. Δ ={' '}
              <strong className={hhiCurr > hhiPrev ? 'text-rose-700' : 'text-emerald-700'}>
                {hhiCurr > hhiPrev ? '+' : ''}
                {Math.round(hhiCurr - hhiPrev)}
              </strong>
              .
            </div>
            <HHIBar value={hhiPrev} label="Kỳ trước" />
            <HHIBar value={hhiCurr} label="Kỳ sau" accent="period" />
            <div className="text-[10px] text-slate-400">
              Quy ước thông dụng: &lt;1500 phân tán · 1500–2500 trung bình · &gt;2500 tập trung cao.
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Top 10 khách hàng tập trung dư nợ — kỳ sau</CardTitle>
              <InfoPopover metricKey="periodTopConcentration" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-slate-500">
                  Tổng dư nợ Top 10
                </div>
                <div className="text-xl font-bold text-slate-900">
                  {fmtCurrency(top10Curr.top10Sum)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wide text-slate-500">% danh mục</div>
                <div className="text-xl font-bold text-period-800">
                  {fmtPercent(top10Curr.sharePct)}
                </div>
              </div>
            </div>
            <div className="scrollbar-thin max-h-60 overflow-y-auto rounded border border-slate-100">
              <table className="w-full text-xs">
                <tbody>
                  {top10Curr.rows.map((r, i) => (
                    <tr key={r.maKH} className="border-b border-slate-100 last:border-0">
                      <td className="w-6 px-2 py-1 text-[10px] text-slate-400">{i + 1}</td>
                      <td className="px-2 py-1 text-slate-700">
                        <div className="truncate font-medium">{r.tenKH}</div>
                        <div className="text-[10px] text-slate-500">{r.maKH}</div>
                      </td>
                      <td className="px-2 py-1 text-right font-semibold text-slate-900">
                        {fmtCurrency(r.tongDuNo)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lịch đáo hạn 90 ngày tới (kỳ sau) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Khế ước đáo hạn trong 90 ngày tới (tính từ kỳ sau)</CardTitle>
            <InfoPopover metricKey="periodMaturity90" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {maturityCurr.map((b) => (
              <div
                key={b.bucket}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              >
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {b.bucket} ngày tới
                </div>
                <div className="mt-1 text-xl font-bold text-slate-900">
                  {fmtNumber(b.count)} khế ước
                </div>
                <div className="text-[11px] text-slate-600">{fmtCurrency(b.tongDuNo)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HHIBar({
  value,
  label,
  accent = 'slate',
}: {
  value: number;
  label: string;
  accent?: 'slate' | 'period';
}) {
  const pct = Math.min(100, (value / 10000) * 100);
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-[10px] text-slate-500">
        <span>{label}</span>
        <span>{Math.round(value)}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100">
        <div
          className={cn(
            'h-2 rounded-full',
            accent === 'period' ? 'bg-period-500' : 'bg-slate-400'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function VintageTable({
  prev,
  curr,
}: {
  prev: ReturnType<typeof vintageNQH>;
  curr: ReturnType<typeof vintageNQH>;
}) {
  // Hợp nhất danh sách năm và sắp xếp tăng dần
  const years = new Set<number | null>();
  for (const v of prev) years.add(v.vintageYear);
  for (const v of curr) years.add(v.vintageYear);
  const sorted = Array.from(years).sort((a, b) => {
    if (a === null) return 1;
    if (b === null) return -1;
    return a - b;
  });
  const prevMap = new Map(prev.map((v) => [v.vintageYear, v]));
  const currMap = new Map(curr.map((v) => [v.vintageYear, v]));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-500">
            <th className="px-3 py-2">Năm vay</th>
            <th className="px-3 py-2 text-right">Dư nợ kỳ trước</th>
            <th className="px-3 py-2 text-right">NQH kỳ trước</th>
            <th className="px-3 py-2 text-right">% NQH kỳ trước</th>
            <th className="px-3 py-2 text-right">Dư nợ kỳ sau</th>
            <th className="px-3 py-2 text-right">NQH kỳ sau</th>
            <th className="px-3 py-2 text-right">% NQH kỳ sau</th>
            <th className="px-3 py-2 text-right">Δ% NQH</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((y) => {
            const p = prevMap.get(y);
            const c = currMap.get(y);
            const prevPct = p ? p.tyLeNQH * 100 : 0;
            const currPct = c ? c.tyLeNQH * 100 : 0;
            const deltaPct = currPct - prevPct;
            return (
              <tr key={String(y)} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-700">
                  {y === null ? '(không rõ)' : y}
                </td>
                <td className="px-3 py-2 text-right text-slate-600">
                  {p ? fmtCompact(p.tongDuNo) : '—'}
                </td>
                <td className="px-3 py-2 text-right text-slate-600">
                  {p ? fmtCompact(p.duNoQuaHan) : '—'}
                </td>
                <td className="px-3 py-2 text-right text-slate-600">
                  {p ? fmtPercent(prevPct) : '—'}
                </td>
                <td className="px-3 py-2 text-right text-slate-600">
                  {c ? fmtCompact(c.tongDuNo) : '—'}
                </td>
                <td className="px-3 py-2 text-right text-slate-600">
                  {c ? fmtCompact(c.duNoQuaHan) : '—'}
                </td>
                <td className="px-3 py-2 text-right text-slate-600">
                  {c ? fmtPercent(currPct) : '—'}
                </td>
                <td
                  className={cn(
                    'px-3 py-2 text-right font-semibold',
                    deltaPct > 0.001 ? 'text-rose-600' : deltaPct < -0.001 ? 'text-emerald-600' : 'text-slate-500'
                  )}
                >
                  {deltaPct > 0 ? '+' : ''}
                  {deltaPct.toFixed(2)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
