import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  Download,
  Search,
  UserCheck,
  BarChart3,
  AlignLeft,
  LayoutGrid,
  PieChart as PieIcon,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  Treemap,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FilterBar } from '@/components/filters/FilterBar';
import { ChartSwitcher, type ChartTypeOption } from '@/components/ui/ChartSwitcher';
import { applyFilters, useDataStore } from '@/store/useDataStore';
import { useStaffStore } from '@/store/useStaffStore';
import { useTxnPointStore } from '@/store/useTxnPointStore';
import { buildThonCoverage } from '@/lib/thon-coverage';
import {
  exportPerformanceToXlsx,
  type PerformanceXlsxRow,
} from '@/lib/export-xlsx';
import { fmtCompact, fmtNumber, fmtPercent } from '@/lib/format';
import { useChartColors } from '@/lib/useChartColors';
import { cn } from '@/lib/utils';
import type { LoanRecord, StaffRecord } from '@/lib/types';

type AbsChartType = 'bar' | 'donut' | 'treemap';

const ABS_CHART_OPTS: ChartTypeOption<AbsChartType>[] = [
  { id: 'bar', icon: AlignLeft, tooltip: 'Biểu đồ thanh' },
  { id: 'donut', icon: PieIcon, tooltip: 'Biểu đồ vòng' },
  { id: 'treemap', icon: LayoutGrid, tooltip: 'Bản đồ cây' },
];

type SortKey =
  | 'tenNV'
  | 'soKheUoc'
  | 'soKhachHang'
  | 'tongDuNo'
  | 'duNoQuaHan'
  | 'tyLeNQH'
  | 'duNoKhoanh'
  | 'tyLeKhoanh'
  | 'mucVayBQ'
  | 'laiTonTH';

interface StaffSlice {
  staff: StaffRecord;
  dgdCount: number;
  thonCount: number;

  soKheUoc: number;
  soKhachHang: number;
  tongDuNo: number;
  duNoTrongHan: number;
  duNoQuaHan: number;
  tyLeNQH: number;
  duNoKhoanh: number;
  tyLeKhoanh: number;
  mucVayBQ: number;
  laiTonTH: number;
}

const NUMERIC_KEYS: SortKey[] = [
  'soKheUoc',
  'soKhachHang',
  'tongDuNo',
  'duNoQuaHan',
  'tyLeNQH',
  'duNoKhoanh',
  'tyLeKhoanh',
  'mucVayBQ',
  'laiTonTH',
];

/**
 * Trang "Báo cáo hiệu quả cán bộ" — chế độ snapshot 1 kỳ.
 * Phạm vi mỗi cán bộ = hợp các Mã thôn của các ĐGD họ phụ trách.
 * Bấm 1 dòng để mở Tra cứu chi tiết đã lọc theo cán bộ đó.
 */
