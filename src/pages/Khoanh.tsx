import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Snowflake,
  Users,
  Percent,
  CalendarClock,
  AlignLeft,
  LayoutGrid,
  PieChart,
  FileWarning,
  Download,
} from 'lucide-react';
import { applyFilters, useDataStore, type FilterField } from '@/store/useDataStore';
import { computeKpi, groupBy, heatmapKhoanhExpiry, type GroupAgg } from '@/lib/metrics';
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
  { id: 'heatmap', icon: LayoutGrid, tooltip: 'Lưới nhiệt' },
  { id: 'stackedBar', icon: AlignLeft, tooltip: 'Cột chồng theo năm' },
];

/**
 * Trang "Báo cáo Dư nợ khoanh" — phân tích riêng phần dư nợ đang được
 * khoanh (tạm dừng tính lãi, chờ xử lý). Cùng cấp với Tổng quan và NPL
 * trong menu trái. Tất cả thống kê dùng bộ lọc hiện hành trên FilterBar.
 */
export function KhoanhPage() {
  const { rows, filters, ranges, search, ngaySoLieu, depositByKH, drillDown } = useDataStore();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<LoanRecord | null>(null);
  const [chartDvutType, setChartDvutType] = useState<BarGroupChartType>('pie');
  const [chartXaType, setChartXaType] = useState<BarGroupChartType>('bar');
  const [chartProgramType, setChartProgramType] = useState<BarGroupChartType>('bar');
  const [groupDimension, setGroupDimension] = useState<'dvut' | 'xa' | 'program'>('dvut');
  const [heatType, setHeatType] = useState<HeatmapChartType>('heatmap');
  const [exporting, setExporting] = useState(false);

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

  const kpi = useMemo(() => computeKpi(filtered, depositByKH), [filtered, depositByKH]);

  // Chỉ các khế ước có dư nợ khoanh > 0
  const khoanhLoans = useMemo(
    () => filtered.filter((r) => r.duNoKhoanh > 0),
    [filtered]
  );

  const khoanhLoansCount = khoanhLoans.length;
  const khoanhKhCount = useMemo(() => {
    const s = new Set<string>();
    for (const r of khoanhLoans) if (r.maKH) s.add(r.maKH);
    return s.size;
  }, [khoanhLoans]);

  // Tỷ lệ khoanh trên tổng dư nợ
  const tyLeKhoanh = kpi.tongDuNo > 0 ? (kpi.duNoKhoanh / kpi.tongDuNo) * 100 : 0;

  // Số khế ước hết hạn khoanh trong năm chốt số liệu — đếm theo
  // ngayHetHanKhoanh thuộc cùng năm với ngaySoLieu.
  const expiringThisYearCount = useMemo(() => {
    const y = ngaySoLieu?.getFullYear();
    if (y == null) return 0;
    let n = 0;
    for (const r of khoanhLoans) {
      const d = r.ngayHetHanKhoanh;
      if (d != null && d.getFullYear() === y) n++;
    }
    return n;
  }, [khoanhLoans, ngaySoLieu]);

  // KH có ≥ 2 khế ước khoanh — dấu hiệu rủi ro tập trung ở cấp khách hàng
  const khMultipleKhoanh = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of khoanhLoans) {
      if (!r.maKH) continue;
      counts.set(r.maKH, (counts.get(r.maKH) || 0) + 1);
    }
    let n = 0;
    for (const c of counts.values()) if (c >= 2) n++;
    return n;
  }, [khoanhLoans]);

  const byXa = useMemo(() => groupBy(filtered, 'tenXa'), [filtered]);
  const byDVUT = useMemo(() => groupBy(filtered, 'tenDVUT'), [filtered]);
  const byProgram = useMemo(() => groupBy(filtered, 'tenChuongTrinh'), [filtered]);

  const sortByKhoanh = (arr: GroupAgg[]) =>
    [...arr].filter((g) => g.duNoKhoanh > 0).sort((a, b) => b.duNoKhoanh - a.duNoKhoanh);
  const byXa_K = useMemo(() => sortByKhoanh(byXa), [byXa]);
  const byDVUT_K = useMemo(() => sortByKhoanh(byDVUT), [byDVUT]);
  const byProgram_K = useMemo(() => sortByKhoanh(byProgram), [byProgram]);

  // Khi user bấm 1 ô trên heatmap "Lịch hết hạn khoanh", lưu lại "YYYY-MM"
  // để bảng Top 20 phía dưới chỉ liệt kê khế ước rơi vào tháng đó.
  const [khoanhExpiryMonth, setKhoanhExpiryMonth] = useState<string | null>(null);

  // Top 20 khế ước có dư nợ khoanh lớn nhất — khi có tháng được chọn từ
  // heatmap, lọc trước theo ngayHetHanKhoanh thuộc tháng đó (không cắt
  // top 20 vì lát cắt theo tháng thường ít món, người dùng muốn xem hết).
  const topKhoanh = useMemo(() => {
    const sorted = [...khoanhLoans].sort((a, b) => b.duNoKhoanh - a.duNoKhoanh);
    if (!khoanhExpiryMonth) return sorted.slice(0, 20);
    const [yStr, mStr] = khoanhExpiryMonth.split('-');
    const y = Number(yStr);
    const m = Number(mStr) - 1;
    return sorted.filter((r) => {
      const d = r.ngayHetHanKhoanh;
      return d != null && d.getFullYear() === y && d.getMonth() === m;
    });
  }, [khoanhLoans, khoanhExpiryMonth]);

  // Lịch hết hạn khoanh theo tháng
  const khoanhExpiry = useMemo(() => heatmapKhoanhExpiry(filtered), [filtered]);

  // Khi đổi sang tháng khác (hoặc bỏ chọn), cuộn bảng Top 20 vào tầm nhìn
  // — UX giống Overview maturity heatmap khi drill xuống Explorer.
  const handleSelectKhoanhMonth = useCallback((ym: string) => {
    setKhoanhExpiryMonth(ym);
    requestAnimationFrame(() => {
      document
        .getElementById('chart-khoanh-top')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const handleExportKhoanh = useCallback(async () => {
    if (exporting || khoanhLoans.length === 0) return;
    setExporting(true);
    try {
      await exportBadDebtToXlsx({
        kind: 'khoanh',
        loans: khoanhLoans,
        referenceDate: ngaySoLieu,
        totalFilteredRows: filtered.length,
      });
    } catch (e) {
      console.error('Xuất danh sách khoanh thất bại:', e);
    } finally {
      setExporting(false);
    }
  }, [exporting, khoanhLoans, ngaySoLieu, filtered.length]);

  // Hotspot: xã có tỷ lệ khoanh (duNoKhoanh / tongDuNo) cao nhất, ≥ 3 khế ước
  const hotspots = useMemo(() => {
    return byXa
      .filter((g) => g.soKheUoc >= 3 && g.duNoKhoanh > 0 && g.tongDuNo > 0)
      .map((g) => ({ ...g, tyLeKhoanh: (g.duNoKhoanh / g.tongDuNo) * 100 }))
      .sort((a, b) => b.tyLeKhoanh - a.tyLeKhoanh)
      .slice(0, 15);
  }, [byXa]);

  return (
    <div className="space-y-5 p-6">
      <header className="space-y-3">
        <div>
          <ExportMenu
            pageTitle="Báo cáo Dư nợ khoanh"
            subtitle={`${khoanhLoansCount.toLocaleString('vi-VN')} khế ước khoanh / ${filtered.length.toLocaleString('vi-VN')} khế ước`}
            rows={khoanhLoans}
            kpi={kpi}
            chartSelectors={[
              '#chart-khoanh-group',
              '#chart-khoanh-hotspot',
              '#chart-khoanh-top',
            ]}
            size="sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Báo cáo Dư nợ khoanh
          </h1>
          <InfoPopover metricKey="pageKhoanh" />
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Thống kê chi tiết dư nợ đang được khoanh (tạm dừng tính lãi, chờ xử lý) trên{' '}
          {filtered.length.toLocaleString('vi-VN')} khế ước theo bộ lọc hiện hành.
        </p>
      </header>

      <Card>
        <CardContent className="py-3">
          <FilterBar />
        </CardContent>
      </Card>

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Dư nợ khoanh"
          value={kpi.duNoKhoanh}
          tone="frozen"
          icon={<Snowflake className="h-4 w-4" />}
          formatter={fmtCompact}
          caption={`Tỷ lệ ${fmtPercent(tyLeKhoanh)} tổng dư nợ`}
          infoKey="duNoKhoanh"
        />
        <KpiCard
          label="Số khế ước khoanh"
          value={khoanhLoansCount}
          tone="frozen"
          icon={<FileWarning className="h-4 w-4" />}
          caption={`${fmtPercent(filtered.length > 0 ? (khoanhLoansCount / filtered.length) * 100 : 0)} số khế ước`}
        />
        <KpiCard
          label="Khách hàng có nợ khoanh"
          value={khoanhKhCount}
          tone="teal"
          icon={<Users className="h-4 w-4" />}
          caption={
            khMultipleKhoanh > 0
              ? `${fmtNumber(khMultipleKhoanh)} KH có ≥ 2 khế ước khoanh`
              : 'Duy nhất theo mã KH'
          }
        />
        <KpiCard
          label="Số khế ước hết hạn khoanh trong năm"
          value={expiringThisYearCount}
          tone={expiringThisYearCount > 0 ? 'alert' : 'frozen'}
          icon={<CalendarClock className="h-4 w-4" />}
          caption={
            ngaySoLieu
              ? `Hết hạn khoanh trong năm ${ngaySoLieu.getFullYear()}`
              : 'Theo Ngày hết hạn khoanh'
          }
        />
      </div>

      {/* Dư nợ khoanh theo nhóm — chuyển đổi giữa ĐVUT / Xã / Chương trình */}
      {(() => {
        const dimMap = {
          dvut: {
            data: byDVUT_K,
            field: 'tenDVUT' as FilterField,
            chartType: chartDvutType,
            setChartType: setChartDvutType,
            infoKey: 'chartKhoanhDvut' as const,
          },
          xa: {
            data: byXa_K,
            field: 'tenXa' as FilterField,
            chartType: chartXaType,
            setChartType: setChartXaType,
            infoKey: 'chartKhoanhXa' as const,
          },
          program: {
            data: byProgram_K,
            field: 'tenChuongTrinh' as FilterField,
            chartType: chartProgramType,
            setChartType: setChartProgramType,
            infoKey: 'chartKhoanhProgram' as const,
          },
        };
        const dim = dimMap[groupDimension];
        const dimOptions: { id: 'dvut' | 'xa' | 'program'; label: string }[] = [
          { id: 'dvut', label: 'Đơn vị ủy thác' },
          { id: 'xa', label: 'Xã' },
          { id: 'program', label: 'Chương trình tín dụng' },
        ];
        return (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CardTitle>Dư nợ khoanh theo</CardTitle>
                  <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-600 dark:bg-slate-700">
                    {dimOptions.map((opt) => {
                      const active = opt.id === groupDimension;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setGroupDimension(opt.id)}
                          className={cn(
                            'h-7 rounded px-3 text-xs font-medium transition-colors',
                            active
                              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-600 dark:text-slate-100'
                              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
                          )}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <ChartSwitcher
                    options={BAR_GROUP_OPTS}
                    value={dim.chartType}
                    onChange={dim.setChartType}
                  />
                  <InfoPopover metricKey={dim.infoKey} />
                </div>
              </div>
            </CardHeader>
            <CardContent id="chart-khoanh-group">
              {dim.data.length === 0 ? (
                <EmptyKhoanhNote />
              ) : (
                <BarByGroup
                  data={dim.data}
                  metric="duNoKhoanh"
                  tooltipLabel="Dư nợ khoanh"
                  limit={10}
                  chartType={dim.chartType}
                  onClick={(v) => drillTo(dim.field, v)}
                />
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Row 3: Hotspot — Tỷ lệ khoanh cao nhất theo Xã */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-amber-600" />
              <CardTitle>Tỷ lệ dư nợ khoanh theo Xã</CardTitle>
            </div>
            <InfoPopover metricKey="chartKhoanhHotspot" />
          </div>
        </CardHeader>
        <CardContent id="chart-khoanh-hotspot" className="p-0">
          {hotspots.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">
              Không có xã nào có dư nợ khoanh trong phạm vi lọc hiện tại.
            </div>
          ) : (
            <div className="scrollbar-thin max-h-[420px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                  <tr className="text-left text-slate-500 dark:text-slate-400">
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Xã/Phường</th>
                    <th className="px-3 py-2 text-right">Số khế ước</th>
                    <th className="px-3 py-2 text-right">Dư nợ</th>
                    <th className="px-3 py-2 text-right">Dư nợ khoanh</th>
                    <th className="px-3 py-2 text-right">Tỷ lệ khoanh</th>
                  </tr>
                </thead>
                <tbody>
                  {hotspots.map((g, i) => (
                    <tr
                      key={g.key}
                      onClick={() => drillTo('tenXa', g.key)}
                      className="cursor-pointer border-t border-slate-100 hover:bg-amber-50 dark:border-slate-700 dark:hover:bg-amber-900/20"
                    >
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{i + 1}</td>
                      <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">
                        {g.label || '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                        {fmtNumber(g.soKheUoc)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                        {fmtCurrency(g.tongDuNo)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-amber-700 dark:text-amber-300">
                        {fmtCurrency(g.duNoKhoanh)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          {fmtPercent(g.tyLeKhoanh)}
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

      {/* Lịch hết hạn khoanh — heatmap năm × tháng */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Lịch hết hạn khoanh</CardTitle>
            <div className="flex items-center gap-1">
              <ChartSwitcher options={HEAT_OPTS} value={heatType} onChange={setHeatType} />
              <InfoPopover metricKey="chartKhoanhExpiry" />
            </div>
          </div>
        </CardHeader>
        <CardContent id="chart-khoanh-expiry">
          <HeatmapMaturity
            data={khoanhExpiry}
            chartType={heatType}
            onClick={handleSelectKhoanhMonth}
            labels={{
              popoverHeader: 'Hết hạn khoanh theo tháng',
              popoverFooter:
                'Số khế ước có "Ngày hết hạn Khoanh" rơi vào tháng này, kèm tổng dư nợ khoanh.',
              emptyText: 'Không có khế ước có ngày hết hạn khoanh',
              caption:
                'Mỗi ô = số khế ước hết hạn khoanh trong tháng. Bấm vào ô rồi chọn "Xem danh sách khế ước" để lọc bảng Top 20 phía dưới theo tháng đó.',
              countLabel: 'Số khế ước',
              amountLabel: 'Dư nợ khoanh',
              amountTotalLabel: 'tổng dư nợ khoanh',
            }}
          />
        </CardContent>
      </Card>

      {/* Row 4: Top 20 khế ước khoanh lớn nhất (hoặc danh sách theo tháng) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>
                {khoanhExpiryMonth
                  ? `Khế ước hết hạn khoanh tháng ${khoanhExpiryMonth.split('-')[1]}/${khoanhExpiryMonth.split('-')[0]}`
                  : 'Top 20 khế ước khoanh lớn nhất'}
              </CardTitle>
              {khoanhExpiryMonth ? (
                <button
                  type="button"
                  onClick={() => setKhoanhExpiryMonth(null)}
                  className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200 transition-colors hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:ring-amber-800 dark:hover:bg-amber-900/60"
                  title="Bỏ lọc theo tháng — quay lại Top 20 tổng thể"
                >
                  {fmtNumber(topKhoanh.length)} khế ước · Xóa lọc ✕
                </button>
              ) : (
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  (Excel xuất đầy đủ {fmtNumber(khoanhLoans.length)} khế ước)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportKhoanh}
                disabled={exporting || khoanhLoans.length === 0}
                title={
                  khoanhLoans.length === 0
                    ? 'Không có khế ước khoanh để xuất'
                    : `Xuất ${khoanhLoans.length} khế ước khoanh ra Excel`
                }
                aria-label="Xuất danh sách khoanh ra Excel"
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors',
                  exporting || khoanhLoans.length === 0
                    ? 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                    : 'bg-amber-600 text-white hover:bg-amber-700'
                )}
              >
                <Download className={cn('h-3.5 w-3.5', exporting && 'animate-pulse')} />
                {exporting ? 'Đang xuất…' : 'Xuất Excel'}
              </button>
              <InfoPopover metricKey="chartKhoanhTop" />
            </div>
          </div>
        </CardHeader>
        <CardContent id="chart-khoanh-top" className="p-0">
          {topKhoanh.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">
              {khoanhExpiryMonth
                ? 'Không có khế ước hết hạn khoanh trong tháng này.'
                : 'Không có khế ước khoanh trong phạm vi lọc.'}
            </div>
          ) : (
            <div className="scrollbar-thin max-h-[820px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                  <tr className="text-left text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Khách hàng</th>
                    <th className="px-4 py-3">Xã · ĐVUT</th>
                    <th className="px-4 py-3">Tổ TK&VV</th>
                    <th className="px-4 py-3">Chương trình</th>
                    <th className="px-4 py-3 text-right">Mức vay</th>
                    <th className="px-4 py-3 text-right">Dư nợ khoanh</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right">Ngày hết hạn khoanh</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right">Ngày giao dịch gần nhất</th>
                  </tr>
                </thead>
                <tbody>
                  {topKhoanh.map((r, i) => (
                    <tr
                      key={r.soKheUoc || `${r.maKH}-${i}`}
                      onClick={() => setDetail(r)}
                      className="cursor-pointer border-t border-slate-100 hover:bg-amber-50 dark:border-slate-700 dark:hover:bg-amber-900/20"
                    >
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800 dark:text-slate-100">
                          {r.tenKH}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {r.soKheUoc}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        <div>{r.tenXa || '—'}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {r.tenDVUT || '—'}
                        </div>
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-slate-600 dark:text-slate-300" title={r.tenTo}>
                        {r.tenTo || '—'}
                      </td>
                      <td className="max-w-[260px] truncate px-4 py-3 text-slate-600 dark:text-slate-300">
                        {r.tenChuongTrinh}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                        {fmtCurrency(r.mucVay)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-amber-700 dark:text-amber-300">
                        {fmtCurrency(r.duNoKhoanh)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                        {r.ngayHetHanKhoanh ? fmtDate(r.ngayHetHanKhoanh) : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                        {r.ngayGiaoDichGanNhat ? fmtDate(r.ngayGiaoDichGanNhat) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <LoanDetailDrawer record={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function EmptyKhoanhNote() {
  return (
    <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">
      Không có dư nợ khoanh trong phạm vi lọc hiện tại.
    </div>
  );
}
