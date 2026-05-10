import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  Download,
  MapPin,
  Search,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FilterBar } from '@/components/filters/FilterBar';
import { InfoPopover } from '@/components/ui/InfoPopover';
import { usePeriodFilterStore } from '@/store/usePeriodFilterStore';
import { usePeriodStore } from '@/store/usePeriodStore';
import { useTxnPointStore } from '@/store/useTxnPointStore';
import { usePeriodCompare } from './usePeriodCompare';
import { type JoinedLoan } from '@/lib/period-compare';
import {
  exportPointComparisonToXlsx,
  type PointComparisonXlsxRow,
} from '@/lib/export-xlsx';
import { fmtCompact, fmtNumber, fmtPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { TxnPointRecord } from '@/lib/types';

type SortKey =
  | 'tenDGD'
  | 'currTongDuNo'
  | 'deltaTongDuNo'
  | 'pctTongDuNo'
  | 'currDuNoQH'
  | 'deltaTyLeNQH'
  | 'currDuNoKhoanh'
  | 'deltaTyLeKhoanh'
  | 'newLoans'
  | 'closedLoans';

interface PointSlice {
  point: TxnPointRecord;
  thonCount: number;

  // Counts
  prevLoans: number;
  currLoans: number;
  newLoans: number;
  closedLoans: number;
  prevCustomers: number;
  currCustomers: number;

  // Dư nợ
  prevTongDuNo: number;
  currTongDuNo: number;
  deltaTongDuNo: number;
  pctTongDuNo: number | null;

  // NQH
  prevDuNoQH: number;
  currDuNoQH: number;
  prevTyLeNQH: number;
  currTyLeNQH: number;
  deltaTyLeNQH: number;

  // Khoanh
  prevDuNoKhoanh: number;
  currDuNoKhoanh: number;
  prevTyLeKhoanh: number;
  currTyLeKhoanh: number;
  deltaTyLeKhoanh: number;
}

const NUMERIC_KEYS: SortKey[] = [
  'currTongDuNo',
  'deltaTongDuNo',
  'pctTongDuNo',
  'currDuNoQH',
  'deltaTyLeNQH',
  'currDuNoKhoanh',
  'deltaTyLeKhoanh',
  'newLoans',
  'closedLoans',
];

/**
 * Trang "So sánh hiệu quả ĐGD" — bảng xếp hạng các Điểm giao dịch giữa
 * kỳ trước và kỳ sau. Phạm vi mỗi ĐGD = các Mã thôn được gán trong danh
 * mục. Khế ước thuộc thôn không có ĐGD duy nhất được tổng hợp riêng
 * (Chưa gán / Nhiều ĐGD) để thấy phần ngoài tầm phủ.
 */
export function PeriodPointComparisonPage() {
  const navigate = useNavigate();
  const setPendingDrill = usePeriodStore((s) => s.setPendingDrill);
  const points = useTxnPointStore((s) => s.points);
  const selectPoint = useTxnPointStore((s) => s.selectPoint);

  const { hasData, loanJoin, prevDate, currDate } = usePeriodCompare();

  // Mapping: maThon → danh sách point.id phụ trách
  const thonToPointIds = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of points) {
      for (const t of p.maThons) {
        const list = map.get(t);
        if (list) {
          if (!list.includes(p.id)) list.push(p.id);
        } else {
          map.set(t, [p.id]);
        }
      }
    }
    return map;
  }, [points]);

  // Tính slice từng ĐGD + 2 nhóm phụ
  const computed = useMemo(() => {
    const empty = (): Omit<PointSlice, 'point' | 'thonCount'> => ({
      prevLoans: 0,
      currLoans: 0,
      newLoans: 0,
      closedLoans: 0,
      prevCustomers: 0,
      currCustomers: 0,
      prevTongDuNo: 0,
      currTongDuNo: 0,
      deltaTongDuNo: 0,
      pctTongDuNo: null,
      prevDuNoQH: 0,
      currDuNoQH: 0,
      prevTyLeNQH: 0,
      currTyLeNQH: 0,
      deltaTyLeNQH: 0,
      prevDuNoKhoanh: 0,
      currDuNoKhoanh: 0,
      prevTyLeKhoanh: 0,
      currTyLeKhoanh: 0,
      deltaTyLeKhoanh: 0,
    });
    type Bucket = ReturnType<typeof empty> & {
      prevCustSet: Set<string>;
      currCustSet: Set<string>;
    };
    const newBucket = (): Bucket => ({ ...empty(), prevCustSet: new Set(), currCustSet: new Set() });

    const slices = new Map<string, Bucket>();
    for (const p of points) slices.set(p.id, newBucket());
    const unassigned = newBucket();
    const ambiguous = newBucket();

    const route = (j: JoinedLoan): Bucket => {
      const r = j.curr ?? j.prev;
      if (!r) return unassigned;
      const owners = thonToPointIds.get(r.maThon ?? '') ?? [];
      if (owners.length === 0) return unassigned;
      if (owners.length > 1) return ambiguous;
      const slice = slices.get(owners[0]);
      return slice ?? unassigned;
    };

    for (const j of loanJoin.joined) {
      const b = route(j);

      if (j.prev) {
        b.prevLoans += 1;
        b.prevTongDuNo += j.prev.tongDuNo;
        b.prevDuNoQH += j.prev.duNoQuaHan;
        b.prevDuNoKhoanh += j.prev.duNoKhoanh;
        if (j.prev.maKH) b.prevCustSet.add(j.prev.maKH);
      }
      if (j.curr) {
        b.currLoans += 1;
        b.currTongDuNo += j.curr.tongDuNo;
        b.currDuNoQH += j.curr.duNoQuaHan;
        b.currDuNoKhoanh += j.curr.duNoKhoanh;
        if (j.curr.maKH) b.currCustSet.add(j.curr.maKH);
      }
      if (j.bucket === 'new') b.newLoans += 1;
      if (j.bucket === 'closed') b.closedLoans += 1;
    }

    const finalize = (b: Bucket): Omit<PointSlice, 'point' | 'thonCount'> => {
      const prevTyLeNQH = b.prevTongDuNo > 0 ? (b.prevDuNoQH / b.prevTongDuNo) * 100 : 0;
      const currTyLeNQH = b.currTongDuNo > 0 ? (b.currDuNoQH / b.currTongDuNo) * 100 : 0;
      const prevTyLeKhoanh = b.prevTongDuNo > 0 ? (b.prevDuNoKhoanh / b.prevTongDuNo) * 100 : 0;
      const currTyLeKhoanh = b.currTongDuNo > 0 ? (b.currDuNoKhoanh / b.currTongDuNo) * 100 : 0;
      return {
        prevLoans: b.prevLoans,
        currLoans: b.currLoans,
        newLoans: b.newLoans,
        closedLoans: b.closedLoans,
        prevCustomers: b.prevCustSet.size,
        currCustomers: b.currCustSet.size,
        prevTongDuNo: b.prevTongDuNo,
        currTongDuNo: b.currTongDuNo,
        deltaTongDuNo: b.currTongDuNo - b.prevTongDuNo,
        pctTongDuNo:
          b.prevTongDuNo > 0 ? ((b.currTongDuNo - b.prevTongDuNo) / b.prevTongDuNo) * 100 : null,
        prevDuNoQH: b.prevDuNoQH,
        currDuNoQH: b.currDuNoQH,
        prevTyLeNQH,
        currTyLeNQH,
        deltaTyLeNQH: currTyLeNQH - prevTyLeNQH,
        prevDuNoKhoanh: b.prevDuNoKhoanh,
        currDuNoKhoanh: b.currDuNoKhoanh,
        prevTyLeKhoanh,
        currTyLeKhoanh,
        deltaTyLeKhoanh: currTyLeKhoanh - prevTyLeKhoanh,
      };
    };

    const rows: PointSlice[] = points.map((p) => {
      const b = slices.get(p.id)!;
      return {
        point: p,
        thonCount: p.maThons.length,
        ...finalize(b),
      };
    });

    return {
      rows,
      unassigned: finalize(unassigned),
      ambiguous: finalize(ambiguous),
    };
  }, [loanJoin, points, thonToPointIds]);

  const [sortKey, setSortKey] = useState<SortKey>('deltaTongDuNo');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = computed.rows;
    if (q) {
      arr = arr.filter(
        (r) =>
          r.point.maDGD.toLowerCase().includes(q) ||
          r.point.tenDGD.toLowerCase().includes(q)
      );
    }
    arr = [...arr].sort((a, b) => {
      const av = sortKey === 'tenDGD' ? a.point.tenDGD : (a as any)[sortKey];
      const bv = sortKey === 'tenDGD' ? b.point.tenDGD : (b as any)[sortKey];
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv, 'vi') : bv.localeCompare(av, 'vi');
      }
      const an = (av ?? 0) as number;
      const bn = (bv ?? 0) as number;
      return sortDir === 'asc' ? an - bn : bn - an;
    });
    return arr;
  }, [computed.rows, sortKey, sortDir, search]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(k);
      setSortDir(NUMERIC_KEYS.includes(k) ? 'desc' : 'asc');
    }
  }

  function handleDrill(p: TxnPointRecord) {
    selectPoint(p.id);
    setPendingDrill({ to: '/period/khe-uoc' });
    navigate('/period/khe-uoc');
  }

  async function handleExport() {
    const exportRows: PointComparisonXlsxRow[] = computed.rows.map((r) => ({
      maDGD: r.point.maDGD,
      tenDGD: r.point.tenDGD,
      thonCount: r.thonCount,
      prevLoans: r.prevLoans,
      currLoans: r.currLoans,
      prevCustomers: r.prevCustomers,
      currCustomers: r.currCustomers,
      prevTongDuNo: r.prevTongDuNo,
      currTongDuNo: r.currTongDuNo,
      deltaTongDuNo: r.deltaTongDuNo,
      pctTongDuNo: r.pctTongDuNo,
      prevDuNoQH: r.prevDuNoQH,
      currDuNoQH: r.currDuNoQH,
      prevTyLeNQH: r.prevTyLeNQH,
      currTyLeNQH: r.currTyLeNQH,
      deltaTyLeNQH: r.deltaTyLeNQH,
      prevDuNoKhoanh: r.prevDuNoKhoanh,
      currDuNoKhoanh: r.currDuNoKhoanh,
      prevTyLeKhoanh: r.prevTyLeKhoanh,
      currTyLeKhoanh: r.currTyLeKhoanh,
      deltaTyLeKhoanh: r.deltaTyLeKhoanh,
      newLoans: r.newLoans,
      closedLoans: r.closedLoans,
    }));
    type SummaryData = Omit<PointComparisonXlsxRow, 'maDGD' | 'tenDGD' | 'thonCount'>;
    const summaryRows: { label: string; data: SummaryData }[] = [];
    if (computed.unassigned.currLoans > 0 || computed.unassigned.prevLoans > 0) {
      summaryRows.push({ label: '(Chưa gán ĐGD)', data: computed.unassigned });
    }
    if (computed.ambiguous.currLoans > 0 || computed.ambiguous.prevLoans > 0) {
      summaryRows.push({ label: '(Nhiều ĐGD)', data: computed.ambiguous });
    }
    await exportPointComparisonToXlsx({
      rows: exportRows,
      summaryRows,
      prevDate,
      currDate,
    });
  }

  if (!hasData) {
    return (
      <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
        Chưa có dữ liệu so sánh — hãy chọn 2 kỳ trên menu trên cùng trước.
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="space-y-4 p-6">
        <header>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            So sánh hiệu quả ĐGD
          </h1>
        </header>
        <Card>
          <CardContent className="py-6 text-sm text-slate-600 dark:text-slate-300">
            Chưa có Điểm giao dịch trong danh mục — hãy thêm ở /snapshot/diem-giao-dich trước.
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalCurrTongDuNo =
    computed.rows.reduce((s, r) => s + r.currTongDuNo, 0) +
    computed.unassigned.currTongDuNo +
    computed.ambiguous.currTongDuNo;
  const coveredCurrTongDuNo = computed.rows.reduce((s, r) => s + r.currTongDuNo, 0);
  const coveragePct = totalCurrTongDuNo > 0 ? coveredCurrTongDuNo / totalCurrTongDuNo : 0;

  return (
    <div className="space-y-5 p-6">
      <header>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-6 w-6 text-period-700 dark:text-period-300" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              So sánh hiệu quả ĐGD
            </h1>
            <InfoPopover
              explanation={{
                title: 'So sánh hiệu quả Điểm giao dịch',
                definition:
                  'Bảng xếp hạng các Điểm giao dịch giữa kỳ trước và kỳ sau. Phạm vi mỗi ĐGD là các Mã thôn được gán trong danh mục Điểm giao dịch. Khế ước thuộc thôn chưa có ĐGD duy nhất được tổng hợp riêng để thấy phần ngoài tầm phủ.',
                formula:
                  'Δ Dư nợ = curr − prev · NQH% = duNoQuaHan / tongDuNo · NK% = duNoKhoanh / tongDuNo (Δ tính theo điểm %)',
                note: 'Bấm vào một dòng để mở Bảng khế ước biến động đã lọc theo ĐGD đó.',
              }}
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            disabled={points.length === 0}
            title="Xuất bảng xếp hạng ĐGD ra Excel"
          >
            <Download className="h-3.5 w-3.5" /> Xuất Excel
          </Button>
        </div>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Đối chiếu khối lượng & chất lượng tín dụng từng Điểm giao dịch giữa hai kỳ. Bấm tiêu đề
          cột để sắp xếp; bấm 1 dòng để mở Bảng khế ước biến động đã lọc theo ĐGD đó.
        </p>
      </header>

      <Card>
        <CardContent className="py-3">
          <FilterBar useStore={usePeriodFilterStore} accent="period" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryChip
          label="ĐGD"
          value={points.length.toLocaleString('vi-VN')}
          tone="neutral"
        />
        <SummaryChip
          label="Dư nợ phủ ĐGD (kỳ sau)"
          value={fmtCompact(coveredCurrTongDuNo)}
          subValue={fmtPercent(coveragePct)}
          tone="ok"
        />
        <SummaryChip
          label="Dư nợ chưa phủ"
          value={fmtCompact(computed.unassigned.currTongDuNo)}
          subValue={`${fmtNumber(computed.unassigned.currLoans)} KƯ`}
          tone={computed.unassigned.currTongDuNo > 0 ? 'warn' : 'ok'}
        />
        <SummaryChip
          label="Dư nợ trùng ĐGD"
          value={fmtCompact(computed.ambiguous.currTongDuNo)}
          subValue={`${fmtNumber(computed.ambiguous.currLoans)} KƯ`}
          tone={computed.ambiguous.currTongDuNo > 0 ? 'warn' : 'ok'}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm ĐGD theo Mã / Tên..."
            className="h-8 w-72 rounded-md border border-slate-200 bg-white pl-7 pr-3 text-xs text-slate-700 outline-none focus:border-period-400 focus:ring-1 focus:ring-period-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          />
        </div>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {visibleRows.length} / {points.length} ĐGD
        </span>
      </div>

      <Card>
        <CardHeader className="py-2">
          <CardTitle>Bảng xếp hạng</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <Th label="Điểm giao dịch" sortKey="tenDGD" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                  <th className="px-3 py-2 text-right font-semibold">Phụ trách</th>
                  <th className="px-3 py-2 text-right font-semibold">Khế ước</th>
                  <Th label="Dư nợ kỳ sau" sortKey="currTongDuNo" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                  <Th label="Δ Dư nợ" sortKey="deltaTongDuNo" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                  <Th label="% Δ" sortKey="pctTongDuNo" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                  <Th label="Dư nợ NQH" sortKey="currDuNoQH" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                  <Th label="NQH%" sortKey="deltaTyLeNQH" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                  <Th label="Dư nợ khoanh" sortKey="currDuNoKhoanh" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                  <Th label="NK%" sortKey="deltaTyLeKhoanh" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                  <Th label="Mới" sortKey="newLoans" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                  <Th label="Đóng" sortKey="closedLoans" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-6 text-center text-slate-400">
                      Không có ĐGD phù hợp.
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((r) => (
                    <PointRow key={r.point.id} row={r} onDrill={() => handleDrill(r.point)} />
                  ))
                )}
              </tbody>
              {(computed.unassigned.currLoans > 0 || computed.ambiguous.currLoans > 0) && (
                <tfoot className="bg-slate-50/80 dark:bg-slate-800/40">
                  {computed.unassigned.currLoans > 0 && (
                    <SummaryRow label="(Chưa gán ĐGD)" data={computed.unassigned} muted />
                  )}
                  {computed.ambiguous.currLoans > 0 && (
                    <SummaryRow label="(Nhiều ĐGD)" data={computed.ambiguous} muted />
                  )}
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PointRow({ row, onDrill }: { row: PointSlice; onDrill: () => void }) {
  return (
    <tr
      className="cursor-pointer hover:bg-period-50/40 dark:hover:bg-period-900/10"
      onClick={onDrill}
      title="Bấm để mở Bảng khế ước biến động đã lọc theo ĐGD"
    >
      <td className="px-3 py-2">
        <div className="font-mono text-[11px] text-slate-500">{row.point.maDGD}</div>
        <div className="font-medium text-slate-800 dark:text-slate-100">{row.point.tenDGD}</div>
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right text-slate-700 dark:text-slate-200">
        {row.thonCount} thôn
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right text-slate-700 dark:text-slate-200">
        {fmtNumber(row.currLoans)}
        <div className="text-[11px] text-slate-500 dark:text-slate-400">
          {fmtNumber(row.currCustomers)} KH
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-slate-800 dark:text-slate-100">
        {fmtCompact(row.currTongDuNo)}
      </td>
      <td
        className={cn(
          'whitespace-nowrap px-3 py-2 text-right font-medium',
          row.deltaTongDuNo > 0
            ? 'text-emerald-700 dark:text-emerald-400'
            : row.deltaTongDuNo < 0
              ? 'text-rose-700 dark:text-rose-400'
              : 'text-slate-500'
        )}
      >
        {row.deltaTongDuNo > 0 ? '+' : ''}
        {fmtCompact(row.deltaTongDuNo)}
      </td>
      <td
        className={cn(
          'whitespace-nowrap px-3 py-2 text-right text-[11px] font-medium',
          row.pctTongDuNo == null
            ? 'text-slate-400'
            : row.pctTongDuNo > 0
              ? 'text-emerald-700 dark:text-emerald-400'
              : row.pctTongDuNo < 0
                ? 'text-rose-700 dark:text-rose-400'
                : 'text-slate-500'
        )}
      >
        {row.pctTongDuNo == null ? '—' : `${row.pctTongDuNo > 0 ? '+' : ''}${fmtPercent(row.pctTongDuNo)}`}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right">
        <div
          className={cn(
            'font-semibold',
            row.currDuNoQH > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-500'
          )}
        >
          {fmtCompact(row.currDuNoQH)}
        </div>
        <div
          className={cn(
            'text-[11px] font-medium',
            row.currDuNoQH - row.prevDuNoQH > 0
              ? 'text-rose-700 dark:text-rose-400'
              : row.currDuNoQH - row.prevDuNoQH < 0
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-slate-500'
          )}
        >
          {row.currDuNoQH - row.prevDuNoQH > 0 ? '+' : ''}
          {fmtCompact(row.currDuNoQH - row.prevDuNoQH)}
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right text-slate-700 dark:text-slate-200">
        {fmtPercent(row.currTyLeNQH)}
        <div
          className={cn(
            'text-[11px] font-medium',
            row.deltaTyLeNQH > 0
              ? 'text-rose-700 dark:text-rose-400'
              : row.deltaTyLeNQH < 0
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-slate-500'
          )}
        >
          {row.deltaTyLeNQH > 0 ? '+' : ''}
          {row.deltaTyLeNQH.toFixed(2)} pp
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right">
        <div
          className={cn(
            'font-semibold',
            row.currDuNoKhoanh > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500'
          )}
        >
          {fmtCompact(row.currDuNoKhoanh)}
        </div>
        <div
          className={cn(
            'text-[11px] font-medium',
            row.currDuNoKhoanh - row.prevDuNoKhoanh > 0
              ? 'text-rose-700 dark:text-rose-400'
              : row.currDuNoKhoanh - row.prevDuNoKhoanh < 0
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-slate-500'
          )}
        >
          {row.currDuNoKhoanh - row.prevDuNoKhoanh > 0 ? '+' : ''}
          {fmtCompact(row.currDuNoKhoanh - row.prevDuNoKhoanh)}
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right text-slate-700 dark:text-slate-200">
        {fmtPercent(row.currTyLeKhoanh)}
        <div
          className={cn(
            'text-[11px] font-medium',
            row.deltaTyLeKhoanh > 0
              ? 'text-rose-700 dark:text-rose-400'
              : row.deltaTyLeKhoanh < 0
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-slate-500'
          )}
        >
          {row.deltaTyLeKhoanh > 0 ? '+' : ''}
          {row.deltaTyLeKhoanh.toFixed(2)} pp
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right text-emerald-700 dark:text-emerald-400">
        {row.newLoans > 0 ? `+${fmtNumber(row.newLoans)}` : '0'}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right text-slate-600 dark:text-slate-400">
        {row.closedLoans > 0 ? `−${fmtNumber(row.closedLoans)}` : '0'}
      </td>
    </tr>
  );
}

function SummaryRow({
  label,
  data,
  muted,
}: {
  label: string;
  data: Omit<PointSlice, 'point' | 'thonCount'>;
  muted?: boolean;
}) {
  return (
    <tr className={cn('text-xs', muted && 'text-slate-500 dark:text-slate-400')}>
      <td className="px-3 py-2 font-semibold italic">{label}</td>
      <td className="px-3 py-2 text-right">—</td>
      <td className="px-3 py-2 text-right">{fmtNumber(data.currLoans)}</td>
      <td className="px-3 py-2 text-right">{fmtCompact(data.currTongDuNo)}</td>
      <td className="px-3 py-2 text-right">
        {data.deltaTongDuNo > 0 ? '+' : ''}
        {fmtCompact(data.deltaTongDuNo)}
      </td>
      <td className="px-3 py-2 text-right">
        {data.pctTongDuNo == null ? '—' : `${data.pctTongDuNo > 0 ? '+' : ''}${fmtPercent(data.pctTongDuNo)}`}
      </td>
      <td className="px-3 py-2 text-right">{fmtCompact(data.currDuNoQH)}</td>
      <td className="px-3 py-2 text-right">{fmtPercent(data.currTyLeNQH)}</td>
      <td className="px-3 py-2 text-right">{fmtCompact(data.currDuNoKhoanh)}</td>
      <td className="px-3 py-2 text-right">{fmtPercent(data.currTyLeKhoanh)}</td>
      <td className="px-3 py-2 text-right">+{fmtNumber(data.newLoans)}</td>
      <td className="px-3 py-2 text-right">−{fmtNumber(data.closedLoans)}</td>
    </tr>
  );
}

function Th({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align = 'left',
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: 'asc' | 'desc';
  onSort: (k: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const isActive = sortKey === activeKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={cn(
        'cursor-pointer select-none px-3 py-2 font-semibold hover:text-slate-700 dark:hover:text-slate-200',
        align === 'right' ? 'text-right' : 'text-left'
      )}
    >
      <span className={cn('inline-flex items-center gap-1', align === 'right' && 'flex-row-reverse')}>
        {label}
        {isActive ? (
          dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowDownUp className="h-3 w-3 opacity-40" />
        )}
      </span>
    </th>
  );
}

function SummaryChip({
  label,
  value,
  subValue,
  tone,
}: {
  label: string;
  value: string;
  subValue?: string;
  tone: 'ok' | 'warn' | 'neutral';
}) {
  const toneClass =
    tone === 'ok'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200'
        : 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200';
  return (
    <div className={cn('rounded-md border px-3 py-2', toneClass)}>
      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-0.5 text-lg font-bold leading-tight">{value}</div>
      {subValue && <div className="text-[11px] opacity-70">{subValue}</div>}
    </div>
  );
}
