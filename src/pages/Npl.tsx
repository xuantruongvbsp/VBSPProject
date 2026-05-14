import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Snowflake,
  Coins,
  Users,
  FileWarning,
  Percent,
  AlignLeft,
  LayoutGrid,
  PieChart,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  CalendarClock,
  UserX,
  Table,
  BarChart2,
} from 'lucide-react';
import { applyFilters, useDataStore, type FilterField } from '@/store/useDataStore';
import { computeKpi, groupBy, isOpenLoan, type GroupAgg } from '@/lib/metrics';
import { fmtCompact, fmtCurrency, fmtDate, fmtNumber, fmtPercent } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';
import { InfoPopover } from '@/components/ui/InfoPopover';
import { ExportMenu } from '@/components/export/ExportMenu';
import { exportBadDebtToXlsx } from '@/lib/export-xlsx';
import { cn } from '@/lib/utils';
import { FilterBar } from '@/components/filters/FilterBar';
import { BarByGroup, type BarGroupChartType } from '@/components/charts/BarByGroup';
import { HeatmapMaturity, type HeatmapChartType } from '@/components/charts/HeatmapMaturity';
import { ChartSwitcher, type ChartTypeOption } from '@/components/ui/ChartSwitcher';
import { LoanDetailDrawer } from '@/components/detail/LoanDetailDrawer';
import type { LoanRecord } from '@/lib/types';

const BAR_GROUP_OPTS: ChartTypeOption<BarGroupChartType>[] = [
  { id: 'bar', icon: AlignLeft, tooltip: 'Biểu đồ thanh' },
  { id: 'treemap', icon: LayoutGrid, tooltip: 'Bản đồ cây' },
  { id: 'pie', icon: PieChart, tooltip: 'Biểu đồ tròn' },
];

const HEAT_OPTS: ChartTypeOption<HeatmapChartType>[] = [
  { id: 'heatmap', icon: Table, tooltip: 'Bảng nhiệt' },
  { id: 'stackedBar', icon: BarChart2, tooltip: 'Cột xếp chồng theo năm' },
];

/**
 * Trang "Báo cáo NPL" — chuyên phân tích dư nợ quá hạn và nợ khoanh.
 * Cùng cấp với Tổng quan trong menu trái. Tất cả thống kê đều dùng
 * bộ lọc hiện hành trên FilterBar.
 */
