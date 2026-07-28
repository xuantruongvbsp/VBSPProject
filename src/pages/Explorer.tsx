import { useMemo, useState, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { applyFilters, useDataStore } from '@/store/useDataStore';
import { useTxnPointStore } from '@/store/useTxnPointStore';
import { useCreditPlanStore } from '@/store/useCreditPlanStore';
import { Card, CardContent } from '@/components/ui/Card';
import { InfoPopover } from '@/components/ui/InfoPopover';
import { ExportMenu } from '@/components/export/ExportMenu';
import { FilterBar } from '@/components/filters/FilterBar';
import { LoanDetailDrawer } from '@/components/detail/LoanDetailDrawer';
import { computeKpi } from '@/lib/metrics';
import { buildThonToDGDNames } from '@/lib/thon-coverage';
import { fmtCurrency, fmtDate, fmtPercent } from '@/lib/format';
import type { LoanRecord } from '@/lib/types';
import { ArrowDownAZ, ArrowUpAZ } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Khóa cột tổng hợp không thuộc LoanRecord (suy ra từ dữ liệu khác). */
type SyntheticColKey = 'tenDGD' | 'nq11';
type ColKey = keyof LoanRecord | SyntheticColKey;

interface Col {
  key: ColKey;
  label: string;
  width: number;
  align?: 'left' | 'right';
  render?: (r: LoanRecord, ctx: ColRenderCtx) => string;
}

interface ColRenderCtx {
  /** Map maKH → max(soDuTienGui105) — dùng cho cột "Số dư tiền gửi 105" để hiện
   *  giá trị mức cao nhất của khách (do field này lặp trên nhiều dòng khế ước). */
  maxDepositByKH: Map<string, number>;
  /** Map maThon → tên ĐGD (Điểm giao dịch) — suy ra từ danh mục ĐGD. */
  thonToDGD: Map<string, string>;
  /** Set "Số khế ước" thuộc NQ11 (GQVL + NOXH) — từ store Kế hoạch tín dụng. */
  nq11Set: Set<string>;
}

const COLS: Col[] = [
  { key: 'soKheUoc', label: 'Số khế ước', width: 130 },
  { key: 'tenKH', label: 'Khách hàng', width: 200 },
  { key: 'tenXa', label: 'Xã/Phường', width: 140 },
  { key: 'tenDGD', label: 'ĐGD', width: 160, render: (r, ctx) => ctx.thonToDGD.get(r.maThon) ?? '' },
  { key: 'tenDVUT', label: 'Đơn vị ủy thác', width: 160 },
  { key: 'tenTo', label: 'Tổ TK&VV', width: 180 },
  { key: 'tenChuongTrinh', label: 'Chương trình', width: 220 },
  {
    key: 'nq11',
    label: 'NQ11',
    width: 80,
    render: (r, ctx) => (ctx.nq11Set.has(String(r.soKheUoc)) ? 'Có' : 'Không'),
  },
  { key: 'tinhTrangMonVay', label: 'Tình trạng', width: 110 },
  { key: 'mucVay', label: 'Mức vay', width: 130, align: 'right', render: (r) => fmtCurrency(r.mucVay) },
  { key: 'tongDuNo', label: 'Tổng dư nợ', width: 140, align: 'right', render: (r) => fmtCurrency(r.tongDuNo) },
  { key: 'duNoQuaHan', label: 'Dư nợ QH', width: 130, align: 'right', render: (r) => fmtCurrency(r.duNoQuaHan) },
  {
    key: 'soDuTienGui105',
    label: 'Số dư TG 105',
    width: 140,
    align: 'right',
    // Hiển thị max theo maKH (field lặp trên nhiều dòng cùng 1 KH).
    render: (r, ctx) => fmtCurrency(ctx.maxDepositByKH.get(r.maKH) ?? r.soDuTienGui105),
  },
  { key: 'laiSuat', label: 'Lãi suất', width: 90, align: 'right', render: (r) => fmtPercent(r.laiSuat, 3) },
  { key: 'ngayVay', label: 'Ngày vay', width: 100, render: (r) => fmtDate(r.ngayVay) },
  { key: 'ngayDHGDXA', label: 'Ngày ĐH theo GDXA', width: 140, render: (r) => fmtDate(r.ngayDHGDXA) },
];

export function ExplorerPage() {
  const { rows, filters, ranges, search, nq11Filter, depositByKH } = useDataStore();
  const points = useTxnPointStore((s) => s.points);
  const nq11MonVayIds = useCreditPlanStore((s) => s.nq11MonVayIds);
  const nq11NoxhMonVayIds = useCreditPlanStore((s) => s.nq11NoxhMonVayIds);

  // Set "Số khế ước" thuộc NQ11 = hợp GQVL (SK_GQVL) + NOXH (NĐ100). Ở Báo cáo
  // 31 không có cột "Mã món vay" riêng — "Số khế ước" chính là định danh món
  // vay, và danh sách NQ11 dùng cùng định dạng nên so trực tiếp được.
  const nq11Set = useMemo(
    () => new Set<string>([...nq11MonVayIds, ...nq11NoxhMonVayIds].map(String)),
    [nq11MonVayIds, nq11NoxhMonVayIds]
  );
  const [sort, setSort] = useState<{ key: ColKey; dir: 'asc' | 'desc' }>({
    key: 'tenXa',
    dir: 'asc',
  });
  const [detail, setDetail] = useState<LoanRecord | null>(null);

  const filtered = useMemo(() => {
    let out = applyFilters(rows, filters, ranges, search, depositByKH);
    // Lọc NQ11 áp sau applyFilters vì cần Set từ store Kế hoạch tín dụng.
    if (nq11Filter !== 'all') {
      const want = nq11Filter === 'yes';
      out = out.filter((r) => nq11Set.has(String(r.soKheUoc)) === want);
    }
    return out;
  }, [rows, filters, ranges, search, nq11Filter, nq11Set, depositByKH]);

  const kpi = useMemo(() => computeKpi(filtered), [filtered]);

  // Số dư TK 105 là chỉ tiêu cấp KHÁCH HÀNG, chỉ nằm trên MỘT khế ước của khách
  // (các dòng khác = 0) và có thể là khế ước đã tất toán (đã bị ẩn khỏi `rows`).
  // Dùng map tính sẵn ở store trên TOÀN BỘ khế ước — kể cả close — để không hiện
  // nhầm 0. Xem `useDataStore.depositByKH`.
  const maxDepositByKH = depositByKH;

  // Map maThon → tên ĐGD. Một thôn thuộc nhiều ĐGD (hiếm) thì nối tên bằng ' / '.
  const thonToDGD = useMemo(() => buildThonToDGDNames(points), [points]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    // Khi sort theo soDuTienGui105 → so sánh max-per-KH để dòng cùng KH luôn cạnh nhau.
    const sortKey = sort.key;
    copy.sort((a, b) => {
      const av = sortKey === 'soDuTienGui105'
        ? (maxDepositByKH.get(a.maKH) ?? 0)
        : sortKey === 'tenDGD'
        ? (thonToDGD.get(a.maThon) ?? '')
        : sortKey === 'nq11'
        ? (nq11Set.has(String(a.soKheUoc)) ? 1 : 0)
        : a[sortKey];
      const bv = sortKey === 'soDuTienGui105'
        ? (maxDepositByKH.get(b.maKH) ?? 0)
        : sortKey === 'tenDGD'
        ? (thonToDGD.get(b.maThon) ?? '')
        : sortKey === 'nq11'
        ? (nq11Set.has(String(b.soKheUoc)) ? 1 : 0)
        : b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') {
        return sort.dir === 'asc' ? av - bv : bv - av;
      }
      const as = String(av ?? '');
      const bs = String(bv ?? '');
      return sort.dir === 'asc' ? as.localeCompare(bs, 'vi') : bs.localeCompare(as, 'vi');
    });
    return copy;
  }, [filtered, sort, maxDepositByKH, thonToDGD, nq11Set]);

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
          <FilterBar showDepositThreshold showNq11Filter />
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
                        {c.render
                          ? c.render(r, { maxDepositByKH, thonToDGD, nq11Set })
                          : String(r[c.key as keyof LoanRecord] ?? '')}
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
