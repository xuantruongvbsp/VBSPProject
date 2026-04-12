import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Banknote,
  Users,
  AlertTriangle,
  Snowflake,
  Coins,
  TrendingUp,
  UserX,
  FileText,
  Download,
  AlignLeft,
  BarChart2,
  BarChart3,
  Percent,
  LayoutGrid,
  PieChart as PieChartIcon,
  Activity,
  Table,
} from 'lucide-react';
import { applyFilters, useDataStore, type FilterField } from '@/store/useDataStore';
import {
  computeKpi,
  groupBy,
  histogramMucVay,
  timeSeriesGiaiNgan,
  heatmapDaoHan,
  dormantCustomers,
} from '@/lib/metrics';
import { fmtCompact, fmtCurrency, fmtDate, fmtNumber, fmtPercent } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';
import { InfoPopover } from '@/components/ui/InfoPopover';
import { ExportMenu } from '@/components/export/ExportMenu';
import { exportDormantToXlsx } from '@/lib/export-xlsx';
import { FilterBar } from '@/components/filters/FilterBar';
import { BarByGroup } from '@/components/charts/BarByGroup';
import { DonutByField } from '@/components/charts/DonutByField';
import { StackedStatus } from '@/components/charts/StackedStatus';
import { LineDisbursement } from '@/components/charts/LineDisbursement';
import { HistogramAmount } from '@/components/charts/HistogramAmount';
import { HeatmapMaturity } from '@/components/charts/HeatmapMaturity';
import { LoanDetailDrawer } from '@/components/detail/LoanDetailDrawer';
import { ChartSwitcher, type ChartTypeOption } from '@/components/ui/ChartSwitcher';
import type { StackedChartType } from '@/components/charts/StackedStatus';
import type { BarGroupChartType } from '@/components/charts/BarByGroup';
import type { DonutChartType } from '@/components/charts/DonutByField';
import type { LineChartType } from '@/components/charts/LineDisbursement';
import type { HistogramChartType } from '@/components/charts/HistogramAmount';
import type { HeatmapChartType } from '@/components/charts/HeatmapMaturity';
import { cn } from '@/lib/utils';
import type { LoanRecord } from '@/lib/types';

/* ── Chart type options ────────────────────────────────────────────── */
const STACKED_OPTS: ChartTypeOption<StackedChartType>[] = [
  { id: 'stacked', icon: AlignLeft, tooltip: 'Thanh xếp chồng' },
  { id: 'grouped', icon: BarChart3, tooltip: 'Thanh nhóm' },
  { id: 'percent', icon: Percent, tooltip: 'Thanh tỷ lệ 100%' },
  { id: 'treemap', icon: LayoutGrid, tooltip: 'Bản đồ cây' },
];
const BAR_GROUP_OPTS: ChartTypeOption<BarGroupChartType>[] = [
  { id: 'bar', icon: AlignLeft, tooltip: 'Biểu đồ thanh' },
  { id: 'treemap', icon: LayoutGrid, tooltip: 'Bản đồ cây' },
];
const DONUT_OPTS: ChartTypeOption<DonutChartType>[] = [
  { id: 'donut', icon: PieChartIcon, tooltip: 'Biểu đồ tròn' },
  { id: 'bar', icon: BarChart2, tooltip: 'Biểu đồ cột' },
  { id: 'hbar', icon: AlignLeft, tooltip: 'Thanh ngang' },
  { id: 'treemap', icon: LayoutGrid, tooltip: 'Bản đồ cây' },
];
const LINE_OPTS: ChartTypeOption<LineChartType>[] = [
  { id: 'area', icon: Activity, tooltip: 'Biểu đồ vùng' },
  { id: 'line', icon: TrendingUp, tooltip: 'Biểu đồ đường' },
  { id: 'bar', icon: BarChart2, tooltip: 'Biểu đồ cột' },
];
const HIST_OPTS: ChartTypeOption<HistogramChartType>[] = [
  { id: 'bar', icon: BarChart2, tooltip: 'Biểu đồ cột' },
  { id: 'hbar', icon: AlignLeft, tooltip: 'Thanh ngang' },
  { id: 'area', icon: Activity, tooltip: 'Biểu đồ vùng' },
];
const HEAT_OPTS: ChartTypeOption<HeatmapChartType>[] = [
  { id: 'heatmap', icon: Table, tooltip: 'Bảng nhiệt' },
  { id: 'stackedBar', icon: BarChart2, tooltip: 'Cột xếp chồng theo năm' },
];

