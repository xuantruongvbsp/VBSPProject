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
import { applyFilters, useDataStore } from '@/store/useDataStore';
import { useTxnPointStore } from '@/store/useTxnPointStore';
import { buildThonCoverage } from '@/lib/thon-coverage';
import {
  exportPerformanceToXlsx,
  type PerformanceXlsxRow,
} from '@/lib/export-xlsx';
import { fmtCompact, fmtNumber, fmtPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { LoanRecord, TxnPointRecord } from '@/lib/types';

type SortKey =
  | 'tenDGD'
  | 'soToTruong'
  | 'soKheUoc'
  | 'soKhachHang'
  | 'tongDuNo'
  | 'duNoQuaHan'
  | 'tyLeNQH'
  | 'duNoKhoanh'
  | 'tyLeKhoanh'
  | 'mucVayBQ'
  | 'laiTonTH';

interface PointSlice {
  point: TxnPointRecord;
  thonCount: number;

  /** Số Tổ trưởng TK&VV = số Mã tổ duy nhất còn dư nợ trong phạm vi ĐGD. */
  soToTruong: number;
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
  'soToTruong',
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

/** Báo cáo hiệu quả ĐGD — chế độ snapshot 1 kỳ. */
export function TxnPointPerformancePage() {
  const navigate = useNavigate();
  const rows = useDataStore((s) => s.rows);
  const filters = useDataStore((s) => s.filters);
  const ranges = useDataStore((s) => s.ranges);
  const search = useDataStore((s) => s.search);
  const ngaySoLieu = useDataStore((s) => s.ngaySoLieu);
  const points = useTxnPointStore((s) => s.points);
  const selectPoint = useTxnPointStore((s) => s.selectPoint);

  const filtered = useMemo(
    () => applyFilters(rows, filters, ranges, search),
    [rows, filters, ranges, search]
  );

  const { thonToPointIds } = useMemo(
    () => buildThonCoverage([], points),
    [points]
  );

  const computed = useMemo(() => {
    type Bucket = {
      soKheUoc: number;
      tongDuNo: number;
      duNoTrongHan: number;
      duNoQuaHan: number;
      duNoKhoanh: number;
      laiTonTH: number;
      kh: Set<string>;
      to: Set<string>;
    };
    const newBucket = (): Bucket => ({
      soKheUoc: 0,
      tongDuNo: 0,
      duNoTrongHan: 0,
      duNoQuaHan: 0,
      duNoKhoanh: 0,
      laiTonTH: 0,
      kh: new Set(),
      to: new Set(),
    });

    const slices = new Map<string, Bucket>();
    for (const p of points) slices.set(p.id, newBucket());
    const unassigned = newBucket();
    const ambiguous = newBucket();

    const route = (r: LoanRecord): Bucket => {
      const owners = thonToPointIds.get(r.maThon ?? '') ?? [];
      if (owners.length === 0) return unassigned;
      if (owners.length > 1) return ambiguous;
      return slices.get(owners[0]) ?? unassigned;
    };

    // Tập Mã tổ duy nhất trên toàn bộ phần đã gán ĐGD — dùng cho chip tổng.
    // Đếm riêng (không cộng dồn từng ĐGD) để 1 tổ trải trên nhiều ĐGD
    // không bị tính hai lần.
    const coveredTo = new Set<string>();

    for (const r of filtered) {
      const b = route(r);
      b.soKheUoc += 1;
      b.tongDuNo += r.tongDuNo;
      b.duNoTrongHan += r.duNoTrongHan;
      b.duNoQuaHan += r.duNoQuaHan;
      b.duNoKhoanh += r.duNoKhoanh;
      b.laiTonTH += r.laiTonTH;
      // Chỉ tính KH có dư nợ > 0 — bỏ qua Mã KH đã tất toán (dư nợ = 0)
      // để Mức vay BQ và số KH phản ánh đúng khách hàng còn dư nợ.
      if (r.maKH && r.tongDuNo > 0) b.kh.add(r.maKH);
      // Tổ trưởng: khóa theo Mã tổ (1-1 với Tên tổ) để hai tổ trưởng trùng
      // tên ở hai thôn khác nhau không bị gộp làm một.
      if (r.maTo && r.tongDuNo > 0) {
        b.to.add(r.maTo);
        if (b !== unassigned && b !== ambiguous) coveredTo.add(r.maTo);
      }
    }

    const finalize = (b: Bucket): Omit<PointSlice, 'point' | 'thonCount'> => ({
      soToTruong: b.to.size,
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
      coveredToCount: coveredTo.size,
    };
  }, [filtered, points, thonToPointIds]);

  const [sortKey, setSortKey] = useState<SortKey>('tongDuNo');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');

  const visibleRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let arr = computed.rows;
    if (q) {
      arr = arr.filter(
        (r) =>
          r.point.maDGD.toLowerCase().includes(q) ||
          r.point.tenDGD.toLowerCase().includes(q)
      );
    }
    arr = [...arr].sort((a, b) => {
      const av = sortKey === 'tenDGD' ? a.point.tenDGD : (a as unknown as Record<string, unknown>)[sortKey];
      const bv = sortKey === 'tenDGD' ? b.point.tenDGD : (b as unknown as Record<string, unknown>)[sortKey];
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

  function handleDrill(p: TxnPointRecord) {
    selectPoint(p.id);
    navigate('/snapshot/du-lieu');
  }

  async function handleExport() {
    const exportRows: PerformanceXlsxRow[] = computed.rows.map((r) => ({
      keyCode: r.point.maDGD,
      keyLabel: r.point.tenDGD,
      dgdCount: 0,
      thonCount: r.thonCount,
      soToTruong: r.soToTruong,
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
      summaryRows.push({ label: '(Chưa gán ĐGD)', data: computed.unassigned });
    }
    if (computed.ambiguous.soKheUoc > 0) {
      summaryRows.push({ label: '(Nhiều ĐGD)', data: computed.ambiguous });
    }

    await exportPerformanceToXlsx({
      kind: 'point',
      rows: exportRows,
      summaryRows,
      referenceDate: ngaySoLieu,
    });
  }

  if (points.length === 0) {
    return (
      <div className="space-y-4 p-6">
        <header>
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-slate-100">
            <MapPin className="h-5 w-5 text-brand-700 dark:text-brand-300" />
            Báo cáo hiệu quả Điểm giao dịch
          </h2>
        </header>
        <Card>
          <CardContent className="py-6 text-sm text-slate-600 dark:text-slate-300">
            Chưa có Điểm giao dịch trong danh mục.
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
  const totalCoveredKh = computed.rows.reduce((s, r) => s + r.soKhachHang, 0);
  // Mức vay BQ trong phạm vi ĐGD = tổng dư nợ phủ / tổng KH phủ (mức vay
  // bình quân theo khách hàng, tính trên toàn bộ scope đã được gán ĐGD).
  const mucVayBQ = totalCoveredKh > 0 ? coveredTongDuNo / totalCoveredKh : 0;
  // Dư nợ bình quân mỗi ĐGD — mẫu = tổng số ĐGD trong danh mục, để các ĐGD
  // chưa có dữ liệu vẫn nằm trong mức bình quân.
  const duNoBQperPoint =
    points.length > 0 ? coveredTongDuNo / points.length : 0;
  // Số tổ trưởng bình quân mỗi ĐGD — mẫu = tổng số ĐGD trong danh mục, khớp
  // với cách tính "Dư nợ BQ/ĐGD" ở trên.
  const toPerPoint =
    points.length > 0
      ? (computed.coveredToCount / points.length).toFixed(1).replace('.', ',')
      : '0,0';

  return (
    <div className="space-y-4 p-6">
      <header>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-6 w-6 text-brand-700 dark:text-brand-300" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Báo cáo hiệu quả Điểm giao dịch
            </h2>
          </div>
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" /> Xuất Excel
          </Button>
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Bảng KPI từng ĐGD tại 1 kỳ. Phạm vi ĐGD = các Mã thôn được gán trong danh mục.
          Bấm 1 dòng để mở Tra cứu chi tiết đã lọc theo ĐGD.
        </p>
      </header>

      <Card>
        <CardContent className="py-3">
          <FilterBar />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryChip label="ĐGD" value={fmtNumber(points.length)} tone="neutral" />
        <SummaryChip
          label="Tổ trưởng"
          value={fmtNumber(computed.coveredToCount)}
          subValue={`BQ ${toPerPoint} tổ/ĐGD`}
          tone="neutral"
        />
        <SummaryChip
          label="Dư nợ phủ ĐGD"
          value={fmtCompact(coveredTongDuNo)}
          subValue={fmtPercent(coveragePct)}
          tone="ok"
        />
        <SummaryChip
          label="Mức vay BQ/ĐGD"
          value={fmtCompact(mucVayBQ)}
          subValue={`${fmtCompact(coveredTongDuNo)} / ${fmtNumber(totalCoveredKh)} KH`}
          tone="neutral"
        />
        <SummaryChip
          label="Dư nợ BQ/ĐGD"
          value={fmtCompact(duNoBQperPoint)}
          subValue={`${fmtCompact(coveredTongDuNo)} / ${fmtNumber(points.length)} ĐGD`}
          tone="neutral"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm ĐGD theo Mã / Tên..."
            className="h-9 w-80 rounded-md border border-slate-200 bg-white pl-8 pr-3 text-sm text-slate-700 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          />
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {visibleRows.length} / {points.length} ĐGD
        </span>
      </div>

      <Card>
        <CardHeader className="py-2">
          <CardTitle>Bảng xếp hạng</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <Th label="Điểm giao dịch" sortKey="tenDGD" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                  <th className="px-4 py-3 text-right font-semibold">Số thôn</th>
                  <Th label="Tổ trưởng" sortKey="soToTruong" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
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
                    <td colSpan={12} className="px-4 py-6 text-center text-slate-400">
                      Không có ĐGD phù hợp.
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((r) => (
                    <Row key={r.point.id} row={r} onDrill={() => handleDrill(r.point)} />
                  ))
                )}
              </tbody>
              {(computed.unassigned.soKheUoc > 0 || computed.ambiguous.soKheUoc > 0) && (
                <tfoot className="bg-slate-50/80 dark:bg-slate-800/40">
                  {computed.unassigned.soKheUoc > 0 && (
                    <SummaryRow label="(Chưa gán ĐGD)" data={computed.unassigned} />
                  )}
                  {computed.ambiguous.soKheUoc > 0 && (
                    <SummaryRow label="(Nhiều ĐGD)" data={computed.ambiguous} />
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

function Row({ row, onDrill }: { row: PointSlice; onDrill: () => void }) {
  return (
    <tr
      className="cursor-pointer hover:bg-brand-50/40 dark:hover:bg-brand-900/10"
      onClick={onDrill}
      title="Bấm để mở Tra cứu chi tiết đã lọc theo ĐGD này"
    >
      <td className="px-4 py-3">
        <div className="font-mono text-xs text-slate-500">{row.point.maDGD}</div>
        <div className="font-medium text-slate-800 dark:text-slate-100">{row.point.tenDGD}</div>
      </td>
      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">{row.thonCount}</td>
      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">{fmtNumber(row.soToTruong)}</td>
      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">{fmtNumber(row.soKheUoc)}</td>
      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">{fmtNumber(row.soKhachHang)}</td>
      <td className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-100">
        {fmtCompact(row.tongDuNo)}
      </td>
      <td className={cn('px-4 py-3 text-right font-medium', row.duNoQuaHan > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-500')}>
        {fmtCompact(row.duNoQuaHan)}
      </td>
      <td className={cn('px-4 py-3 text-right', row.tyLeNQH > 2 ? 'font-semibold text-rose-700 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200')}>
        {fmtPercent(row.tyLeNQH)}
      </td>
      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">{fmtCompact(row.duNoKhoanh)}</td>
      <td className={cn('px-4 py-3 text-right', row.tyLeKhoanh > 1 ? 'font-medium text-amber-700 dark:text-amber-400' : 'text-slate-700 dark:text-slate-200')}>
        {fmtPercent(row.tyLeKhoanh)}
      </td>
      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">{fmtCompact(row.mucVayBQ)}</td>
      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">{fmtCompact(row.laiTonTH)}</td>
    </tr>
  );
}

function SummaryRow({
  label,
  data,
}: {
  label: string;
  data: Omit<PointSlice, 'point' | 'thonCount'>;
}) {
  return (
    <tr className="text-sm text-slate-500 dark:text-slate-400">
      <td className="px-4 py-3 font-semibold italic">{label}</td>
      <td className="px-4 py-3 text-right">—</td>
      <td className="px-4 py-3 text-right">{fmtNumber(data.soToTruong)}</td>
      <td className="px-4 py-3 text-right">{fmtNumber(data.soKheUoc)}</td>
      <td className="px-4 py-3 text-right">{fmtNumber(data.soKhachHang)}</td>
      <td className="px-4 py-3 text-right">{fmtCompact(data.tongDuNo)}</td>
      <td className="px-4 py-3 text-right">{fmtCompact(data.duNoQuaHan)}</td>
      <td className="px-4 py-3 text-right">{fmtPercent(data.tyLeNQH)}</td>
      <td className="px-4 py-3 text-right">{fmtCompact(data.duNoKhoanh)}</td>
      <td className="px-4 py-3 text-right">{fmtPercent(data.tyLeKhoanh)}</td>
      <td className="px-4 py-3 text-right">{fmtCompact(data.mucVayBQ)}</td>
      <td className="px-4 py-3 text-right">{fmtCompact(data.laiTonTH)}</td>
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
        'cursor-pointer select-none px-4 py-3 font-semibold hover:text-slate-700 dark:hover:text-slate-200',
        align === 'right' ? 'text-right' : 'text-left'
      )}
    >
      <span className={cn('inline-flex items-center gap-1', align === 'right' && 'flex-row-reverse')}>
        {label}
        {isActive ? (
          dir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
        ) : (
          <ArrowDownUp className="h-3.5 w-3.5 opacity-40" />
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
    <div className={cn('rounded-md border px-4 py-3', toneClass)}>
      <div className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 text-xl font-bold leading-tight">{value}</div>
      {subValue && <div className="mt-0.5 text-xs opacity-70">{subValue}</div>}
    </div>
  );
}
