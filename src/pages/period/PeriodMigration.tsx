import { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { FilterBar } from '@/components/filters/FilterBar';
import { InfoPopover } from '@/components/ui/InfoPopover';
import { ExportMenu } from '@/components/export/ExportMenu';
import { usePeriodFilterStore } from '@/store/usePeriodFilterStore';
import { usePeriodCompare } from './usePeriodCompare';
import { migrationMatrix, statusLabel, STATUS_ORDER, type LoanStatus } from '@/lib/period-compare';
import { fmtCompact, fmtCurrency, fmtDate, fmtNumber } from '@/lib/format';
import { LoanDetailDrawer } from '@/components/detail/LoanDetailDrawer';
import { cn } from '@/lib/utils';
import type { LoanRecord } from '@/lib/types';

/**
 * Trang 2 — Ma trận chuyển nhóm. 4×4 cells, click cell mở panel liệt kê
 * khế ước thuộc cell đó. Mỗi dòng của panel có nút mở `LoanDetailDrawer`
 * cho cả kỳ trước và kỳ sau.
 */
export function PeriodMigrationPage() {
  const { hasData, prevDate, currDate, loanJoin, currRows, kpiDelta } = usePeriodCompare();
  const [activeCell, setActiveCell] = useState<{ from: LoanStatus; to: LoanStatus } | null>(null);
  const [detail, setDetail] = useState<LoanRecord | null>(null);

  const matrix = useMemo(() => migrationMatrix(loanJoin.joined), [loanJoin]);

  // Index nhanh để lấy joined entry theo key.
  const joinedByKey = useMemo(() => {
    const m = new Map<string, (typeof loanJoin.joined)[number]>();
    for (const j of loanJoin.joined) m.set(j.key, j);
    return m;
  }, [loanJoin]);

  if (!hasData) {
    return <div className="p-6 text-sm text-slate-500">Chưa có dữ liệu so sánh.</div>;
  }

  const cellMap = new Map<string, (typeof matrix.cells)[number]>();
  for (const c of matrix.cells) cellMap.set(`${c.fromStatus}|${c.toStatus}`, c);

  const rank: Record<LoanStatus, number> = { th: 0, qh: 1, kh: 2, none: 3 };

  const activeCellData = activeCell
    ? cellMap.get(`${activeCell.from}|${activeCell.to}`) ?? null
    : null;

  return (
    <div className="space-y-5 p-6">
      <header>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Ma trận chuyển nhóm tình trạng</h1>
            <InfoPopover metricKey="pagePeriodMigration" />
          </div>
          <ExportMenu
            pageTitle="Ma trận chuyển nhóm — So sánh hai kỳ"
            subtitle={`${fmtDate(prevDate)} → ${fmtDate(currDate)} · ${fmtNumber(currRows.length)} khế ước kỳ sau`}
            rows={currRows}
            kpi={kpiDelta.curr}
            size="sm"
          />
        </div>
        <p className="text-sm text-slate-600">
          Mỗi ô là số khế ước chuyển từ tình trạng dòng (kỳ trước · {fmtDate(prevDate)}) sang tình
          trạng cột (kỳ sau · {fmtDate(currDate)}). Bấm vào ô để xem danh sách chi tiết.
        </p>
      </header>

      <Card>
        <CardContent className="py-3">
          <FilterBar useStore={usePeriodFilterStore} accent="period" />
        </CardContent>
      </Card>

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Tóm lược chuyển nhóm
          </h2>
          <InfoPopover metricKey="periodMigrationSummary" />
        </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardContent className="flex items-center gap-3 py-4">
            <div className="rounded-md bg-emerald-100 p-2 text-emerald-700">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                Tổng cải thiện
              </div>
              <div className="text-2xl font-bold text-emerald-900">
                {fmtNumber(matrix.totalImproved)} khế ước
              </div>
              <div className="text-[11px] text-slate-600">
                Dư nợ chuyển từ nhóm xấu hơn về tốt hơn:{' '}
                <strong>{fmtCurrency(matrix.totalDuNoImproved)}</strong>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-rose-200 bg-rose-50/40">
          <CardContent className="flex items-center gap-3 py-4">
            <div className="rounded-md bg-rose-100 p-2 text-rose-700">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">
                Tổng giảm sút
              </div>
              <div className="text-2xl font-bold text-rose-900">
                {fmtNumber(matrix.totalWorsened)} khế ước
              </div>
              <div className="text-[11px] text-slate-600">
                Dư nợ chuyển sang nhóm xấu hơn:{' '}
                <strong>{fmtCurrency(matrix.totalDuNoWorsened)}</strong>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Ma trận chuyển nhóm 4×4</CardTitle>
            <InfoPopover metricKey="periodMigrationMatrix" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-separate border-spacing-1 text-xs">
              <thead>
                <tr>
                  <th className="w-32 px-2 py-2 text-left font-semibold text-slate-500">
                    Kỳ trước ↓ / Kỳ sau →
                  </th>
                  {STATUS_ORDER.map((s) => (
                    <th
                      key={s}
                      className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-600"
                    >
                      {s === 'none' ? 'Tất toán' : statusLabel(s)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {STATUS_ORDER.map((from) => (
                  <tr key={from}>
                    <th className="bg-slate-50 px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                      {from === 'none' ? 'Mới' : statusLabel(from)}
                    </th>
                    {STATUS_ORDER.map((to) => {
                      const cell = cellMap.get(`${from}|${to}`)!;
                      const isDiagonal = from === to;
                      const isImproved = !isDiagonal && from !== 'none' && to !== 'none' && rank[to] < rank[from];
                      const isWorsened = !isDiagonal && from !== 'none' && to !== 'none' && rank[to] > rank[from];
                      const isLifecycle = from === 'none' || to === 'none';
                      const empty = cell.count === 0;
                      const active =
                        activeCell && activeCell.from === from && activeCell.to === to;
                      return (
                        <td key={to} className="p-0">
                          <button
                            type="button"
                            onClick={() =>
                              empty ? null : setActiveCell({ from, to })
                            }
                            disabled={empty}
                            className={cn(
                              'flex h-20 w-full flex-col items-center justify-center rounded-md border text-center transition-colors',
                              empty && 'cursor-default border-slate-100 bg-slate-50 text-slate-300',
                              !empty && isDiagonal && 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                              !empty &&
                                isImproved &&
                                'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
                              !empty &&
                                isWorsened &&
                                'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100',
                              !empty &&
                                isLifecycle &&
                                'border-slate-200 bg-slate-50/60 text-slate-700 hover:bg-slate-100',
                              active && 'ring-2 ring-period-500 ring-offset-1'
                            )}
                          >
                            <span className="text-base font-bold">
                              {empty ? '—' : fmtNumber(cell.count)}
                            </span>
                            {!empty && (
                              <span className="text-[9px] text-slate-500">
                                {fmtCompact(cell.duNoCurr)}
                              </span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded-sm bg-emerald-200" /> Cải thiện
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded-sm bg-rose-200" /> Giảm sút
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded-sm bg-slate-200" /> Cùng nhóm hoặc đóng/mở
            </span>
          </div>
        </CardContent>
      </Card>

      {activeCellData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Chi tiết ô:{' '}
                {activeCellData.fromStatus === 'none' ? 'Mới' : statusLabel(activeCellData.fromStatus)} →{' '}
                {activeCellData.toStatus === 'none'
                  ? 'Tất toán'
                  : statusLabel(activeCellData.toStatus)}
              </CardTitle>
              <button
                type="button"
                onClick={() => setActiveCell(null)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="scrollbar-thin max-h-[420px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="text-left text-slate-500">
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Khế ước · Khách hàng</th>
                    <th className="px-3 py-2">PGD · ĐVUT</th>
                    <th className="px-3 py-2">Tổ TK&VV</th>
                    <th className="px-3 py-2 text-right">Dư nợ kỳ trước</th>
                    <th className="px-3 py-2 text-right">Dư nợ kỳ sau</th>
                  </tr>
                </thead>
                <tbody>
                  {activeCellData.loanKeys.slice(0, 200).map((k, i) => {
                    const j = joinedByKey.get(k);
                    if (!j) return null;
                    const ref = j.curr ?? j.prev!;
                    return (
                      <tr
                        key={k}
                        onClick={() => setDetail(ref)}
                        className="cursor-pointer border-t border-slate-100 hover:bg-period-50"
                      >
                        <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-800">{ref.tenKH}</div>
                          <div className="text-[10px] text-slate-500">
                            KƯ {ref.soKheUoc} · {ref.maKH}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          <div>{ref.tenPGD}</div>
                          <div className="text-[10px] text-slate-500">{ref.tenDVUT}</div>
                        </td>
                        <td
                          className="max-w-[160px] truncate px-3 py-2 text-slate-600"
                          title={ref.tenTo}
                        >
                          {ref.tenTo || '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-700">
                          {j.prev ? fmtCurrency(j.prev.tongDuNo) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-900">
                          {j.curr ? fmtCurrency(j.curr.tongDuNo) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {activeCellData.loanKeys.length > 200 && (
                <div className="border-t border-slate-100 px-3 py-2 text-center text-[10px] text-slate-500">
                  Hiển thị 200 / {fmtNumber(activeCellData.loanKeys.length)} khế ước. Dùng bộ lọc
                  để thu hẹp.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <LoanDetailDrawer record={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
