import { useMemo, useState, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { applyFilters, useDataStore } from '@/store/useDataStore';
import { Card, CardContent } from '@/components/ui/Card';
import { InfoPopover } from '@/components/ui/InfoPopover';
import { ExportMenu } from '@/components/export/ExportMenu';
import { FilterBar } from '@/components/filters/FilterBar';
import { LoanDetailDrawer } from '@/components/detail/LoanDetailDrawer';
import { computeKpi } from '@/lib/metrics';
import { fmtCurrency, fmtDate, fmtPercent } from '@/lib/format';
import type { LoanRecord } from '@/lib/types';
import { ArrowDownAZ, ArrowUpAZ } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Col {
  key: keyof LoanRecord;
  label: string;
  width: number;
  align?: 'left' | 'right';
  render?: (r: LoanRecord) => string;
}

const COLS: Col[] = [
  { key: 'soKheUoc', label: 'Số khế ước', width: 130 },
  { key: 'tenKH', label: 'Khách hàng', width: 200 },
  { key: 'tenPGD', label: 'PGD', width: 160 },
  { key: 'tenXa', label: 'Xã/Phường', width: 140 },
  { key: 'tenDVUT', label: 'Đơn vị ủy thác', width: 160 },
  { key: 'tenTo', label: 'Tổ TK&VV', width: 180 },
  { key: 'tenChuongTrinh', label: 'Chương trình', width: 220 },
  { key: 'tinhTrangMonVay', label: 'Tình trạng', width: 110 },
  { key: 'mucVay', label: 'Mức vay', width: 130, align: 'right', render: (r) => fmtCurrency(r.mucVay) },
  { key: 'tongDuNo', label: 'Tổng dư nợ', width: 140, align: 'right', render: (r) => fmtCurrency(r.tongDuNo) },
  { key: 'duNoQuaHan', label: 'Dư nợ QH', width: 130, align: 'right', render: (r) => fmtCurrency(r.duNoQuaHan) },
  { key: 'laiSuat', label: 'Lãi suất', width: 90, align: 'right', render: (r) => fmtPercent(r.laiSuat, 3) },
  { key: 'ngayVay', label: 'Ngày vay', width: 100, render: (r) => fmtDate(r.ngayVay) },
  { key: 'ngayDHGDXA', label: 'Ngày ĐH theo GDXA', width: 140, render: (r) => fmtDate(r.ngayDHGDXA) },
];

export function ExplorerPage() {
  const { rows, filters, ranges, search } = useDataStore();
  const [sort, setSort] = useState<{ key: keyof LoanRecord; dir: 'asc' | 'desc' }>({
    key: 'tongDuNo',
    dir: 'desc',
  });
  const [detail, setDetail] = useState<LoanRecord | null>(null);

  const filtered = useMemo(
    () => applyFilters(rows, filters, ranges, search),
    [rows, filters, ranges, search]
  );

  const kpi = useMemo(() => computeKpi(filtered), [filtered]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === 'number' && typeof bv === 'number') {
        return sort.dir === 'asc' ? av - bv : bv - av;
      }
      const as = String(av ?? '');
      const bs = String(bv ?? '');
      return sort.dir === 'asc' ? as.localeCompare(bs, 'vi') : bs.localeCompare(as, 'vi');
    });
    return copy;
  }, [filtered, sort]);

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 8,
  });

  const totalWidth = COLS.reduce((s, c) => s + c.width, 0);

  return (
    <div className="space-y-4 p-6">
      <header className="space-y-3">
        <div>
          <ExportMenu
            pageTitle="Tra cứu chi tiết khế ước"
            subtitle={`${sorted.length.toLocaleString('vi-VN')} khế ước`}
            rows={sorted}
            kpi={kpi}
            size="sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Tra cứu chi tiết khế ước</h1>
          <InfoPopover metricKey="pageExplorer" />
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {sorted.length.toLocaleString('vi-VN')} khế ước · Nhấn vào dòng để xem toàn bộ thông tin chi tiết
        </p>
      </header>

      <Card>
        <CardContent className="py-3">
          <FilterBar />
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div
          ref={parentRef}
          className="scrollbar-thin h-[calc(100vh-280px)] overflow-auto"
        >
          <div style={{ width: totalWidth }}>
            <div className="sticky top-0 z-10 flex border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {COLS.map((c) => {
                const active = sort.key === c.key;
                return (
                  <button
                    key={String(c.key)}
                    onClick={() =>
                      setSort((s) =>
                        s.key === c.key
                          ? { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
                          : { key: c.key, dir: 'desc' }
                      )
                    }
                    style={{ width: c.width }}
                    className={cn(
                      'flex items-center gap-1 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700',
                      c.align === 'right' && 'justify-end',
                      active && 'text-brand-700 dark:text-brand-400'
                    )}
                  >
                    {c.label}
                    {active && (sort.dir === 'asc' ? <ArrowUpAZ className="h-3 w-3" /> : <ArrowDownAZ className="h-3 w-3" />)}
                  </button>
                );
              })}
            </div>
            <div
              style={{
                height: rowVirtualizer.getTotalSize(),
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((vi) => {
                const r = sorted[vi.index];
                return (
                  <div
                    key={vi.key}
                    onClick={() => setDetail(r)}
                    style={{
                      position: 'absolute',
                      top: 0,
                      transform: `translateY(${vi.start}px)`,
                      height: vi.size,
                      width: '100%',
                    }}
                    className="flex cursor-pointer border-b border-slate-100 text-xs hover:bg-brand-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-brand-900/20"
                  >
                    {COLS.map((c) => (
                      <div
                        key={String(c.key)}
                        style={{ width: c.width }}
                        className={cn(
                          'flex items-center truncate px-3',
                          c.align === 'right' && 'justify-end font-medium text-slate-900 dark:text-slate-100'
                        )}
                      >
                        {c.render ? c.render(r) : String(r[c.key] ?? '')}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      <LoanDetailDrawer record={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