/**
 * Các khoảng phân nhóm khách hàng ngừng giao dịch (đơn vị: tháng).
 * - Tab `all` (mặc định): ≥ 3 tháng — khớp với chỉ tiêu KPI ở thanh trên,
 *   đóng vai trò "trở về tổng quan" khi người dùng muốn bỏ chọn một nhóm con.
 * - Các tab còn lại là khoảng nửa mở [min, max) để không có khách hàng nào
 *   bị đếm trùng giữa hai nhóm liền kề.
 * `max = null` nghĩa là không giới hạn trên (≥ minMonths).
 */
const DORMANT_BUCKETS = [
  { id: 'all', label: '≥ 3 tháng', min: 3, max: null },
  { id: '2-3', label: '2 – 3 tháng', min: 2, max: 3 },
  { id: '3-6', label: '3 – 6 tháng', min: 3, max: 6 },
  { id: '6-12', label: '6 – 12 tháng', min: 6, max: 12 },
  { id: '12+', label: '≥ 12 tháng', min: 12, max: null },
] as const;
type DormantBucketId = (typeof DORMANT_BUCKETS)[number]['id'];

export function OverviewPage() {
  const { rows, filters, ranges, search, ngaySoLieu, drillDown, drillDownRange } =
    useDataStore();
  const navigate = useNavigate();
  const [donutField, setDonutField] = useState<'phanLoai' | 'gioiTinh' | 'tenDanToc'>(
    'phanLoai'
  );
  const [dormantBucket, setDormantBucket] = useState<DormantBucketId>('all');
  const [detail, setDetail] = useState<LoanRecord | null>(null);
  const [dormantExporting, setDormantExporting] = useState(false);
  const [stackedType, setStackedType] = useState<StackedChartType>('stacked');
  const [barGroupType, setBarGroupType] = useState<BarGroupChartType>('bar');
  const [donutType, setDonutType] = useState<DonutChartType>('donut');
  const [lineType, setLineType] = useState<LineChartType>('area');
  const [histType, setHistType] = useState<HistogramChartType>('bar');
  const [heatType, setHeatType] = useState<HeatmapChartType>('heatmap');

  // Drill-down: áp bộ lọc theo trường rồi điều hướng sang Tra cứu chi tiết.
  const drillTo = useCallback(
    (field: FilterField, value: string) => {
      drillDown(field, value);
      navigate('/snapshot/du-lieu');
    },
    [drillDown, navigate]
  );

  // Drill-down theo khoảng giá trị mức vay (histogram).
  const drillByMucVay = useCallback(
    (range: [number, number]) => {
      // Infinity không tuần tự hóa được — clamp về một mức hợp lý
      const upper = Number.isFinite(range[1]) ? range[1] : Number.MAX_SAFE_INTEGER;
      drillDownRange('mucVay', [range[0], upper]);
      navigate('/snapshot/du-lieu');
    },
    [drillDownRange, navigate]
  );

  // Drill-down theo tháng giải ngân (line chart).
  const drillByMonth = useCallback(
    (ym: string) => {
      // ym ở dạng "YYYY-MM" — quy đổi thành đoạn ISO yyyy-mm-dd
      const [yStr, mStr] = ym.split('-');
      const y = Number(yStr);
      const m = Number(mStr);
      if (!y || !m) return;
      const start = `${yStr}-${mStr}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${yStr}-${mStr}-${String(lastDay).padStart(2, '0')}`;
      drillDownRange('ngayVay', [start, end]);
      navigate('/snapshot/du-lieu');
    },
    [drillDownRange, navigate]
  );

  // Drill-down theo tháng đáo hạn (heatmap).
  const drillByMaturity = useCallback(
    (ym: string) => {
      const [yStr, mStr] = ym.split('-');
      const y = Number(yStr);
      const m = Number(mStr);
      if (!y || !m) return;
      const start = `${yStr}-${mStr}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${yStr}-${mStr}-${String(lastDay).padStart(2, '0')}`;
      drillDownRange('ngayDaoHan', [start, end]);
      navigate('/snapshot/du-lieu');
    },
    [drillDownRange, navigate]
  );

  const filtered = useMemo(
    () => applyFilters(rows, filters, ranges, search),
    [rows, filters, ranges, search]
  );

  const kpi = useMemo(() => computeKpi(filtered), [filtered]);
  const byProgram = useMemo(() => groupBy(filtered, 'tenChuongTrinh'), [filtered]);
  const byDVUT = useMemo(() => groupBy(filtered, 'tenDVUT'), [filtered]);
  const byClassification = useMemo(() => groupBy(filtered, donutField), [filtered, donutField]);
  const histogram = useMemo(() => histogramMucVay(filtered), [filtered]);
  const ts = useMemo(() => timeSeriesGiaiNgan(filtered), [filtered]);
  const maturity = useMemo(() => heatmapDaoHan(filtered), [filtered]);
  const topKH = useMemo(
    () => [...filtered].sort((a, b) => b.tongDuNo - a.tongDuNo).slice(0, 20),
    [filtered]
  );
  // KPI: số khách hàng ngừng giao dịch ≥ 3 tháng (không giới hạn trên)
  const dormantKpiCount = useMemo(
    () => dormantCustomers(filtered, 3, ngaySoLieu).length,
    [filtered, ngaySoLieu]
  );
  // Bảng chi tiết: phân theo khoảng tháng nửa mở [min, max)
  const dormant = useMemo(() => {
    const bucket = DORMANT_BUCKETS.find((b) => b.id === dormantBucket)!;
    return dormantCustomers(filtered, bucket.min, ngaySoLieu, bucket.max);
  }, [filtered, dormantBucket, ngaySoLieu]);

  // Xuất bảng "Khách hàng ngừng giao dịch" theo đúng khoảng tháng đang chọn.
  const handleExportDormant = useCallback(async () => {
    if (dormantExporting || dormant.length === 0) return;
    const bucket = DORMANT_BUCKETS.find((b) => b.id === dormantBucket)!;
    setDormantExporting(true);
    try {
      await exportDormantToXlsx({
        customers: dormant,
        bucketLabel: bucket.label,
        referenceDate: ngaySoLieu,
        totalFilteredRows: filtered.length,
      });
    } catch (e) {
      console.error('Xuất danh sách khách hàng ngừng giao dịch thất bại:', e);
    } finally {
      setDormantExporting(false);
    }
  }, [dormant, dormantBucket, dormantExporting, filtered.length, ngaySoLieu]);

  return (
    <div className="space-y-5 p-6">
      <header className="space-y-3">
        <div>
          <ExportMenu
            pageTitle="Tổng quan danh mục tín dụng"
            subtitle={`${filtered.length.toLocaleString('vi-VN')} khế ước`}
            rows={filtered}
            kpi={kpi}
            chartSelectors={[
              '#chart-dvut',
              '#chart-program',
              '#chart-histogram',
              '#chart-timeseries',
              '#chart-customer-structure',
              '#chart-maturity',
              '#chart-top-customers',
              '#chart-dormant',
            ]}
            size="sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Tổng quan danh mục tín dụng</h1>
          <InfoPopover metricKey="pageOverview" />
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Thống kê toàn bộ {filtered.length.toLocaleString('vi-VN')} khế ước theo các bộ lọc đang
          áp dụng
        </p>
      </header>

      <Card>
        <CardContent className="py-3">
          <FilterBar />
        </CardContent>
      </Card>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-4">
        <KpiCard
          label="Tổng dư nợ"
          value={kpi.tongDuNo}
          tone="primary"
          icon={<Banknote className="h-4 w-4" />}
          formatter={fmtCompact}
          caption={`${kpi.soKheUoc.toLocaleString('vi-VN')} khế ước`}
          infoKey="tongDuNo"
        />
        <KpiCard
          label="Khách hàng"
          value={kpi.soKhachHang}
          tone="default"
          icon={<Users className="h-4 w-4" />}
          caption="Số khách hàng còn dư nợ"
          infoKey="khachHang"
        />
        <KpiCard
          label="Tổng giải ngân lũy kế"
          value={kpi.tongGiaiNgan}
          tone="success"
          icon={<TrendingUp className="h-4 w-4" />}
          formatter={fmtCompact}
          infoKey="giaiNganLuyKe"
        />
        <KpiCard
          label="Mức vay bình quân"
          value={kpi.mucVayBQ}
          tone="default"
          icon={<FileText className="h-4 w-4" />}
          formatter={fmtCompact}
          infoKey="mucVayBinhQuan"
        />
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
          label="Dư nợ khoanh"
          value={kpi.duNoKhoanh}
          tone="warning"
          icon={<Snowflake className="h-4 w-4" />}
          formatter={fmtCompact}
          infoKey="duNoKhoanh"
        />
        <KpiCard
          label="Lãi tồn trong hạn"
          value={kpi.laiTonTH}
          tone="default"
          icon={<Coins className="h-4 w-4" />}
          formatter={fmtCompact}
          infoKey="laiTonTrongHan"
        />
        <KpiCard
          label="Khách hàng ngừng giao dịch"
          value={dormantKpiCount}
          tone="warning"
          icon={<UserX className="h-4 w-4" />}
          caption="Không giao dịch ≥ 3 tháng"
          infoKey="khachHangNgungGiaoDich"
        />
      </div>

      {/* Row 1: ĐVUT + Programs */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Dư nợ theo Đơn vị ủy thác</CardTitle>
              <div className="flex items-center gap-1">
                <ChartSwitcher options={STACKED_OPTS} value={stackedType} onChange={setStackedType} />
                <InfoPopover metricKey="chartDvut" />
              </div>
            </div>
          </CardHeader>
          <CardContent id="chart-dvut">
            <StackedStatus
              data={byDVUT}
              limit={6}
              onClick={(v) => drillTo('tenDVUT', v)}
              chartType={stackedType}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Dư nợ theo Chương trình tín dụng</CardTitle>
              <div className="flex items-center gap-1">
                <ChartSwitcher options={BAR_GROUP_OPTS} value={barGroupType} onChange={setBarGroupType} />
                <InfoPopover metricKey="chartProgram" />
              </div>
            </div>
          </CardHeader>
          <CardContent id="chart-program">
            <BarByGroup
              data={byProgram}
              limit={10}
              onClick={(v) => drillTo('tenChuongTrinh', v)}
              chartType={barGroupType}
            />
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Histogram (toàn bộ chiều ngang) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Phân bố mức vay</CardTitle>
            <div className="flex items-center gap-1">
              <ChartSwitcher options={HIST_OPTS} value={histType} onChange={setHistType} />
              <InfoPopover metricKey="chartHistogram" />
            </div>
          </div>
        </CardHeader>
        <CardContent id="chart-histogram">
          <HistogramAmount
            data={histogram}
            onClick={(b) => drillByMucVay([b.min, b.max])}
            chartType={histType}
          />
        </CardContent>
      </Card>

      {/* Row 3: Time series + Donut */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Giải ngân theo thời gian (theo tháng)</CardTitle>
              <div className="flex items-center gap-1">
                <ChartSwitcher options={LINE_OPTS} value={lineType} onChange={setLineType} />
                <InfoPopover metricKey="chartTimeSeries" />
              </div>
            </div>
          </CardHeader>
          <CardContent id="chart-timeseries">
            <LineDisbursement data={ts} onClick={drillByMonth} chartType={lineType} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Cơ cấu khách hàng</CardTitle>
              <div className="flex items-center gap-1">
                <ChartSwitcher options={DONUT_OPTS} value={donutType} onChange={setDonutType} />
                <select
                  value={donutField}
                  onChange={(e) => setDonutField(e.target.value as any)}
                  className="h-7 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 text-[11px] text-slate-700 dark:text-slate-200 outline-none focus:border-brand-400 dark:focus:border-brand-500"
                >
                  <option value="phanLoai">Theo phân loại</option>
                  <option value="gioiTinh">Theo giới tính</option>
                  <option value="tenDanToc">Theo dân tộc</option>
                </select>
                <InfoPopover metricKey="chartCustomerStructure" />
              </div>
            </div>
          </CardHeader>
          <CardContent id="chart-customer-structure">
            <DonutByField
              data={byClassification}
              onClick={(v) => drillTo(donutField as FilterField, v)}
              chartType={donutType}
            />
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Maturity heatmap + Top KH */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Lịch đáo hạn theo tháng</CardTitle>
              <div className="flex items-center gap-1">
                <ChartSwitcher options={HEAT_OPTS} value={heatType} onChange={setHeatType} />
                <InfoPopover metricKey="chartMaturity" />
              </div>
            </div>
          </CardHeader>
          <CardContent id="chart-maturity">
            <HeatmapMaturity data={maturity} chartType={heatType} onClick={drillByMaturity} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Top 20 khách hàng theo dư nợ</CardTitle>
              <InfoPopover metricKey="chartTopCustomers" />
            </div>
          </CardHeader>
          <CardContent id="chart-top-customers" className="p-0">
            <div className="scrollbar-thin max-h-[420px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                  <tr className="text-left text-slate-500 dark:text-slate-400">
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Khách hàng</th>
                    <th className="px-3 py-2 text-right">Tổng dư nợ</th>
                  </tr>
                </thead>
                <tbody>
                  {topKH.map((r, i) => (
                    <tr
                      key={r.soKheUoc + i}
                      onClick={() => setDetail(r)}
                      className="cursor-pointer border-t border-slate-100 dark:border-slate-700 hover:bg-brand-50 dark:hover:bg-brand-900/20"
                    >
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{i + 1}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-800 dark:text-slate-100">{r.tenKH}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {r.tenPGD} · {r.tenDVUT}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-900 dark:text-slate-100">
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

      {/* Row 5: Khách hàng ngừng giao dịch */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CardTitle>Khách hàng ngừng giao dịch</CardTitle>
              <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                {fmtNumber(dormant.length)} khách hàng
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-slate-500">
                Khoảng thời gian không phát sinh giao dịch
              </span>
              <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs dark:border-slate-600 dark:bg-slate-700">
                {DORMANT_BUCKETS.map((b) => {
                  const active = dormantBucket === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setDormantBucket(b.id)}
                      className={cn(
                        'rounded px-3 py-1 font-medium transition-colors',
                        active
                          ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100'
                      )}
                    >
                      {b.label}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={handleExportDormant}
                disabled={dormantExporting || dormant.length === 0}
                title={
                  dormant.length === 0
                    ? 'Không có dữ liệu để xuất'
                    : `Xuất danh sách (${DORMANT_BUCKETS.find((b) => b.id === dormantBucket)?.label})`
                }
                aria-label="Xuất khách hàng ngừng giao dịch"
                className={cn(
                  'inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 text-[11px] font-medium text-slate-600 dark:text-slate-300 shadow-sm transition-colors',
                  'hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:hover:border-brand-500 dark:hover:bg-brand-900/30 dark:hover:text-brand-300',
                  'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-200 dark:disabled:hover:border-slate-600 disabled:hover:bg-white dark:disabled:hover:bg-slate-800 disabled:hover:text-slate-600 dark:disabled:hover:text-slate-300'
                )}
              >
                <Download className={cn('h-3.5 w-3.5', dormantExporting && 'animate-pulse')} />
                {dormantExporting ? 'Đang xuất…' : 'Xuất Excel'}
              </button>
              <InfoPopover metricKey="chartDormantCustomers" />
            </div>
          </div>
        </CardHeader>
        <CardContent id="chart-dormant" className="p-0">
          {!ngaySoLieu ? (
            <div className="px-5 py-12 text-center text-xs text-slate-400">
              Chưa có ngày chốt số liệu — vui lòng nhập tệp Báo cáo 31 trước.
            </div>
          ) : dormant.length === 0 ? (
            <div className="px-5 py-12 text-center text-xs text-slate-400">
              Không có khách hàng nào ngừng giao dịch trong khoảng{' '}
              {DORMANT_BUCKETS.find((b) => b.id === dormantBucket)?.label} theo bộ lọc hiện tại.
            </div>
          ) : (
            <div className="scrollbar-thin max-h-[480px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                  <tr className="text-left text-slate-500 dark:text-slate-400">
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Khách hàng</th>
                    <th className="px-3 py-2">PGD · ĐVUT</th>
                    <th className="px-3 py-2">Chương trình</th>
                    <th className="px-3 py-2 text-right">Số khế ước</th>
                    <th className="px-3 py-2 text-right">Tổng dư nợ</th>
                    <th className="px-3 py-2 text-right">Hoạt động cuối</th>
                    <th className="px-3 py-2 text-right">Số ngày</th>
                  </tr>
                </thead>
                <tbody>
                  {dormant.slice(0, 200).map((d, i) => {
                    const record = filtered.find((r) => r.maKH === d.maKH) ?? null;
                    return (
                      <tr
                        key={d.maKH}
                        onClick={() => record && setDetail(record)}
                        className="cursor-pointer border-t border-slate-100 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                      >
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{i + 1}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-800 dark:text-slate-100">{d.tenKH}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">{d.maKH}</div>
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                          <div>{d.tenPGD}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">{d.tenDVUT}</div>
                        </td>
                        <td className="max-w-[220px] truncate px-3 py-2 text-slate-600 dark:text-slate-300">
                          {d.tenChuongTrinh}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                          {fmtNumber(d.soKheUoc)}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-900 dark:text-slate-100">
                          {fmtCurrency(d.tongDuNo)}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">
                          {fmtDate(d.ngayHoatDongCuoi)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                            {fmtNumber(d.daysSince)} ngày
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {dormant.length > 200 && (
                <div className="border-t border-slate-100 dark:border-slate-700 px-3 py-2 text-center text-[10px] text-slate-500 dark:text-slate-400">
                  Hiển thị 200 / {fmtNumber(dormant.length)} khách hàng. Sử dụng bộ lọc phía trên
                  để thu hẹp danh sách.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <LoanDetailDrawer record={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