export function StaffPerformancePage() {
  const navigate = useNavigate();
  const rows = useDataStore((s) => s.rows);
  const filters = useDataStore((s) => s.filters);
  const ranges = useDataStore((s) => s.ranges);
  const search = useDataStore((s) => s.search);
  const ngaySoLieu = useDataStore((s) => s.ngaySoLieu);
  const staff = useStaffStore((s) => s.staff);
  const selectStaff = useStaffStore((s) => s.selectStaff);
  const points = useTxnPointStore((s) => s.points);

  const filtered = useMemo(
    () => applyFilters(rows, filters, ranges, search),
    [rows, filters, ranges, search]
  );

  const { thonToStaffIds } = useMemo(
    () => buildThonCoverage(staff, points),
    [staff, points]
  );

  // Số ĐGD + số thôn cho từng cán bộ
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

  const computed = useMemo(() => {
    type Bucket = {
      soKheUoc: number;
      tongDuNo: number;
      duNoTrongHan: number;
      duNoQuaHan: number;
      duNoKhoanh: number;
      laiTonTH: number;
      kh: Set<string>;
    };
    const newBucket = (): Bucket => ({
      soKheUoc: 0,
      tongDuNo: 0,
      duNoTrongHan: 0,
      duNoQuaHan: 0,
      duNoKhoanh: 0,
      laiTonTH: 0,
      kh: new Set(),
    });

    const slices = new Map<string, Bucket>();
    for (const s of staff) slices.set(s.id, newBucket());
    const unassigned = newBucket();
    const ambiguous = newBucket();

    const route = (r: LoanRecord): Bucket => {
      const owners = thonToStaffIds.get(r.maThon ?? '') ?? [];
      if (owners.length === 0) return unassigned;
      if (owners.length > 1) return ambiguous;
      return slices.get(owners[0]) ?? unassigned;
    };

    for (const r of filtered) {
      const b = route(r);
      b.soKheUoc += 1;
      b.tongDuNo += r.tongDuNo;
      b.duNoTrongHan += r.duNoTrongHan;
      b.duNoQuaHan += r.duNoQuaHan;
      b.duNoKhoanh += r.duNoKhoanh;
      b.laiTonTH += r.laiTonTH;
      if (r.maKH) b.kh.add(r.maKH);
    }

    const finalize = (b: Bucket): Omit<StaffSlice, 'staff' | 'dgdCount' | 'thonCount'> => ({
      soKheUoc: b.soKheUoc,
      soKhachHang: b.kh.size,
      tongDuNo: b.tongDuNo,
      duNoTrongHan: b.duNoTrongHan,
      duNoQuaHan: b.duNoQuaHan,
      // Convention codebase: tyLe* lưu dạng phần trăm (đã ×100), fmtPercent chỉ thêm '%'.
      tyLeNQH: b.tongDuNo > 0 ? (b.duNoQuaHan / b.tongDuNo) * 100 : 0,
      duNoKhoanh: b.duNoKhoanh,
      tyLeKhoanh: b.tongDuNo > 0 ? (b.duNoKhoanh / b.tongDuNo) * 100 : 0,
      mucVayBQ: b.kh.size > 0 ? b.tongDuNo / b.kh.size : 0,
      laiTonTH: b.laiTonTH,
    });

    const rows: StaffSlice[] = staff.map((s) => {
      const b = slices.get(s.id)!;
      const shape = staffShape.get(s.id);
      return {
        staff: s,
        dgdCount: shape?.dgdCount ?? 0,
        thonCount: shape?.thonCount ?? 0,
        ...finalize(b),
      };
    });
    return {
      rows,
      unassigned: finalize(unassigned),
      ambiguous: finalize(ambiguous),
    };
  }, [filtered, staff, thonToStaffIds, staffShape]);

  const [sortKey, setSortKey] = useState<SortKey>('tongDuNo');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  // Loại biểu đồ chia sẻ cho 3 chỉ tiêu tuyệt đối (KƯ / KH / Tổng dư nợ).
  // 2 chỉ tiêu tỷ lệ (NQH%, Khoanh%) luôn là bar.
  const [absChartType, setAbsChartType] = useState<AbsChartType>('bar');

  const visibleRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let arr = computed.rows;
    if (q) {
      arr = arr.filter(
        (r) =>
          r.staff.maNV.toLowerCase().includes(q) ||
          r.staff.tenNV.toLowerCase().includes(q)
      );
    }
    arr = [...arr].sort((a, b) => {
      const av = sortKey === 'tenNV' ? a.staff.tenNV : (a as unknown as Record<string, unknown>)[sortKey];
      const bv = sortKey === 'tenNV' ? b.staff.tenNV : (b as unknown as Record<string, unknown>)[sortKey];
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv, 'vi') : bv.localeCompare(av, 'vi');
      }
      const an = (av ?? 0) as number;
      const bn = (bv ?? 0) as number;
      return sortDir === 'asc' ? an - bn : bn - an;
    });
    return arr;
  }, [computed.rows, sortKey, sortDir, searchQuery]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(k);
      setSortDir(NUMERIC_KEYS.includes(k) ? 'desc' : 'asc');
    }
  }

  function handleDrill(s: StaffRecord) {
    selectStaff(s.id);
    navigate('/snapshot/du-lieu');
  }

  async function handleExport() {
    const exportRows: PerformanceXlsxRow[] = computed.rows.map((r) => ({
      keyCode: r.staff.maNV,
      keyLabel: r.staff.tenNV,
      dgdCount: r.dgdCount,
      thonCount: r.thonCount,
      soKheUoc: r.soKheUoc,
      soKhachHang: r.soKhachHang,
      tongDuNo: r.tongDuNo,
      duNoTrongHan: r.duNoTrongHan,
      duNoQuaHan: r.duNoQuaHan,
      tyLeNQH: r.tyLeNQH,
      duNoKhoanh: r.duNoKhoanh,
      tyLeKhoanh: r.tyLeKhoanh,
      mucVayBQ: r.mucVayBQ,
      laiTonTH: r.laiTonTH,
    }));

    type SummaryData = Omit<PerformanceXlsxRow, 'keyCode' | 'keyLabel' | 'dgdCount' | 'thonCount'>;
    const summaryRows: { label: string; data: SummaryData }[] = [];
    if (computed.unassigned.soKheUoc > 0) {
      summaryRows.push({ label: '(Chưa gán cán bộ)', data: computed.unassigned });
    }
    if (computed.ambiguous.soKheUoc > 0) {
      summaryRows.push({ label: '(Nhiều cán bộ phụ trách)', data: computed.ambiguous });
    }

    await exportPerformanceToXlsx({
      kind: 'staff',
      rows: exportRows,
      summaryRows,
      referenceDate: ngaySoLieu,
    });
  }

  if (staff.length === 0 || points.length === 0) {
    return (
      <div className="space-y-4 p-6">
        <header>
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-slate-100">
            <UserCheck className="h-5 w-5 text-brand-700 dark:text-brand-300" />
            Báo cáo hiệu quả cán bộ
          </h2>
        </header>
        <Card>
          <CardContent className="py-6 text-sm text-slate-600 dark:text-slate-300">
            {staff.length === 0
              ? 'Chưa có cán bộ trong danh mục.'
              : 'Chưa có Điểm giao dịch — phạm vi cán bộ phụ thuộc vào ĐGD.'}
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalTongDuNo =
    computed.rows.reduce((s, r) => s + r.tongDuNo, 0) +
    computed.unassigned.tongDuNo +
    computed.ambiguous.tongDuNo;
  const coveredTongDuNo = computed.rows.reduce((s, r) => s + r.tongDuNo, 0);
  const coveragePct = totalTongDuNo > 0 ? coveredTongDuNo / totalTongDuNo : 0;

  return (
    <div className="space-y-4 p-6">
      <header>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <UserCheck className="h-6 w-6 text-brand-700 dark:text-brand-300" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Báo cáo hiệu quả cán bộ
            </h2>
          </div>
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" /> Xuất Excel
          </Button>
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Bảng KPI từng cán bộ tại 1 kỳ. Phạm vi cán bộ = hợp các Mã thôn của các ĐGD họ phụ trách.
          Bấm 1 dòng để mở Tra cứu chi tiết đã lọc theo cán bộ.
        </p>
      </header>

      <Card>
        <CardContent className="py-3">
          <FilterBar />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryChip label="Cán bộ" value={fmtNumber(staff.length)} tone="neutral" />
        <SummaryChip
          label="Dư nợ phủ cán bộ"
          value={fmtCompact(coveredTongDuNo)}
          subValue={fmtPercent(coveragePct)}
          tone="ok"
        />
        <SummaryChip
          label="Dư nợ chưa phủ"
          value={fmtCompact(computed.unassigned.tongDuNo)}
          subValue={`${fmtNumber(computed.unassigned.soKheUoc)} KƯ`}
          tone={computed.unassigned.tongDuNo > 0 ? 'warn' : 'ok'}
        />
        <SummaryChip
          label="Dư nợ trùng cán bộ"
          value={fmtCompact(computed.ambiguous.tongDuNo)}
          subValue={`${fmtNumber(computed.ambiguous.soKheUoc)} KƯ`}
          tone={computed.ambiguous.tongDuNo > 0 ? 'warn' : 'ok'}
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between py-2">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-brand-700 dark:text-brand-300" />
            Top cán bộ theo từng chỉ tiêu
          </CardTitle>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-normal normal-case text-slate-500 dark:text-slate-400">
              Top 10 · bấm để mở Tra cứu chi tiết
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                3 chỉ tiêu tuyệt đối
              </span>
              <ChartSwitcher
                options={ABS_CHART_OPTS}
                value={absChartType}
                onChange={setAbsChartType}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <RankingChart
              title="Số khế ước (KƯ)"
              rows={computed.rows}
              metric="soKheUoc"
              fmt={fmtNumber}
              onDrill={handleDrill}
              chartType={absChartType}
            />
            <RankingChart
              title="Số khách hàng (KH)"
              rows={computed.rows}
              metric="soKhachHang"
              fmt={fmtNumber}
              onDrill={handleDrill}
              chartType={absChartType}
            />
            <RankingChart
              title="Tổng dư nợ"
              rows={computed.rows}
              metric="tongDuNo"
              fmt={fmtCompact}
              onDrill={handleDrill}
              chartType={absChartType}
            />
            <RankingChart
              title="NQH%"
              rows={computed.rows}
              metric="tyLeNQH"
              fmt={fmtPercent}
              onDrill={handleDrill}
              accent="rose"
            />
            <RankingChart
              title="Khoanh%"
              rows={computed.rows}
              metric="tyLeKhoanh"
              fmt={fmtPercent}
              onDrill={handleDrill}
              accent="amber"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm cán bộ theo Mã NV / Tên..."
            className="h-8 w-72 rounded-md border border-slate-200 bg-white pl-7 pr-3 text-xs text-slate-700 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
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
                  <Th label="Cán bộ" sortKey="tenNV" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                  <th className="px-3 py-2 text-right font-semibold">Phụ trách</th>
                  <Th label="KƯ" sortKey="soKheUoc" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                  <Th label="KH" sortKey="soKhachHang" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                  <Th label="Tổng dư nợ" sortKey="tongDuNo" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                  <Th label="Dư nợ NQH" sortKey="duNoQuaHan" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                  <Th label="NQH%" sortKey="tyLeNQH" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                  <Th label="Khoanh" sortKey="duNoKhoanh" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                  <Th label="Khoanh%" sortKey="tyLeKhoanh" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                  <Th label="Mức vay BQ" sortKey="mucVayBQ" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                  <Th label="Lãi tồn TH" sortKey="laiTonTH" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
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
                    <Row key={r.staff.id} row={r} onDrill={() => handleDrill(r.staff)} />
                  ))
                )}
              </tbody>
              {(computed.unassigned.soKheUoc > 0 || computed.ambiguous.soKheUoc > 0) && (
                <tfoot className="bg-slate-50/80 dark:bg-slate-800/40">
                  {computed.unassigned.soKheUoc > 0 && (
                    <SummaryRow label="(Chưa gán cán bộ)" data={computed.unassigned} />
                  )}
                  {computed.ambiguous.soKheUoc > 0 && (
                    <SummaryRow label="(Nhiều cán bộ phụ trách)" data={computed.ambiguous} />
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

function Row({ row, onDrill }: { row: StaffSlice; onDrill: () => void }) {
  return (
    <tr
      className="cursor-pointer hover:bg-brand-50/40 dark:hover:bg-brand-900/10"
      onClick={onDrill}
      title="Bấm để mở Tra cứu chi tiết đã lọc theo cán bộ này"
    >
      <td className="px-3 py-2">
        <div className="font-mono text-[11px] text-slate-500">{row.staff.maNV}</div>
        <div className="font-medium text-slate-800 dark:text-slate-100">{row.staff.tenNV}</div>
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right text-slate-700 dark:text-slate-200">
        {row.dgdCount} ĐGD
        <div className="text-[11px] text-slate-500 dark:text-slate-400">{row.thonCount} thôn</div>
      </td>
      <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-200">{fmtNumber(row.soKheUoc)}</td>
      <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-200">{fmtNumber(row.soKhachHang)}</td>
      <td className="px-3 py-2 text-right font-semibold text-slate-800 dark:text-slate-100">
        {fmtCompact(row.tongDuNo)}
      </td>
      <td className={cn('px-3 py-2 text-right font-medium', row.duNoQuaHan > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-500')}>
        {fmtCompact(row.duNoQuaHan)}
      </td>
      <td className={cn('px-3 py-2 text-right', row.tyLeNQH > 2 ? 'font-semibold text-rose-700 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200')}>
        {fmtPercent(row.tyLeNQH)}
      </td>
      <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-200">{fmtCompact(row.duNoKhoanh)}</td>
      <td className={cn('px-3 py-2 text-right', row.tyLeKhoanh > 1 ? 'font-medium text-amber-700 dark:text-amber-400' : 'text-slate-700 dark:text-slate-200')}>
        {fmtPercent(row.tyLeKhoanh)}
      </td>
      <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-200">{fmtCompact(row.mucVayBQ)}</td>
      <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-200">{fmtCompact(row.laiTonTH)}</td>
    </tr>
  );
}

function SummaryRow({
  label,
  data,
}: {
  label: string;
  data: Omit<StaffSlice, 'staff' | 'dgdCount' | 'thonCount'>;
}) {
  return (
    <tr className="text-xs text-slate-500 dark:text-slate-400">
      <td className="px-3 py-2 font-semibold italic">{label}</td>
      <td className="px-3 py-2 text-right">—</td>
      <td className="px-3 py-2 text-right">{fmtNumber(data.soKheUoc)}</td>
      <td className="px-3 py-2 text-right">{fmtNumber(data.soKhachHang)}</td>
      <td className="px-3 py-2 text-right">{fmtCompact(data.tongDuNo)}</td>
      <td className="px-3 py-2 text-right">{fmtCompact(data.duNoQuaHan)}</td>
      <td className="px-3 py-2 text-right">{fmtPercent(data.tyLeNQH)}</td>
      <td className="px-3 py-2 text-right">{fmtCompact(data.duNoKhoanh)}</td>
      <td className="px-3 py-2 text-right">{fmtPercent(data.tyLeKhoanh)}</td>
      <td className="px-3 py-2 text-right">{fmtCompact(data.mucVayBQ)}</td>
      <td className="px-3 py-2 text-right">{fmtCompact(data.laiTonTH)}</td>
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

/**
 * Mini chart xếp hạng top cán bộ theo 1 chỉ tiêu. Mặc định bar; có thể
 * chuyển sang donut/treemap (chỉ áp dụng cho chỉ tiêu tuyệt đối — share
 * of total mới có nghĩa). Bấm 1 dòng/miếng → drill vào Tra cứu chi tiết.
 */
function RankingChart({
  title,
  rows,
  metric,
  fmt,
  onDrill,
  accent = 'brand',
  chartType = 'bar',
}: {
  title: string;
  rows: StaffSlice[];
  metric: keyof Omit<StaffSlice, 'staff' | 'dgdCount' | 'thonCount'>;
  fmt: (v: number) => string;
  onDrill: (s: StaffRecord) => void;
  accent?: 'brand' | 'rose' | 'amber';
  chartType?: AbsChartType;
}) {
  const items = useMemo(() => {
    const arr = rows
      .map((r) => ({ s: r.staff, v: Number(r[metric] ?? 0) }))
      .filter((x) => x.v > 0)
      .sort((a, b) => b.v - a.v)
      .slice(0, 10);
    return arr;
  }, [rows, metric]);

  const total = useMemo(() => items.reduce((s, x) => s + x.v, 0), [items]);
  const max = items.length > 0 ? items[0].v : 1;
  const palette = useChartColors().palette;

  const barColor =
    accent === 'rose'
      ? 'bg-rose-500 dark:bg-rose-500/80'
      : accent === 'amber'
        ? 'bg-amber-500 dark:bg-amber-500/80'
        : 'bg-brand-500 dark:bg-brand-500/80';

  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">{title}</div>
        <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Top {items.length}
        </div>
      </div>
      {items.length === 0 ? (
        <div className="py-6 text-center text-[11px] italic text-slate-400">Không có dữ liệu.</div>
      ) : chartType === 'donut' ? (
        <DonutView items={items} total={total} fmt={fmt} onDrill={onDrill} palette={palette} />
      ) : chartType === 'treemap' ? (
        <TreemapView items={items} total={total} fmt={fmt} onDrill={onDrill} palette={palette} />
      ) : (
        <div className="space-y-1.5">
          {items.map((it) => (
            <button
              key={it.s.id}
              onClick={() => onDrill(it.s)}
              className="group flex w-full items-center gap-2 text-left"
              title={`${it.s.maNV} — ${it.s.tenNV}: ${fmt(it.v)} · bấm để xem chi tiết`}
            >
              <div className="w-24 shrink-0 truncate text-[10px] text-slate-600 group-hover:text-brand-700 dark:text-slate-300 dark:group-hover:text-brand-300">
                <span className="font-mono">{it.s.maNV}</span> · {it.s.tenNV}
              </div>
              <div className="relative h-2 flex-1 rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={cn('absolute inset-y-0 left-0 rounded-full', barColor)}
                  style={{ width: `${Math.max((it.v / max) * 100, 2)}%` }}
                />
              </div>
              <div className="w-20 shrink-0 text-right text-[10px] font-semibold text-slate-700 dark:text-slate-200">
                {fmt(it.v)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface ChartItem {
  s: StaffRecord;
  v: number;
}

function DonutView({
  items,
  total,
  fmt,
  onDrill,
  palette,
}: {
  items: ChartItem[];
  total: number;
  fmt: (v: number) => string;
  onDrill: (s: StaffRecord) => void;
  palette: readonly string[];
}) {
  const data = items.map((it, i) => ({
    name: `${it.s.maNV} — ${it.s.tenNV}`,
    shortName: it.s.maNV,
    value: it.v,
    fill: palette[i % palette.length],
    staff: it.s,
  }));

  // Vẽ Mã NV + % của từng miếng dưới dạng nhãn ngoài, nối với pie bằng
  // labelLine. Chỉ hiện cho miếng ≥ 4% để tránh dày đặc/đè chồng.
  type LabelProps = {
    cx?: number;
    cy?: number;
    midAngle?: number;
    outerRadius?: number;
    percent?: number;
    fill?: string;
    payload?: { shortName?: string };
  };
  const renderOuterLabel = (props: LabelProps) => {
    const cx = props.cx ?? 0;
    const cy = props.cy ?? 0;
    const midAngle = props.midAngle ?? 0;
    const outerRadius = props.outerRadius ?? 0;
    const percent = props.percent ?? 0;
    if (percent < 0.04) return null;
    const RAD = Math.PI / 180;
    const r = outerRadius + 12;
    const x = cx + r * Math.cos(-midAngle * RAD);
    const y = cy + r * Math.sin(-midAngle * RAD);
    return (
      <text
        x={x}
        y={y}
        fill={props.fill ?? '#666'}
        fontSize={9}
        fontWeight={700}
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
      >
        {props.payload?.shortName ?? ''} · {fmtPercent(percent * 100, 0)}
      </text>
    );
  };

  return (
    <div className="space-y-2">
      <div style={{ height: 240 }} className="relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={75}
              paddingAngle={1}
              onClick={(e) => {
                const target = (e as { staff?: StaffRecord }).staff;
                if (target) onDrill(target);
              }}
              cursor="pointer"
              stroke="none"
              isAnimationActive={false}
              label={renderOuterLabel}
              labelLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.fill} />
              ))}
            </Pie>
            <RTooltip
              contentStyle={{ fontSize: 11, borderRadius: 6 }}
              formatter={(v: number, _name, p) => {
                const pct = total > 0 ? (v / total) * 100 : 0;
                return [`${fmt(v)} · ${fmtPercent(pct, 1)}`, p?.payload?.name ?? ''];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Tổng ở giữa donut */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[9px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Tổng top {items.length}
          </div>
          <div className="text-xs font-bold text-slate-700 dark:text-slate-200">{fmt(total)}</div>
        </div>
      </div>
      {/* Legend dọc bên dưới — Mã NV + giá trị + % */}
      <ul className="space-y-1 text-[10px]">
        {data.map((d) => {
          const pct = total > 0 ? (d.value / total) * 100 : 0;
          return (
            <li
              key={d.staff.id}
              className="flex cursor-pointer items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              onClick={() => onDrill(d.staff)}
              title={`${d.name} · bấm để xem chi tiết`}
            >
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: d.fill }}
              />
              <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-300">
                <span className="font-mono">{d.staff.maNV}</span> · {d.staff.tenNV}
              </span>
              <span className="shrink-0 font-semibold text-slate-700 dark:text-slate-200">
                {fmt(d.value)}
              </span>
              <span
                className="w-10 shrink-0 text-right font-semibold"
                style={{ color: d.fill }}
              >
                {fmtPercent(pct, 1)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TreemapView({
  items,
  total,
  fmt,
  onDrill,
  palette,
}: {
  items: ChartItem[];
  total: number;
  fmt: (v: number) => string;
  onDrill: (s: StaffRecord) => void;
  palette: readonly string[];
}) {
  const data = items.map((it, i) => ({
    name: it.s.maNV,
    fullName: `${it.s.maNV} — ${it.s.tenNV}`,
    size: it.v,
    fill: palette[i % palette.length],
    staff: it.s,
  }));

  // Render từng ô treemap tự vẽ — hiển thị Mã NV + % nếu ô đủ rộng;
  // chỉ % nếu ô nhỏ; bỏ qua nếu quá hẹp. Giá trị cũng có thể fit nếu rộng.
  type CellProps = {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    name?: string;
    size?: number;
    value?: number;
  };
  const renderContent = (props: CellProps) => {
    const x = props.x ?? 0;
    const y = props.y ?? 0;
    const width = props.width ?? 0;
    const height = props.height ?? 0;
    const name = props.name ?? '';
    if (!width || !height || width < 4 || height < 4) return <g />;
    const val = props.size ?? props.value ?? 0;
    const idx = data.findIndex((d) => d.name === name);
    const fill = idx >= 0 ? data[idx].fill : palette[0];
    const pct = total > 0 ? (val / total) * 100 : 0;
    const showName = width > 50 && height > 30;
    const showPct = width > 28 && height > 18;
    const showValue = width > 70 && height > 50;
    return (
      <g style={{ cursor: 'pointer' }}>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx={3}
          fill={fill}
          stroke="#fff"
          strokeWidth={2}
        />
        {showPct && (
          <text
            x={x + width / 2}
            y={y + height / 2 - (showName ? (showValue ? 14 : 6) : 0)}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={showName ? 12 : 10}
            fill="#fff"
            fontWeight={700}
          >
            {fmtPercent(pct, 1)}
          </text>
        )}
        {showName && (
          <text
            x={x + width / 2}
            y={y + height / 2 + (showValue ? 0 : 8)}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={9}
            fill="rgba(255,255,255,0.92)"
            fontWeight={600}
          >
            {name}
          </text>
        )}
        {showValue && (
          <text
            x={x + width / 2}
            y={y + height / 2 + 14}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={9}
            fill="rgba(255,255,255,0.78)"
          >
            {fmt(val)}
          </text>
        )}
      </g>
    );
  };

  return (
    <div className="space-y-2">
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={data}
            dataKey="size"
            nameKey="name"
            stroke="#fff"
            isAnimationActive={false}
            onClick={(e) => {
              const target = (e as { staff?: StaffRecord }).staff;
              if (target) onDrill(target);
            }}
            content={renderContent as never}
          >
            <RTooltip
              contentStyle={{ fontSize: 11, borderRadius: 6 }}
              formatter={(v: number, _name, p) => {
                const pct = total > 0 ? (v / total) * 100 : 0;
                return [`${fmt(v)} · ${fmtPercent(pct, 1)}`, p?.payload?.fullName ?? ''];
              }}
            />
          </Treemap>
        </ResponsiveContainer>
      </div>
      {/* Legend đầy đủ dưới chart */}
      <ul className="space-y-1 text-[10px]">
        {data.map((d) => {
          const pct = total > 0 ? (d.size / total) * 100 : 0;
          return (
            <li
              key={d.staff.id}
              className="flex cursor-pointer items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              onClick={() => onDrill(d.staff)}
              title={`${d.fullName} · bấm để xem chi tiết`}
            >
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-sm"
                style={{ background: d.fill }}
              />
              <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-300">
                <span className="font-mono">{d.staff.maNV}</span> · {d.staff.tenNV}
              </span>
              <span className="shrink-0 font-semibold text-slate-700 dark:text-slate-200">
                {fmt(d.size)}
              </span>
              <span
                className="w-10 shrink-0 text-right font-semibold"
                style={{ color: d.fill }}
              >
                {fmtPercent(pct, 1)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
