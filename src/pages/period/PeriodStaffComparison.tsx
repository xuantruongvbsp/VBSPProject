import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  Download,
  Search,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FilterBar } from '@/components/filters/FilterBar';
import { InfoPopover } from '@/components/ui/InfoPopover';
import { usePeriodFilterStore } from '@/store/usePeriodFilterStore';
import { usePeriodStore } from '@/store/usePeriodStore';
import { useStaffStore } from '@/store/useStaffStore';
import { useTxnPointStore } from '@/store/useTxnPointStore';
import { usePeriodCompare } from './usePeriodCompare';
import { deriveStatus, type JoinedLoan } from '@/lib/period-compare';
import {
  exportStaffComparisonToXlsx,
  type StaffComparisonXlsxRow,
} from '@/lib/export-xlsx';
import { fmtCompact, fmtDate, fmtNumber, fmtPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { StaffRecord } from '@/lib/types';

type SortKey =
  | 'tenNV'
  | 'currTongDuNo'
  | 'deltaTongDuNo'
  | 'pctTongDuNo'
  | 'currDuNoQH'
  | 'deltaTyLeNQH'
  | 'rollRate'
  | 'newLoans'
  | 'closedLoans';

interface StaffSlice {
  staff: StaffRecord;
  thonCount: number;
  dgdCount: number;

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
  deltaTyLeNQH: number; // điểm phần trăm

  // Roll rate (TH → QH trong kỳ sau / base TH kỳ trước)
  baseTrongHanT1: number;
  rollNumerator: number;
  rollRate: number;
}

const NUMERIC_KEYS: SortKey[] = [
  'currTongDuNo',
  'deltaTongDuNo',
  'pctTongDuNo',
  'currDuNoQH',
  'deltaTyLeNQH',
  'rollRate',
  'newLoans',
  'closedLoans',
];

/**
 * Trang "So sánh hiệu quả cán bộ" — bảng xếp hạng các cán bộ tín dụng
 * giữa kỳ trước và kỳ sau. Phạm vi từng cán bộ = hợp Mã thôn của các
 * Điểm giao dịch họ phụ trách. Khế ước thuộc thôn không có cán bộ duy
 * nhất được tổng hợp riêng (Chưa gán / Nhiều cán bộ) để thấy phần ngoài
 * tầm phủ.
 */
export function PeriodStaffComparisonPage() {
  const navigate = useNavigate();
  const setPendingDrill = usePeriodStore((s) => s.setPendingDrill);
  const selectStaff = useStaffStore((s) => s.selectStaff);

  const { hasData, loanJoin, prevDate, currDate } = usePeriodCompare();
  const staff = useStaffStore((s) => s.staff);
  const points = useTxnPointStore((s) => s.points);

  // Mapping: maThon → danh sách staff.id phụ trách
  const thonToStaffIds = useMemo(() => {
    const dgdToStaff = new Map<string, string[]>();
    for (const s of staff) {
      for (const maDGD of s.maDGDs) {
        const list = dgdToStaff.get(maDGD);
        if (list) list.push(s.id);
        else dgdToStaff.set(maDGD, [s.id]);
      }
    }
    const map = new Map<string, string[]>();
    for (const p of points) {
      const owners = dgdToStaff.get(p.maDGD) ?? [];
      if (owners.length === 0) continue;
      for (const t of p.maThons) {
        const list = map.get(t);
        if (list) {
          for (const o of owners) if (!list.includes(o)) list.push(o);
        } else {
          map.set(t, [...owners]);
        }
      }
    }
    return map;
  }, [staff, points]);

  // Mỗi staff: số ĐGD + số thôn duy nhất
  const staffShape = useMemo(() => {
    const m = new Map<string, { dgdCount: number; thonCount: number }>();
    for (const s of staff) {
      const set = new Set<string>();
      for (const maDGD of s.maDGDs) {
        const p = points.find((x) => x.maDGD === maDGD);
        if (!p) continue;
        for (const t of p.maThons) set.add(t);
      }
      m.set(s.id, { dgdCount: s.maDGDs.length, thonCount: set.size });
    }
    return m;
  }, [staff, points]);

  // Tính slice từng cán bộ + 2 nhóm phụ
  const computed = useMemo(() => {
    const empty = (): Omit<StaffSlice, 'staff' | 'thonCount' | 'dgdCount'> => ({
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
      baseTrongHanT1: 0,
      rollNumerator: 0,
      rollRate: 0,
    });
    type Bucket = ReturnType<typeof empty> & {
      prevCustSet: Set<string>;
      currCustSet: Set<string>;
    };
    const newBucket = (): Bucket => ({ ...empty(), prevCustSet: new Set(), currCustSet: new Set() });

    const slices = new Map<string, Bucket>();
    for (const s of staff) slices.set(s.id, newBucket());
    const unassigned = newBucket();
    const ambiguous = newBucket();

    const route = (j: JoinedLoan): Bucket => {
      const r = j.curr ?? j.prev;
      if (!r) return unassigned;
      const owners = thonToStaffIds.get(r.maThon ?? '') ?? [];
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
        if (j.prev.maKH) b.prevCustSet.add(j.prev.maKH);
        if (deriveStatus(j.prev) === 'th') {
          b.baseTrongHanT1 += j.prev.duNoTrongHan;
          if (j.curr) b.rollNumerator += j.curr.duNoQuaHan;
        }
      }
      if (j.curr) {
        b.currLoans += 1;
        b.currTongDuNo += j.curr.tongDuNo;
        b.currDuNoQH += j.curr.duNoQuaHan;
        if (j.curr.maKH) b.currCustSet.add(j.curr.maKH);
      }
      if (j.bucket === 'new') b.newLoans += 1;
      if (j.bucket === 'closed') b.closedLoans += 1;
    }

    const finalize = (b: Bucket): Omit<StaffSlice, 'staff' | 'thonCount' | 'dgdCount'> => ({
      prevLoans: b.prevLoans,
      currLoans: b.currLoans,
      newLoans: b.newLoans,
      closedLoans: b.closedLoans,
      prevCustomers: b.prevCustSet.size,
      currCustomers: b.currCustSet.size,
      prevTongDuNo: b.prevTongDuNo,
      currTongDuNo: b.currTongDuNo,
      deltaTongDuNo: b.currTongDuNo - b.prevTongDuNo,
      // Tất cả tỷ lệ lưu dạng phần trăm (đã ×100) — đồng bộ với
      // computeKpi/groupBy/Khoanh.tsx, fmtPercent chỉ thêm '%'.
      pctTongDuNo:
        b.prevTongDuNo > 0 ? ((b.currTongDuNo - b.prevTongDuNo) / b.prevTongDuNo) * 100 : null,
      prevDuNoQH: b.prevDuNoQH,
      currDuNoQH: b.currDuNoQH,
      prevTyLeNQH: b.prevTongDuNo > 0 ? (b.prevDuNoQH / b.prevTongDuNo) * 100 : 0,
      currTyLeNQH: b.currTongDuNo > 0 ? (b.currDuNoQH / b.currTongDuNo) * 100 : 0,
      deltaTyLeNQH:
        (b.currTongDuNo > 0 ? (b.currDuNoQH / b.currTongDuNo) * 100 : 0) -
        (b.prevTongDuNo > 0 ? (b.prevDuNoQH / b.prevTongDuNo) * 100 : 0),
      baseTrongHanT1: b.baseTrongHanT1,
      rollNumerator: b.rollNumerator,
      rollRate: b.baseTrongHanT1 > 0 ? (b.rollNumerator / b.baseTrongHanT1) * 100 : 0,
    });

    const rows: StaffSlice[] = staff.map((s) => {
      const b = slices.get(s.id)!;
      const shape = staffShape.get(s.id);
      return {
        staff: s,
        thonCount: shape?.thonCount ?? 0,
        dgdCount: shape?.dgdCount ?? 0,
        ...finalize(b),
      };
    });

    return {
      rows,
      unassigned: finalize(unassigned),
      ambiguous: finalize(ambiguous),
    };
  }, [loanJoin, staff, thonToStaffIds, staffShape]);

  // Sort + search
  const [sortKey, setSortKey] = useState<SortKey>('deltaTongDuNo');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = computed.rows;
    if (q) {
      arr = arr.filter(
        (r) =>
          r.staff.maNV.toLowerCase().includes(q) ||
          r.staff.tenNV.toLowerCase().includes(q)
      );
    }
    arr = [...arr].sort((a, b) => {
      const av = sortKey === 'tenNV' ? a.staff.tenNV : (a as any)[sortKey];
      const bv = sortKey === 'tenNV' ? b.staff.tenNV : (b as any)[sortKey];
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

  function handleDrill(s: StaffRecord) {
    selectStaff(s.id);
    setPendingDrill({ to: '/period/khe-uoc' });
    navigate('/period/khe-uoc');
  }

  async function handleExport() {
    const exportRows = computed.rows.map((r) => ({
      maNV: r.staff.maNV,
      tenNV: r.staff.tenNV,
      dgdCount: r.dgdCount,
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
      rollRate: r.rollRate,
      newLoans: r.newLoans,
      closedLoans: r.closedLoans,
    }));
    type SummaryData = Omit<StaffComparisonXlsxRow, 'maNV' | 'tenNV' | 'dgdCount' | 'thonCount'>;
    const summaryRows: { label: string; data: SummaryData }[] = [];
    if (computed.unassigned.currLoans > 0 || computed.unassigned.prevLoans > 0) {
      summaryRows.push({ label: '(Chưa gán cán bộ)', data: computed.unassigned });
    }
    if (computed.ambiguous.currLoans > 0 || computed.ambiguous.prevLoans > 0) {
      summaryRows.push({ label: '(Nhiều cán bộ phụ trách)', data: computed.ambiguous });
    }
    await exportStaffComparisonToXlsx({
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

  if (staff.length === 0 || points.length === 0) {
    return (
      <div className="space-y-4 p-6">
        <header>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            So sánh hiệu quả cán bộ
          </h1>
        </header>
        <Card>
          <CardContent className="py-6 text-sm text-slate-600 dark:text-slate-300">
            {staff.length === 0
              ? 'Chưa có cán bộ trong danh mục — hãy thêm ở /snapshot/can-bo trước.'
              : 'Chưa có Điểm giao dịch trong danh mục — hãy thêm ở /snapshot/diem-giao-dich trước.'}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tổng hợp tổng dư nợ phủ / không phủ
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
            <Users className="h-6 w-6 text-period-700 dark:text-period-300" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              So sánh hiệu quả cán bộ
            </h1>
            <InfoPopover
              explanation={{
                title: 'So sánh hiệu quả cán bộ tín dụng',
                definition:
                  'Bảng xếp hạng các cán bộ giữa kỳ trước và kỳ sau. Phạm vi mỗi cán bộ là hợp các Mã thôn của các Điểm giao dịch họ phụ trách (cấu hình ở danh mục Cán bộ + ĐGD). Khế ước thuộc thôn chưa có cán bộ duy nhất được tổng hợp riêng để thấy phần ngoài tầm phủ.',
                formula:
                  'Δ Dư nợ = curr − prev · NQH% = duNoQuaHan / tongDuNo · Roll rate = (Σ duNoQuaHan kỳ sau của khế ước Trong hạn ở kỳ trước) / (Σ duNoTrongHan kỳ trước)',
                note: 'Bấm vào một dòng để mở Bảng khế ước biến động đã lọc theo cán bộ đó.',
              }}
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            disabled={staff.length === 0}
            title="Xuất bảng xếp hạng cán bộ ra Excel"
          >
            <Download className="h-3.5 w-3.5" /> Xuất Excel
          </Button>
        </div>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Đối chiếu khối lượng & chất lượng tín dụng từng cán bộ giữa hai kỳ. Bấm tiêu đề cột để
          sắp xếp; bấm 1 dòng để mở Bảng khế ước biến động đã lọc theo cán bộ đó.
        </p>
      </header>

      <Card>
        <CardContent className="py-3">
          <FilterBar useStore={usePeriodFilterStore} accent="period" />
        </CardContent>
      </Card>

      {/* Tổng quan phủ cán bộ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryChip
          label="Cán bộ"
          value={staff.length.toLocaleString('vi-VN')}
          tone="neutral"
        />
        <SummaryChip
          label="Dư nợ phủ cán bộ (kỳ sau)"
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
          label="Dư nợ trùng cán bộ"
          value={fmtCompact(computed.ambiguous.currTongDuNo)}
          subValue={`${fmtNumber(computed.ambiguous.currLoans)} KƯ`}
          tone={computed.ambiguous.currTongDuNo > 0 ? 'warn' : 'ok'}
        />
      </div>

      {/* Search + sort hint */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm cán bộ theo Mã NV / Tên..."
            className="h-8 w-72 rounded-md border border-slate-200 bg-white pl-7 pr-3 text-xs text-slate-700 outline-none focus:border-period-400 focus:ring-1 focus:ring-period-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          />
        </div>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {visibleRows.length} / {staff.length} cán bộ
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
                  <Th
                    label="Cán bộ"
                    sortKey="tenNV"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <th className="px-3 py-2 text-right font-semibold">Phụ trách</th>
                  <th className="px-3 py-2 text-right font-semibold">Khế ước</th>
                  <Th
                    label="Dư nợ kỳ sau"
                    sortKey="currTongDuNo"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                    align="right"
                  />
                  <Th
                    label="Δ Dư nợ"
                    sortKey="deltaTongDuNo"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                    align="right"
                  />
                  <Th
                    label="% Δ"
                    sortKey="pctTongDuNo"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                    align="right"
                  />
                  <Th
                    label="Dư nợ NQH"
                    sortKey="currDuNoQH"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                    align="right"
                  />
                  <Th
                    label="NQH%"
                    sortKey="deltaTyLeNQH"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                    align="right"
                  />
                  <Th
                    label="Roll rate"
                    sortKey="rollRate"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                    align="right"
                  />
                  <Th
                    label="Mới"
                    sortKey="newLoans"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                    align="right"
                  />
                  <Th
                    label="Đóng"
                    sortKey="closedLoans"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                    align="right"
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-6 text-center text-slate-400">
                      Không có cán bộ phù hợp.
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((r) => (
                    <StaffRow key={r.staff.id} row={r} onDrill={() => handleDrill(r.staff)} />
                  ))
                )}
              </tbody>
              {(computed.unassigned.currLoans > 0 || computed.ambiguous.currLoans > 0) && (
                <tfoot className="bg-slate-50/80 dark:bg-slate-800/40">
                  {computed.unassigned.currLoans > 0 && (
                    <SummaryRow label="(Chưa gán cán bộ)" data={computed.unassigned} muted />
                  )}
                  {computed.ambiguous.currLoans > 0 && (
                    <SummaryRow label="(Nhiều cán bộ phụ trách)" data={computed.ambiguous} muted />
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

function StaffRow({ row, onDrill }: { row: StaffSlice; onDrill: () => void }) {
  return (
    <tr
      className="cursor-pointer hover:bg-period-50/40 dark:hover:bg-period-900/10"
      onClick={onDrill}
      title="Bấm để mở Bảng khế ước biến động đã lọc theo cán bộ"
    >
      <td className="px-3 py-2">
        <div className="font-mono text-[11px] text-slate-500">{row.staff.maNV}</div>
        <div className="font-medium text-slate-800 dark:text-slate-100">{row.staff.tenNV}</div>
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right text-slate-700 dark:text-slate-200">
        {row.dgdCount} ĐGD
        <div className="text-[11px] text-slate-500 dark:text-slate-400">{row.thonCount} thôn</div>
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
            row.currDuNoQH > 0
              ? 'text-rose-700 dark:text-rose-400'
              : 'text-slate-500'
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
      <td
        className={cn(
          'whitespace-nowrap px-3 py-2 text-right',
          row.rollRate > 2
            ? 'font-semibold text-rose-700 dark:text-rose-400'
            : 'text-slate-700 dark:text-slate-200'
        )}
      >
        {fmtPercent(row.rollRate)}
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
  data: Omit<StaffSlice, 'staff' | 'thonCount' | 'dgdCount'>;
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
      <td className="px-3 py-2 text-right">{fmtPercent(data.rollRate)}</td>
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
          dir === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
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
