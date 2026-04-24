import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { FilterBar } from '@/components/filters/FilterBar';
import { InfoPopover } from '@/components/ui/InfoPopover';
import { ExportMenu } from '@/components/export/ExportMenu';
import { LoanDetailDrawer } from '@/components/detail/LoanDetailDrawer';
import { usePeriodFilterStore } from '@/store/usePeriodFilterStore';
import { usePeriodStore } from '@/store/usePeriodStore';
import { usePeriodCompare } from './usePeriodCompare';
import { classifyChanges, type LoanChange, type LoanChangeType } from '@/lib/period-compare';
import { fmtCompact, fmtCurrency, fmtDate, fmtNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { LoanRecord } from '@/lib/types';

/**
 * Trang 4 — Bảng khế ước biến động. Liệt kê mọi khế ước được phân loại
 * theo `classifyChanges` (mới · tất toán · tăng dư nợ · giảm dư nợ ·
 * chuyển xấu · cải thiện · gia hạn · không đổi). Click một dòng mở
 * `LoanDetailDrawer` để xem 174 trường gốc.
 */

const CHANGE_TYPES: { id: LoanChangeType; label: string; tone: string }[] = [
  { id: 'new', label: 'Mới phát sinh', tone: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  { id: 'closed', label: 'Đã tất toán', tone: 'border-slate-200 bg-slate-50 text-slate-700' },
  { id: 'worsened', label: 'Chuyển xấu', tone: 'border-rose-200 bg-rose-50 text-rose-800' },
  { id: 'improved', label: 'Cải thiện', tone: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  { id: 'increased', label: 'Tăng dư nợ', tone: 'border-period-200 bg-period-50 text-period-800' },
  { id: 'decreased', label: 'Giảm dư nợ', tone: 'border-amber-200 bg-amber-50 text-amber-800' },
  { id: 'extended', label: 'Gia hạn', tone: 'border-blue-200 bg-blue-50 text-blue-800' },
  { id: 'unchanged', label: 'Không đổi', tone: 'border-slate-200 bg-slate-50 text-slate-500' },
];

export function PeriodExplorerPage() {
  const { hasData, loanJoin, prevDate, currDate, currRows, kpiDelta } = usePeriodCompare();
  const consumePendingDrill = usePeriodStore((s) => s.consumePendingDrill);
  const addFilter = usePeriodStore((s) => s.addFilter);
  const [activeTypes, setActiveTypes] = useState<Set<LoanChangeType>>(
    new Set(['new', 'closed', 'worsened', 'improved', 'increased', 'decreased', 'extended'])
  );
  const [detail, setDetail] = useState<LoanRecord | null>(null);

  // Nếu được drill-down từ trang khác (Top movers / Hội đoàn thể) thì
  // lấy yêu cầu pending và áp đặt vào filter store một lần.
  useEffect(() => {
    const drill = consumePendingDrill();
    if (!drill) return;
    if (drill.filters) {
      for (const f of drill.filters) {
        addFilter({ field: f.field, values: [f.value] });
      }
    }
    if (drill.changeType) {
      setActiveTypes(new Set([drill.changeType]));
    }
  }, [consumePendingDrill, addFilter]);

  const changes = useMemo(() => classifyChanges(loanJoin.joined), [loanJoin]);

  // Tổng hợp số đếm theo loại
  const counts = useMemo(() => {
    const m = new Map<LoanChangeType, number>();
    for (const c of changes) m.set(c.type, (m.get(c.type) ?? 0) + 1);
    return m;
  }, [changes]);

  const filtered = useMemo(
    () => changes.filter((c) => activeTypes.has(c.type)),
    [changes, activeTypes]
  );

  // Sắp xếp: ưu tiên biến động tuyệt đối lớn nhất
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => Math.abs(b.duNoDelta) - Math.abs(a.duNoDelta)),
    [filtered]
  );

  if (!hasData) return <div className="p-6 text-sm text-slate-500">Chưa có dữ liệu so sánh.</div>;

  const toggle = (id: LoanChangeType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-5 p-6">
      <header>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Bảng khế ước biến động</h1>
            <InfoPopover metricKey="pagePeriodExplorer" />
          </div>
          <ExportMenu
            pageTitle="Bảng khế ước biến động — So sánh hai kỳ"
            subtitle={`${fmtDate(prevDate)} → ${fmtDate(currDate)} · ${fmtNumber(currRows.length)} khế ước kỳ sau`}
            rows={currRows}
            kpi={kpiDelta.curr}
            size="sm"
          />
        </div>
        <p className="text-sm text-slate-600">
          Mọi khế ước đã thay đổi giữa <strong>{fmtDate(prevDate)}</strong> và{' '}
          <strong>{fmtDate(currDate)}</strong>. Bấm vào một dòng để xem 174 trường gốc của khế ước.
        </p>
      </header>

      <Card>
        <CardContent className="py-3">
          <FilterBar useStore={usePeriodFilterStore} accent="period" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 py-3">
          <span className="mr-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Loại biến động
          </span>
          {CHANGE_TYPES.map((t) => {
            const active = activeTypes.has(t.id);
            const c = counts.get(t.id) ?? 0;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggle(t.id)}
                className={cn(
                  'rounded-full border px-3 py-1 text-[11px] font-medium transition-opacity',
                  t.tone,
                  !active && 'opacity-40'
                )}
              >
                {t.label}
                <span className="ml-1.5 text-[10px] opacity-75">{fmtNumber(c)}</span>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>
            {fmtNumber(sorted.length)} khế ước · sắp xếp theo độ lớn biến động dư nợ
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="scrollbar-thin max-h-[640px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="text-left text-slate-500">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Loại</th>
                  <th className="px-3 py-2">Khế ước · Khách hàng</th>
                  <th className="px-3 py-2">PGD · ĐVUT</th>
                  <th className="px-3 py-2">Tổ TK&VV</th>
                  <th className="px-3 py-2 text-right">Dư nợ kỳ trước</th>
                  <th className="px-3 py-2 text-right">Dư nợ kỳ sau</th>
                  <th className="px-3 py-2 text-right">Δ dư nợ</th>
                </tr>
              </thead>
              <tbody>
                {sorted.slice(0, 500).map((c, i) => {
                  const ref = c.curr ?? c.prev!;
                  const tone = CHANGE_TYPES.find((t) => t.id === c.type)?.tone ?? '';
                  return (
                    <tr
                      key={c.key}
                      onClick={() => setDetail(ref)}
                      className="cursor-pointer border-t border-slate-100 hover:bg-period-50"
                    >
                      <td className="px-3 py-2 text-[10px] text-slate-400">{i + 1}</td>
                      <td className="px-3 py-2">
                        <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', tone)}>
                          {CHANGE_TYPES.find((t) => t.id === c.type)?.label}
                        </span>
                      </td>
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
                      <td className="px-3 py-2 text-right text-slate-600">
                        {c.prev ? fmtCurrency(c.prev.tongDuNo) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-900">
                        {c.curr ? fmtCurrency(c.curr.tongDuNo) : '—'}
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2 text-right font-semibold',
                          c.duNoDelta > 0 ? 'text-emerald-700' : c.duNoDelta < 0 ? 'text-rose-600' : 'text-slate-500'
                        )}
                      >
                        {c.duNoDelta > 0 ? '+' : ''}
                        {fmtCompact(c.duNoDelta)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {sorted.length > 500 && (
              <div className="border-t border-slate-100 px-3 py-2 text-center text-[10px] text-slate-500">
                Hiển thị 500 / {fmtNumber(sorted.length)} khế ước. Dùng bộ lọc và chip loại để thu
                hẹp.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <LoanDetailDrawer record={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

/**
 * `LoanChange` không được sử dụng trực tiếp ở runtime — re-export để giữ
 * type-only import cho TypeScript khi đọc trang.
 */
export type { LoanChange };