export function NplPage() {
  const { rows, filters, ranges, search, ngaySoLieu, drillDown } = useDataStore();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<LoanRecord | null>(null);
  const [chartDvutType, setChartDvutType] = useState<BarGroupChartType>('pie');
  const [chartXaType, setChartXaType] = useState<BarGroupChartType>('bar');
  const [chartProgramType, setChartProgramType] = useState<BarGroupChartType>('bar');
  // Combined "Dư nợ quá hạn" — toggle theo chiều phân tích.
  const [qhDim, setQhDim] = useState<'xa' | 'dvut' | 'program'>('xa');
  const [chartQhType, setChartQhType] = useState<BarGroupChartType>('bar');
  const [dueSoonScope, setDueSoonScope] = useState<'month' | 'quarter' | 'year'>('month');
  const [dueSoonHeatType, setDueSoonHeatType] = useState<HeatmapChartType>('heatmap');
  // Khi user click một ô trên heatmap, lưu lại "YYYY-MM" để bảng cảnh báo
  // bên dưới chỉ hiển thị khế ước trong tháng đó. Null = không lọc theo ô.
  const [dueSoonHeatMonth, setDueSoonHeatMonth] = useState<string | null>(null);
  const [exportingDueSoon, setExportingDueSoon] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingChuyenNQH, setExportingChuyenNQH] = useState(false);
  const [qhSearch, setQhSearch] = useState('');
  const [qhPage, setQhPage] = useState(0);
  const QH_PAGE_SIZE = 10;

  const drillTo = useCallback(
    (field: FilterField, value: string) => {
      drillDown(field, value);
      navigate('/snapshot/du-lieu');
    },
    [drillDown, navigate]
  );

  const filtered = useMemo(
    () => applyFilters(rows, filters, ranges, search),
    [rows, filters, ranges, search]
  );

  const kpi = useMemo(() => computeKpi(filtered), [filtered]);

  // Chỉ giữ các khế ước có dư nợ quá hạn hoặc khoanh để bảng & biểu đồ
  // chỉ nói về NPL, không pha loãng bởi khế ước trong hạn.
  const nplLoans = useMemo(
    () => filtered.filter((r) => r.duNoQuaHan > 0 || r.duNoKhoanh > 0),
    [filtered]
  );

  // Tổng nợ xấu = QH + Khoanh
  const tongNoXau = kpi.duNoQuaHan + kpi.duNoKhoanh;
  const tyLeNoXau = kpi.tongDuNo > 0 ? (tongNoXau / kpi.tongDuNo) * 100 : 0;

  // Số khế ước / khách hàng có dư nợ quá hạn (không tính khoanh)
  const qhLoansCount = nplLoans.length;
  const qhKhCount = useMemo(() => {
    const s = new Set<string>();
    for (const r of nplLoans) if (r.maKH) s.add(r.maKH);
    return s.size;
  }, [nplLoans]);

  // Tổng lãi tồn quá hạn (sum từ trường laiTonQH của các khế ước NPL)
  const tongLaiTonQH = useMemo(
    () => nplLoans.reduce((s, r) => s + (r.laiTonQH || 0), 0),
    [nplLoans]
  );

  // Khách hàng có nhiều khế ước NPL (≥ 2) — dấu hiệu rủi ro tập trung
  const khMultipleNpl = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of nplLoans) {
      if (!r.maKH) continue;
      counts.set(r.maKH, (counts.get(r.maKH) || 0) + 1);
    }
    let n = 0;
    for (const c of counts.values()) if (c >= 2) n++;
    return n;
  }, [nplLoans]);

  // Gom nhóm theo các chiều phân tích — dùng dữ liệu đã lọc (không chỉ NPL)
  // để tỷ lệ QH hiển thị đúng trên tổng dư nợ của từng nhóm.
  const byXa = useMemo(() => groupBy(filtered, 'tenXa'), [filtered]);
  const byDVUT = useMemo(() => groupBy(filtered, 'tenDVUT'), [filtered]);
  const byProgram = useMemo(() => groupBy(filtered, 'tenChuongTrinh'), [filtered]);

  // Sắp xếp lại theo dư nợ quá hạn giảm dần cho các chart NPL
  const sortByQH = (arr: GroupAgg[]) =>
    [...arr].filter((g) => g.duNoQuaHan > 0).sort((a, b) => b.duNoQuaHan - a.duNoQuaHan);
  const byXa_QH = useMemo(() => sortByQH(byXa), [byXa]);
  const byDVUT_QH = useMemo(() => sortByQH(byDVUT), [byDVUT]);
  const byProgram_QH = useMemo(() => sortByQH(byProgram), [byProgram]);

  // Danh sách đầy đủ các khế ước có dư nợ quá hạn > 0, sắp xếp giảm dần.
  // Khoanh có báo cáo riêng nên ở đây chỉ lấy QH thuần.
  const qhLoansOnly = useMemo(
    () =>
      [...filtered]
        .filter((r) => r.duNoQuaHan > 0)
        .sort((a, b) => b.duNoQuaHan - a.duNoQuaHan),
    [filtered]
  );

  // Lọc nhanh tại bảng theo tên KH / mã KH / số khế ước / xã / ĐVUT / tổ /
  // chương trình. So khớp lowercase substring trên các trường text chính.
  const qhSearchFiltered = useMemo(() => {
    const q = qhSearch.trim().toLowerCase();
    if (!q) return qhLoansOnly;
    return qhLoansOnly.filter((r) => {
      const hay = [
        r.tenKH,
        r.maKH,
        r.soKheUoc,
        r.tenXa,
        r.tenDVUT,
        r.tenTo,
        r.tenChuongTrinh,
        r.soCMND,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [qhLoansOnly, qhSearch]);

  const qhTotalPages = Math.max(1, Math.ceil(qhSearchFiltered.length / QH_PAGE_SIZE));
  const qhCurrentPage = Math.min(qhPage, qhTotalPages - 1);
  const qhPaged = useMemo(
    () =>
      qhSearchFiltered.slice(
        qhCurrentPage * QH_PAGE_SIZE,
        qhCurrentPage * QH_PAGE_SIZE + QH_PAGE_SIZE
      ),
    [qhSearchFiltered, qhCurrentPage]
  );

  // Quay về trang đầu khi từ khóa hoặc bộ dữ liệu nguồn thay đổi.
  useEffect(() => {
    setQhPage(0);
  }, [qhSearch, qhLoansOnly]);

  const handleExportQh = useCallback(async () => {
    if (exporting || qhLoansOnly.length === 0) return;
    setExporting(true);
    try {
      await exportBadDebtToXlsx({
        kind: 'qh',
        loans: qhLoansOnly,
        referenceDate: ngaySoLieu,
        totalFilteredRows: filtered.length,
      });
    } catch (e) {
      console.error('Xuất danh sách NPL thất bại:', e);
    } finally {
      setExporting(false);
    }
  }, [exporting, qhLoansOnly, ngaySoLieu, filtered.length]);

  // Khế ước "chuyển NQH trong tháng": Ngày ĐH theo GDXA rơi vào tháng của
  // ngày chốt số liệu VÀ đã đến/qua ngày chốt — tức ngayDHGDXA <= ngaySoLieu.
  // Nếu chỉ check năm+tháng (như bản cũ) thì khế ước có ngayDHGDXA = 07/05
  // sẽ bị tính dù ngaySoLieu mới là 04/05 → chưa thực sự quá hạn. So sánh
  // theo ngày trong tháng (cùng năm+tháng) là đủ và rõ ràng nhất.
  const chuyenNQHThang = useMemo(() => {
    if (!ngaySoLieu) return [];
    const y = ngaySoLieu.getFullYear();
    const m = ngaySoLieu.getMonth();
    const dCutoff = ngaySoLieu.getDate();
    return filtered
      .filter((r) => {
        if (!isOpenLoan(r)) return false;
        if (!(r.duNoQuaHan > 0)) return false;
        const d = r.ngayDHGDXA;
        if (!d) return false;
        if (d.getFullYear() !== y || d.getMonth() !== m) return false;
        return d.getDate() <= dCutoff;
      })
      .sort((a, b) => {
        const da = a.ngayDHGDXA?.getTime() ?? 0;
        const db = b.ngayDHGDXA?.getTime() ?? 0;
        return da - db;
      });
  }, [filtered, ngaySoLieu]);

  const tongChuyenNQH = useMemo(
    () => chuyenNQHThang.reduce((s, r) => s + r.duNoQuaHan, 0),
    [chuyenNQHThang]
  );

  // Dự kiến chuyển NQH (chưa quá hạn nhưng sắp): ngayDHGDXA SAU ngày chốt
  // số liệu, OPEN. Tách 3 mức:
  //   - Tháng: cùng tháng+năm với ngaySoLieu, ngày > ngaySoLieu
  //   - Quý:   cùng quý+năm, ngày > ngaySoLieu (bao gồm cả phần "tháng")
  //   - Năm:   cùng năm với ngaySoLieu, ngày > ngaySoLieu (bao gồm cả "quý")
  const { dueSoonThang, dueSoonQuy, dueSoonNam } = useMemo(() => {
    if (!ngaySoLieu)
      return {
        dueSoonThang: [] as LoanRecord[],
        dueSoonQuy: [] as LoanRecord[],
        dueSoonNam: [] as LoanRecord[],
      };
    const y = ngaySoLieu.getFullYear();
    const m = ngaySoLieu.getMonth();
    const q = Math.floor(m / 3);
    const refMs = ngaySoLieu.getTime();
    const thang: LoanRecord[] = [];
    const quy: LoanRecord[] = [];
    const nam: LoanRecord[] = [];
    for (const r of filtered) {
      if (!isOpenLoan(r)) continue;
      const d = r.ngayDHGDXA;
      if (!d) continue;
      if (d.getFullYear() !== y) continue;
      if (d.getTime() <= refMs) continue; // đã đến hạn → thuộc nhóm "đã chuyển"
      nam.push(r);
      const dq = Math.floor(d.getMonth() / 3);
      if (dq !== q) continue;
      quy.push(r);
      if (d.getMonth() === m) thang.push(r);
    }
    const sortByDate = (a: LoanRecord, b: LoanRecord) =>
      (a.ngayDHGDXA?.getTime() ?? 0) - (b.ngayDHGDXA?.getTime() ?? 0);
    thang.sort(sortByDate);
    quy.sort(sortByDate);
    nam.sort(sortByDate);
    return { dueSoonThang: thang, dueSoonQuy: quy, dueSoonNam: nam };
  }, [filtered, ngaySoLieu]);

  const tongDuNoDueSoonThang = useMemo(
    () => dueSoonThang.reduce((s, r) => s + r.tongDuNo, 0),
    [dueSoonThang],
  );
  const tongDuNoDueSoonQuy = useMemo(
    () => dueSoonQuy.reduce((s, r) => s + r.tongDuNo, 0),
    [dueSoonQuy],
  );

  // Khế ước sắp chuyển NQH (trong tháng/quý) MÀ KH đã ngừng giao dịch > 90 ngày
  // tính từ ngày chốt. Cảnh báo sớm: vừa có nguy cơ quá hạn, vừa khó liên hệ.
  const sortByDHGDXA = (a: LoanRecord, b: LoanRecord) =>
    (a.ngayDHGDXA?.getTime() ?? 0) - (b.ngayDHGDXA?.getTime() ?? 0);

  const dueSoonDormantThang = useMemo(() => {
    if (!ngaySoLieu || dueSoonThang.length === 0) return [] as Array<LoanRecord & { daysSince: number }>;
    const refMs = ngaySoLieu.getTime();
    const dayMs = 86_400_000;
    const out: Array<LoanRecord & { daysSince: number }> = [];
    for (const r of dueSoonThang) {
      const last = r.ngayGiaoDichGanNhat;
      if (!last) continue;
      const days = Math.floor((refMs - last.getTime()) / dayMs);
      if (days > 90) out.push({ ...r, daysSince: days });
    }
    out.sort(sortByDHGDXA);
    return out;
  }, [dueSoonThang, ngaySoLieu]);

  const dueSoonDormant = useMemo(() => {
    if (!ngaySoLieu || dueSoonQuy.length === 0) return [] as Array<LoanRecord & { daysSince: number }>;
    const refMs = ngaySoLieu.getTime();
    const dayMs = 86_400_000;
    const out: Array<LoanRecord & { daysSince: number }> = [];
    for (const r of dueSoonQuy) {
      const last = r.ngayGiaoDichGanNhat;
      if (!last) continue;
      const days = Math.floor((refMs - last.getTime()) / dayMs);
      if (days > 90) out.push({ ...r, daysSince: days });
    }
    out.sort(sortByDHGDXA);
    return out;
  }, [dueSoonQuy, ngaySoLieu]);

  const dueSoonDormantNam = useMemo(() => {
    if (!ngaySoLieu || dueSoonNam.length === 0) return [] as Array<LoanRecord & { daysSince: number }>;
    const refMs = ngaySoLieu.getTime();
    const dayMs = 86_400_000;
    const out: Array<LoanRecord & { daysSince: number }> = [];
    for (const r of dueSoonNam) {
      const last = r.ngayGiaoDichGanNhat;
      if (!last) continue;
      const days = Math.floor((refMs - last.getTime()) / dayMs);
      if (days > 90) out.push({ ...r, daysSince: days });
    }
    out.sort(sortByDHGDXA);
    return out;
  }, [dueSoonNam, ngaySoLieu]);

  const tongDuNoDueSoonDormantThang = useMemo(
    () => dueSoonDormantThang.reduce((s, r) => s + r.tongDuNo, 0),
    [dueSoonDormantThang],
  );
  const tongDuNoDueSoonDormant = useMemo(
    () => dueSoonDormant.reduce((s, r) => s + r.tongDuNo, 0),
    [dueSoonDormant],
  );
  const tongDuNoDueSoonDormantNam = useMemo(
    () => dueSoonDormantNam.reduce((s, r) => s + r.tongDuNo, 0),
    [dueSoonDormantNam],
  );

  // Tập gốc cho heatmap & drill: TẤT CẢ khế ước OPEN có ngayDHGDXA SAU ngày
  // chốt VÀ KH đã ngừng giao dịch > 90 ngày (không giới hạn theo năm).
  const dueSoonDormantAll = useMemo(() => {
    if (!ngaySoLieu) return [] as Array<LoanRecord & { daysSince: number }>;
    const refMs = ngaySoLieu.getTime();
    const dayMs = 86_400_000;
    const out: Array<LoanRecord & { daysSince: number }> = [];
    for (const r of filtered) {
      if (!isOpenLoan(r)) continue;
      const d = r.ngayDHGDXA;
      if (!d || d.getTime() <= refMs) continue;
      const last = r.ngayGiaoDichGanNhat;
      if (!last) continue;
      const days = Math.floor((refMs - last.getTime()) / dayMs);
      if (days <= 90) continue;
      out.push({ ...r, daysSince: days });
    }
    out.sort(sortByDHGDXA);
    return out;
  }, [filtered, ngaySoLieu]);

  // Heatmap data: gom dueSoonDormantAll theo năm-tháng.
  const dueSoonDormantHeatmap = useMemo(() => {
    const map = new Map<string, { count: number; tongDuNo: number }>();
    for (const r of dueSoonDormantAll) {
      const d = r.ngayDHGDXA;
      if (!d) continue;
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      const cur = map.get(key) ?? { count: 0, tongDuNo: 0 };
      cur.count++;
      cur.tongDuNo += r.tongDuNo;
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, v]) => ({ ym, ...v }));
  }, [dueSoonDormantAll]);

  // Khi user chọn ô trên heatmap, lọc bảng theo đúng tháng đó.
  const dueSoonDormantByMonth = useMemo(() => {
    if (!dueSoonHeatMonth) return [] as Array<LoanRecord & { daysSince: number }>;
    const [yStr, mStr] = dueSoonHeatMonth.split('-');
    const y = Number(yStr);
    const m = Number(mStr) - 1;
    return dueSoonDormantAll.filter((r) => {
      const d = r.ngayDHGDXA;
      return !!d && d.getFullYear() === y && d.getMonth() === m;
    });
  }, [dueSoonDormantAll, dueSoonHeatMonth]);
  const tongDuNoDueSoonDormantByMonth = useMemo(
    () => dueSoonDormantByMonth.reduce((s, r) => s + r.tongDuNo, 0),
    [dueSoonDormantByMonth],
  );

  const handleExportChuyenNQH = useCallback(async () => {
    if (exportingChuyenNQH || chuyenNQHThang.length === 0) return;
    setExportingChuyenNQH(true);
    try {
      await exportBadDebtToXlsx({
        kind: 'chuyenNQHThang',
        loans: chuyenNQHThang,
        referenceDate: ngaySoLieu,
        totalFilteredRows: filtered.length,
      });
    } catch (e) {
      console.error('Xuất danh sách chuyển NQH trong tháng thất bại:', e);
    } finally {
      setExportingChuyenNQH(false);
    }
  }, [exportingChuyenNQH, chuyenNQHThang, ngaySoLieu, filtered.length]);

  const handleExportDueSoonDormant = useCallback(async () => {
    const heatActive = !!dueSoonHeatMonth;
    const list = heatActive
      ? dueSoonDormantByMonth
      : dueSoonScope === 'month'
        ? dueSoonDormantThang
        : dueSoonScope === 'quarter'
          ? dueSoonDormant
          : dueSoonDormantNam;
    if (exportingDueSoon || list.length === 0) return;
    setExportingDueSoon(true);
    try {
      await exportBadDebtToXlsx({
        // Khi user lọc theo ô heatmap (1 tháng cụ thể, có thể khác tháng/quý/năm
        // hiện tại), tái sử dụng kind 'dueSoonDormantThang' — đều là 1 tháng.
        kind: heatActive
          ? 'dueSoonDormantThang'
          : dueSoonScope === 'month'
            ? 'dueSoonDormantThang'
            : dueSoonScope === 'quarter'
              ? 'dueSoonDormantQuy'
              : 'dueSoonDormantNam',
        loans: list,
        referenceDate: ngaySoLieu,
        totalFilteredRows: filtered.length,
      });
    } catch (e) {
      console.error('Xuất cảnh báo sớm thất bại:', e);
    } finally {
      setExportingDueSoon(false);
    }
  }, [
    exportingDueSoon,
    dueSoonScope,
    dueSoonHeatMonth,
    dueSoonDormantByMonth,
    dueSoonDormantThang,
    dueSoonDormant,
    dueSoonDormantNam,
    ngaySoLieu,
    filtered.length,
  ]);

  // Bảng "hotspot" — tỷ lệ QH theo xã, sắp xếp giảm dần (tối thiểu 3 khế ước
  // để tránh tạp nhiễu từ các xã quá nhỏ).
  const hotspots = useMemo(
    () =>
      byXa
        .filter((g) => g.soKheUoc >= 3 && g.tyLeNoQH > 0)
        .sort((a, b) => b.tyLeNoQH - a.tyLeNoQH)
        .slice(0, 15),
    [byXa]
  );

  return (
    <div className="space-y-5 p-6">
      <header className="space-y-3">
        <div>
          <ExportMenu
            pageTitle="Báo cáo NPL — Dư nợ quá hạn & Khoanh"
            subtitle={`${qhLoansCount.toLocaleString('vi-VN')} khế ước NPL / ${filtered.length.toLocaleString('vi-VN')} khế ước`}
            rows={nplLoans}
            kpi={kpi}
            chartSelectors={[
              '#chart-npl-dvut',
              '#chart-npl-xa',
              '#chart-npl-program',
              '#chart-npl-chuyen-nqh-thang',
              '#chart-npl-hotspot',
              '#chart-npl-top',
            ]}
            size="sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Báo cáo NPL — Dư nợ quá hạn & Khoanh
          </h1>
          <InfoPopover metricKey="pageNpl" />
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Thống kê dư nợ quá hạn và nợ khoanh trên {filtered.length.toLocaleString('vi-VN')} khế
          ước đang áp dụng bộ lọc. Toàn bộ khế ước tất toán đã được loại khỏi nguồn số liệu.
        </p>
      </header>

      <Card>
        <CardContent className="py-3">
          <FilterBar />
        </CardContent>
      </Card>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Dư nợ quá hạn"
          value={kpi.duNoQuaHan}
          tone="danger"
          icon={<AlertTriangle className="h-4 w-4" />}
          formatter={fmtCompact}
          caption={`Tỷ lệ ${fmtPercent(kpi.tyLeNoQuaHan)}`}
          infoKey="duNoQuaHan"
        />
        <KpiCard
          label="Số khế ước NPL"
          value={qhLoansCount}
          tone="danger"
          icon={<FileWarning className="h-4 w-4" />}
          caption={`${fmtPercent(filtered.length > 0 ? (qhLoansCount / filtered.length) * 100 : 0)} số khế ước`}
          infoKey="soKheUocNPL"
        />
        <KpiCard
          label="Khách hàng có nợ xấu"
          value={qhKhCount}
          tone="warning"
          icon={<Users className="h-4 w-4" />}
          caption={
            khMultipleNpl > 0
              ? `${fmtNumber(khMultipleNpl)} KH có ≥ 2 khế ước NPL`
              : 'Duy nhất theo mã KH'
          }
          infoKey="khachHangCoNoXau"
        />
        <KpiCard
          label="Đã Chuyển NQH trong tháng"
          value={chuyenNQHThang.length}
          // Khi không có khế ước nào chuyển NQH (0) → success (xanh nhẹ nhõm).
          // Khi có khế ước chuyển NQH (>0) → danger (đỏ — nợ mới phát sinh).
          tone={chuyenNQHThang.length > 0 ? 'danger' : 'success'}
          icon={<FileWarning className="h-4 w-4" />}
          caption={
            ngaySoLieu ? (
              <div className="space-y-1">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {`Tháng ${String(ngaySoLieu.getMonth() + 1).padStart(2, '0')}/${ngaySoLieu.getFullYear()}`}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-red-700/80 dark:text-red-300/80">
                    Dư nợ QH
                  </span>
                  <span className="text-lg font-bold tabular-nums text-red-700 dark:text-red-300">
                    {fmtCompact(tongChuyenNQH)}
                  </span>
                </div>
              </div>
            ) : (
              'Không có ngày chốt số liệu'
            )
          }
          infoKey="chuyenNQHThang"
        />
        <DueSoonCard
          thangCount={dueSoonDormantThang.length}
          thangDuNo={tongDuNoDueSoonDormantThang}
          quyCount={dueSoonDormant.length}
          quyDuNo={tongDuNoDueSoonDormant}
          namCount={dueSoonDormantNam.length}
          namDuNo={tongDuNoDueSoonDormantNam}
        />
      </div>

      {/* Danh sách khế ước đã chuyển NQH trong tháng — đặt lên đầu vì là việc ưu tiên xử lý ngay. */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CardTitle>Danh sách chuyển NQH trong tháng</CardTitle>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {ngaySoLieu
                  ? `Tháng ${String(ngaySoLieu.getMonth() + 1).padStart(2, '0')}/${ngaySoLieu.getFullYear()} · ${fmtNumber(chuyenNQHThang.length)} khế ước · Tổng dư nợ QH ${fmtCurrency(tongChuyenNQH)}`
                  : `${fmtNumber(chuyenNQHThang.length)} khế ước`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportChuyenNQH}
                disabled={exportingChuyenNQH || chuyenNQHThang.length === 0}
                title={
                  chuyenNQHThang.length === 0
                    ? 'Không có khế ước chuyển NQH trong tháng để xuất'
                    : `Xuất ${chuyenNQHThang.length} khế ước ra Excel`
                }
                aria-label="Xuất danh sách chuyển NQH trong tháng ra Excel"
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors',
                  exportingChuyenNQH || chuyenNQHThang.length === 0
                    ? 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                    : 'bg-rose-600 text-white hover:bg-rose-700'
                )}
              >
                <Download
                  className={cn('h-3.5 w-3.5', exportingChuyenNQH && 'animate-pulse')}
                />
                {exportingChuyenNQH ? 'Đang xuất…' : 'Xuất Excel'}
              </button>
              <InfoPopover metricKey="chartNplChuyenNQHThang" />
            </div>
          </div>
        </CardHeader>
        <CardContent id="chart-npl-chuyen-nqh-thang" className="p-0">
          {!ngaySoLieu ? (
            <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">
              Không xác định được ngày chốt số liệu.
            </div>
          ) : chuyenNQHThang.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">
              Không có khế ước nào có "Ngày ĐH theo GDXA" trong tháng{' '}
              {String(ngaySoLieu.getMonth() + 1).padStart(2, '0')}/
              {ngaySoLieu.getFullYear()} với tình trạng OPEN.
            </div>
          ) : (
            <div className="scrollbar-thin max-h-[640px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                  <tr className="text-left text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Khách hàng</th>
                    <th className="px-4 py-3">Xã · ĐVUT</th>
                    <th className="px-4 py-3">Tổ TK&amp;VV</th>
                    <th className="px-4 py-3">Chương trình</th>
                    <th className="px-4 py-3 text-right">Ngày ĐH GDXA</th>
                    <th className="px-4 py-3 text-right">Mức vay</th>
                    <th className="px-4 py-3 text-right">Dư nợ QH</th>
                    <th className="px-4 py-3 text-right">Dư nợ khoanh</th>
                    <th className="px-4 py-3 text-right">Lãi tồn QH</th>
                  </tr>
                </thead>
                <tbody>
                  {chuyenNQHThang.map((r, i) => (
                    <tr
                      key={r.soKheUoc || `${r.maKH}-${i}`}
                      onClick={() => setDetail(r)}
                      className="cursor-pointer border-t border-slate-100 hover:bg-rose-50 dark:border-slate-700 dark:hover:bg-rose-900/20"
                    >
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-800 dark:text-slate-100">
                          {r.tenKH}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {r.soKheUoc}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                        <div>{r.tenXa || '—'}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {r.tenDVUT || '—'}
                        </div>
                      </td>
                      <td
                        className="max-w-[200px] truncate px-4 py-2.5 text-slate-600 dark:text-slate-300"
                        title={r.tenTo}
                      >
                        {r.tenTo || '—'}
                      </td>
                      <td className="max-w-[240px] truncate px-4 py-2.5 text-slate-600 dark:text-slate-300">
                        {r.tenChuongTrinh}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-300">
                        {fmtDate(r.ngayDHGDXA)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-700 dark:text-slate-300">
                        {fmtCurrency(r.mucVay)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-rose-700 dark:text-rose-300">
                        {fmtCurrency(r.duNoQuaHan)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-amber-700 dark:text-amber-300">
                        {fmtCurrency(r.duNoKhoanh)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-700 dark:text-slate-300">
                        {fmtCurrency(r.laiTonQH)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cảnh báo sớm: KH có khế ước SẮP đến hạn (tháng/quý) + ngừng GD > 90 ngày.
          Đặt ngay sau KPI strip để cán bộ thấy danh sách ưu tiên đôn đốc trước nhất. */}
      {(() => {
        const heatActive = !!dueSoonHeatMonth;
        const list = heatActive
          ? dueSoonDormantByMonth
          : dueSoonScope === 'month'
            ? dueSoonDormantThang
            : dueSoonScope === 'quarter'
              ? dueSoonDormant
              : dueSoonDormantNam;
        const tong = heatActive
          ? tongDuNoDueSoonDormantByMonth
          : dueSoonScope === 'month'
            ? tongDuNoDueSoonDormantThang
            : dueSoonScope === 'quarter'
              ? tongDuNoDueSoonDormant
              : tongDuNoDueSoonDormantNam;
        const heatMonthLabel = heatActive
          ? `${dueSoonHeatMonth!.split('-')[1]}/${dueSoonHeatMonth!.split('-')[0]}`
          : '';
        const scopeLabel = heatActive
          ? `tháng ${heatMonthLabel}`
          : dueSoonScope === 'month'
            ? 'tháng'
            : dueSoonScope === 'quarter'
              ? 'quý'
              : 'năm';
        return (
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="flex items-center gap-2">
                <UserX className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                Cảnh báo sớm: sắp đến hạn nhưng đã ngừng giao dịch &gt; 90 ngày
              </CardTitle>
              <div
                className={cn(
                  'inline-flex rounded-md border border-slate-200 bg-white p-0.5 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-800',
                  heatActive && 'pointer-events-none opacity-50'
                )}
                title={
                  heatActive
                    ? 'Đang lọc theo tháng từ heatmap — xóa lọc để bật lại Tháng/Quý/Năm'
                    : undefined
                }
              >
                {([
                  ['month', 'Tháng'],
                  ['quarter', 'Quý'],
                  ['year', 'Năm'],
                ] as const).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setDueSoonScope(val)}
                    disabled={heatActive}
                    className={`rounded px-2.5 py-1 font-medium transition-colors ${
                      dueSoonScope === val
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {heatActive && (
                <button
                  type="button"
                  onClick={() => setDueSoonHeatMonth(null)}
                  className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-semibold text-purple-800 ring-1 ring-purple-200 transition-colors hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-200 dark:ring-purple-800 dark:hover:bg-purple-900/60"
                  title="Bỏ lọc theo tháng từ heatmap — quay lại Tháng/Quý/Năm"
                >
                  Tháng {heatMonthLabel} · Xóa lọc ✕
                </button>
              )}
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {ngaySoLieu
                  ? `${fmtNumber(list.length)} khế ước · Tổng dư nợ ${fmtCurrency(tong)}`
                  : '—'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportDueSoonDormant}
                disabled={exportingDueSoon || list.length === 0}
                title={
                  list.length === 0
                    ? 'Không có khế ước nào để xuất'
                    : `Xuất ${list.length} khế ước ra Excel`
                }
                aria-label="Xuất danh sách cảnh báo sớm ra Excel"
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors',
                  exportingDueSoon || list.length === 0
                    ? 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                    : 'bg-amber-600 text-white hover:bg-amber-700'
                )}
              >
                <Download className={cn('h-3.5 w-3.5', exportingDueSoon && 'animate-pulse')} />
                {exportingDueSoon ? 'Đang xuất…' : 'Xuất Excel'}
              </button>
              <InfoPopover
                explanation={{
                title: 'Cảnh báo sớm sắp NQH + ngừng giao dịch > 90 ngày',
                definition:
                  `Khế ước có "Ngày ĐH theo GDXA" nằm trong ${scopeLabel} hiện tại (sau ngày chốt số liệu, OPEN) MÀ khách hàng đã không phát sinh giao dịch (Ngày giao dịch gần nhất) trong > 90 ngày.`,
                formula:
                  `dueSoon${dueSoonScope === 'month' ? 'Thang' : dueSoonScope === 'quarter' ? 'Quy' : 'Nam'} ∩ (refDate − ngayGiaoDichGanNhat > 90 ngày). Sắp xếp tăng dần theo Ngày ĐH GDXA.`,
                note: 'Nhóm này vừa có nguy cơ chuyển NQH cao, vừa khó liên hệ — cần ưu tiên đôn đốc trước khi đến hạn.',
              }}
            />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!ngaySoLieu ? (
            <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">
              Không xác định được ngày chốt số liệu.
            </div>
          ) : list.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">
              Không có khế ước nào thoả điều kiện cảnh báo trong {scopeLabel} hiện tại.
            </div>
          ) : (
            <div className="scrollbar-thin max-h-[640px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                  <tr className="text-left text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Khách hàng</th>
                    <th className="px-4 py-3">Xã · ĐVUT</th>
                    <th className="px-4 py-3">Tổ TK&amp;VV</th>
                    <th className="px-4 py-3">Chương trình</th>
                    <th className="px-4 py-3 text-right">Ngày GD gần nhất</th>
                    <th className="px-4 py-3 text-right">Ngày ĐH GDXA</th>
                    <th className="px-4 py-3 text-right">Ngừng GD (ngày)</th>
                    <th className="px-4 py-3 text-right">Tổng dư nợ</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r, i) => (
                    <tr
                      key={r.soKheUoc || `${r.maKH}-${i}`}
                      onClick={() => setDetail(r)}
                      className="cursor-pointer border-t border-slate-100 hover:bg-purple-50 dark:border-slate-700 dark:hover:bg-purple-900/20"
                    >
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-800 dark:text-slate-100">{r.tenKH}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{r.soKheUoc}</div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                        <div>{r.tenXa || '—'}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{r.tenDVUT || '—'}</div>
                      </td>
                      <td
                        className="max-w-[200px] truncate px-4 py-2.5 text-slate-600 dark:text-slate-300"
                        title={r.tenTo}
                      >
                        {r.tenTo || '—'}
                      </td>
                      <td className="max-w-[240px] truncate px-4 py-2.5 text-slate-600 dark:text-slate-300">
                        {r.tenChuongTrinh || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                        {fmtDate(r.ngayGiaoDichGanNhat)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700 dark:text-slate-200">
                        {fmtDate(r.ngayDHGDXA)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-purple-700 dark:text-purple-300">
                        {r.daysSince}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                        {fmtCurrency(r.tongDuNo)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
        );
      })()}

      {/* Heatmap: lịch sắp đến hạn của các KH ngừng GD > 90 ngày — phân bố
          theo năm-tháng để cán bộ thấy áp lực thu hồi tổng thể. Đặt sau bảng
          cảnh báo để bảng chi tiết hiện trước, heatmap đóng vai trò drill ngược. */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              Lịch sắp đến hạn — KH ngừng GD &gt; 90 ngày
            </CardTitle>
            <div className="flex items-center gap-1">
              <ChartSwitcher
                options={HEAT_OPTS}
                value={dueSoonHeatType}
                onChange={setDueSoonHeatType}
              />
              <InfoPopover
                explanation={{
                  title: 'Lịch sắp đến hạn — KH ngừng GD > 90 ngày',
                  definition:
                    'Khế ước OPEN có "Ngày ĐH theo GDXA" sau ngày chốt số liệu MÀ khách hàng đã không phát sinh giao dịch > 90 ngày, gom theo năm-tháng của ngày đến hạn.',
                  formula:
                    'group_by(year-month(ngayDHGDXA)) trên các khế ước OPEN với ngayDHGDXA > ngày chốt VÀ (refDate − ngayGiaoDichGanNhat) > 90 ngày. Mỗi ô = số khế ước + tổng dư nợ.',
                  note: 'Cùng định nghĩa với card KPI "Dự kiến chuyển NQH (KH ngừng GD > 90d)" và bảng cảnh báo sớm phía trên — chỉ khác cách nhìn theo lịch.',
                }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent id="chart-due-soon-dormant-heatmap">
          <HeatmapMaturity
            data={dueSoonDormantHeatmap}
            chartType={dueSoonHeatType}
            onClick={(ym) => setDueSoonHeatMonth(ym)}
            labels={{
              popoverHeader: 'Sắp đến hạn — KH ngừng GD > 90 ngày',
              popoverFooter:
                'Số khế ước có Ngày ĐH theo GDXA rơi vào tháng này, KH đã ngừng giao dịch > 90 ngày.',
              emptyText: 'Không có khế ước nào thoả điều kiện cảnh báo.',
              caption:
                'Mỗi ô = số khế ước sắp đến hạn (sau ngày chốt) của KH ngừng GD > 90 ngày. Bấm vào ô rồi chọn "Xem danh sách khế ước" để lọc bảng cảnh báo phía trên theo tháng.',
            }}
          />
        </CardContent>
      </Card>

      {/* Dư nợ quá hạn — toggle Xã / ĐVUT / Chương trình. */}
      {(() => {
        const data =
          qhDim === 'xa' ? byXa_QH : qhDim === 'dvut' ? byDVUT_QH : byProgram_QH;
        const drillField =
          qhDim === 'xa' ? 'tenXa' : qhDim === 'dvut' ? 'tenDVUT' : 'tenChuongTrinh';
        const dimLabel =
          qhDim === 'xa' ? 'Xã' : qhDim === 'dvut' ? 'Đơn vị ủy thác' : 'Chương trình tín dụng';
        const infoKey =
          qhDim === 'xa' ? 'chartNplXa' : qhDim === 'dvut' ? 'chartNplDvut' : 'chartNplProgram';
        const colorMode =
          qhDim === 'program' ? 'program' : qhDim === 'dvut' ? 'dvut' : 'rainbow';
        return (
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CardTitle>Dư nợ quá hạn theo {dimLabel}</CardTitle>
              <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-800">
                {([
                  ['xa', 'Xã'],
                  ['dvut', 'ĐVUT'],
                  ['program', 'CT'],
                ] as const).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setQhDim(val)}
                    className={`rounded px-2.5 py-1 font-medium transition-colors ${
                      qhDim === val
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <ChartSwitcher
                options={BAR_GROUP_OPTS}
                value={chartQhType}
                onChange={setChartQhType}
              />
              <InfoPopover metricKey={infoKey} />
            </div>
          </div>
        </CardHeader>
        <CardContent id={`chart-npl-${qhDim}`}>
          {data.length === 0 ? (
            <EmptyNplNote />
          ) : (
            <BarByGroup
              data={data}
              metric="duNoQuaHan"
              tooltipLabel="Dư nợ quá hạn"
              limit={10}
              chartType={chartQhType}
              colorMode={colorMode}
              onClick={(v) => drillTo(drillField, v)}
            />
          )}
        </CardContent>
      </Card>
        );
      })()}

      {/* Row 4: Hotspot — Tỷ lệ NPL cao nhất theo Xã */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-rose-600" />
              <CardTitle>Tỷ lệ nợ quá hạn theo Xã</CardTitle>
            </div>
            <InfoPopover metricKey="chartNplHotspot" />
          </div>
        </CardHeader>
        <CardContent id="chart-npl-hotspot" className="p-0">
          {hotspots.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">
              Không có xã nào có tỷ lệ quá hạn trong phạm vi lọc hiện tại.
            </div>
          ) : (
            <div className="scrollbar-thin max-h-[640px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                  <tr className="text-left text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Xã/Phường</th>
                    <th className="px-4 py-3 text-right">Số khế ước</th>
                    <th className="px-4 py-3 text-right">Dư nợ</th>
                    <th className="px-4 py-3 text-right">Dư nợ QH</th>
                    <th className="px-4 py-3 text-right">Tỷ lệ QH</th>
                  </tr>
                </thead>
                <tbody>
                  {hotspots.map((g, i) => (
                    <tr
                      key={g.key}
                      onClick={() => drillTo('tenXa', g.key)}
                      className="cursor-pointer border-t border-slate-100 hover:bg-rose-50 dark:border-slate-700 dark:hover:bg-rose-900/20"
                    >
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{i + 1}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-100">
                        {g.label || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-700 dark:text-slate-300">
                        {fmtNumber(g.soKheUoc)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-700 dark:text-slate-300">
                        {fmtCurrency(g.tongDuNo)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-rose-700 dark:text-rose-300">
                        {fmtCurrency(g.duNoQuaHan)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
                          {fmtPercent(g.tyLeNoQH)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Row 5: Danh sách khế ước quá hạn (toàn bộ, phân trang 10/trang) */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CardTitle>Danh sách khế ước quá hạn</CardTitle>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {qhSearch
                  ? `${fmtNumber(qhSearchFiltered.length)}/${fmtNumber(qhLoansOnly.length)} khế ước`
                  : `${fmtNumber(qhLoansOnly.length)} khế ước`}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={qhSearch}
                  onChange={(e) => setQhSearch(e.target.value)}
                  placeholder="Tìm tên KH, mã KH, số khế ước, xã, ĐVUT…"
                  aria-label="Tìm trong danh sách khế ước quá hạn"
                  className="w-64 rounded-md border border-slate-200 bg-white py-1 pl-7 pr-2 text-[11px] text-slate-700 placeholder:text-slate-400 focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500"
                />
              </div>
              <button
                type="button"
                onClick={handleExportQh}
                disabled={exporting || qhLoansOnly.length === 0}
                title={
                  qhLoansOnly.length === 0
                    ? 'Không có khế ước quá hạn để xuất'
                    : `Xuất ${qhLoansOnly.length} khế ước quá hạn ra Excel`
                }
                aria-label="Xuất danh sách NPL ra Excel"
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors',
                  exporting || qhLoansOnly.length === 0
                    ? 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                    : 'bg-rose-600 text-white hover:bg-rose-700'
                )}
              >
                <Download className={cn('h-3.5 w-3.5', exporting && 'animate-pulse')} />
                {exporting ? 'Đang xuất…' : 'Xuất Excel'}
              </button>
              <InfoPopover metricKey="chartNplTop" />
            </div>
          </div>
        </CardHeader>
        <CardContent id="chart-npl-top" className="p-0">
          {qhLoansOnly.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">
              Không có khế ước quá hạn trong phạm vi lọc.
            </div>
          ) : qhSearchFiltered.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">
              Không có khế ước nào khớp từ khóa "{qhSearch}".
            </div>
          ) : (
            <>
              <div className="scrollbar-thin overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                    <tr className="text-left text-slate-500 dark:text-slate-400">
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Khách hàng</th>
                      <th className="px-4 py-3">Xã · ĐVUT</th>
                      <th className="px-4 py-3">Tổ TK&VV</th>
                      <th className="px-4 py-3">Chương trình</th>
                      <th className="px-4 py-3 text-right">Ngày chuyển NQH</th>
                      <th className="px-4 py-3 text-right">Mức vay</th>
                      <th className="px-4 py-3 text-right">Dư nợ QH</th>
                      <th className="px-4 py-3 text-right">Dư nợ khoanh</th>
                      <th className="px-4 py-3 text-right">Lãi tồn QH</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qhPaged.map((r, i) => {
                      const idx = qhCurrentPage * QH_PAGE_SIZE + i + 1;
                      return (
                        <tr
                          key={r.soKheUoc || `${r.maKH}-${idx}`}
                          onClick={() => setDetail(r)}
                          className="cursor-pointer border-t border-slate-100 hover:bg-rose-50 dark:border-slate-700 dark:hover:bg-rose-900/20"
                        >
                          <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{idx}</td>
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-slate-800 dark:text-slate-100">
                              {r.tenKH}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {r.soKheUoc}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                            <div>{r.tenXa || '—'}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {r.tenDVUT || '—'}
                            </div>
                          </td>
                          <td
                            className="max-w-[180px] truncate px-4 py-2.5 text-slate-600 dark:text-slate-300"
                            title={r.tenTo}
                          >
                            {r.tenTo || '—'}
                          </td>
                          <td className="max-w-[240px] truncate px-4 py-2.5 text-slate-600 dark:text-slate-300">
                            {r.tenChuongTrinh}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-300">
                            {fmtDate(r.ngayDHGDXA)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-700 dark:text-slate-300">
                            {fmtCurrency(r.mucVay)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-rose-700 dark:text-rose-300">
                            {fmtCurrency(r.duNoQuaHan)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-amber-700 dark:text-amber-300">
                            {fmtCurrency(r.duNoKhoanh)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-700 dark:text-slate-300">
                            {fmtCurrency(r.laiTonQH)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <div>
                  Hiển thị{' '}
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {qhCurrentPage * QH_PAGE_SIZE + 1}
                    {'–'}
                    {qhCurrentPage * QH_PAGE_SIZE + qhPaged.length}
                  </span>{' '}
                  trên {fmtNumber(qhSearchFiltered.length)} khế ước
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setQhPage((p) => Math.max(0, p - 1))}
                    disabled={qhCurrentPage === 0}
                    aria-label="Trang trước"
                    className={cn(
                      'inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 dark:border-slate-700',
                      qhCurrentPage === 0
                        ? 'cursor-not-allowed text-slate-300 dark:text-slate-600'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                    )}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="px-1">
                    Trang{' '}
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {qhCurrentPage + 1}
                    </span>
                    /{qhTotalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQhPage((p) => Math.min(qhTotalPages - 1, p + 1))}
                    disabled={qhCurrentPage >= qhTotalPages - 1}
                    aria-label="Trang sau"
                    className={cn(
                      'inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 dark:border-slate-700',
                      qhCurrentPage >= qhTotalPages - 1
                        ? 'cursor-not-allowed text-slate-300 dark:text-slate-600'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                    )}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <LoanDetailDrawer record={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function EmptyNplNote() {
  return (
    <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">
      Không có dư nợ quá hạn trong phạm vi lọc hiện tại.
    </div>
  );
}

/**
 * Card "Dự kiến chuyển NQH trong tháng/quý" — biến thể 2 cột của KpiCard.
 * Tone purple (forecast) vì là dự báo nguy cơ — tách biệt khỏi nhóm đã phát sinh (đỏ).
 */
function DueSoonCard({
  thangCount,
  thangDuNo,
  quyCount,
  quyDuNo,
  namCount,
  namDuNo,
}: {
  thangCount: number;
  thangDuNo: number;
  quyCount: number;
  quyDuNo: number;
  namCount: number;
  namDuNo: number;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-purple-50 p-4 shadow-md shadow-slate-200/60 dark:bg-purple-500/10 dark:shadow-slate-950/40">
      <span className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-black/5 dark:bg-white/5" />
      <div className="absolute right-2 top-2 z-10">
        <InfoPopover
          explanation={{
            title: 'Dự kiến chuyển NQH (KH ngừng GD > 90 ngày)',
            definition:
              'Khế ước có "Ngày ĐH theo GDXA" sắp đến (sau ngày chốt số liệu, OPEN) MÀ khách hàng đã ngừng giao dịch > 90 ngày. Nhóm này có nguy cơ chuyển NQH cao nhất vì vừa sắp đến hạn vừa khó liên hệ.',
            formula:
              'Tháng = ngayDHGDXA cùng tháng+năm với ngày chốt VÀ > ngày chốt VÀ (refDate − ngayGiaoDichGanNhat) > 90 ngày. Quý = cùng quý+năm. Năm = cùng năm. Đếm khế ước + tổng dư nợ.',
            note: 'Chi tiết danh sách ở bảng cảnh báo bên dưới.',
          }}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-purple-800 dark:text-purple-300">
          Dự kiến chuyển NQH (KH ngừng GD &gt; 90d)
        </div>
        <div className="rounded-full bg-purple-200 p-1.5 text-purple-900 dark:bg-purple-500/20 dark:text-purple-200">
          <CalendarClock className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-purple-700/80 dark:text-purple-300/80">
            Tháng
          </div>
          <div className="truncate text-lg font-bold tracking-tight text-purple-800 dark:text-purple-200">
            {fmtCompact(thangDuNo)}
          </div>
          <div className="text-[10px] text-purple-700/70 dark:text-purple-300/70">
            {fmtNumber(thangCount)} khế ước
          </div>
        </div>
        <div className="min-w-0 border-l border-purple-200 pl-3 dark:border-purple-500/25">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-purple-700/80 dark:text-purple-300/80">
            Quý
          </div>
          <div className="truncate text-lg font-bold tracking-tight text-purple-800 dark:text-purple-200">
            {fmtCompact(quyDuNo)}
          </div>
          <div className="text-[10px] text-purple-700/70 dark:text-purple-300/70">
            {fmtNumber(quyCount)} khế ước
          </div>
        </div>
        <div className="min-w-0 border-l border-purple-200 pl-3 dark:border-purple-500/25">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-purple-700/80 dark:text-purple-300/80">
            Năm
          </div>
          <div className="truncate text-lg font-bold tracking-tight text-purple-800 dark:text-purple-200">
            {fmtCompact(namDuNo)}
          </div>
          <div className="text-[10px] text-purple-700/70 dark:text-purple-300/70">
            {fmtNumber(namCount)} khế ước
          </div>
        </div>
      </div>
    </div>
  );
}
