import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Snowflake,
  Users,
  Coins,
  Percent,
  AlignLeft,
  LayoutGrid,
  PieChart,
  FileWarning,
  Download,
} from 'lucide-react';
import { applyFilters, useDataStore, type FilterField } from '@/store/useDataStore';
import { computeKpi, groupBy, type GroupAgg } from '@/lib/metrics';
import { fmtCompact, fmtCurrency, fmtNumber, fmtPercent } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';
import { InfoPopover } from '@/components/ui/InfoPopover';
import { ExportMenu } from '@/components/export/ExportMenu';
import { exportBadDebtToXlsx } from '@/lib/export-xlsx';
import { cn } from '@/lib/utils';
import { FilterBar } from '@/components/filters/FilterBar';
import { BarByGroup, type BarGroupChartType } from '@/components/charts/BarByGroup';
import { ChartSwitcher, type ChartTypeOption } from '@/components/ui/ChartSwitcher';
import { LoanDetailDrawer } from '@/components/detail/LoanDetailDrawer';
import type { LoanRecord } from '@/lib/types';

const BAR_GROUP_OPTS: ChartTypeOption<BarGroupChartType>[] = [
  { id: 'bar', icon: AlignLeft, tooltip: 'Biểu đồ thanh' },
  { id: 'treemap', icon: LayoutGrid, tooltip: 'Bản đồ cây' },
  { id: 'pie', icon: PieChart, tooltip: 'Biểu đồ tròn' },
];

/**
 * Trang "Báo cáo Dư nợ khoanh" — phân tích riêng phần dư nợ đang được
 * khoanh (tạm dừng tính lãi, chờ xử lý). Cùng cấp với Tổng quan và NPL
 * trong menu trái. Tất cả thống kê dùng bộ lọc hiện hành trên FilterBar.
 */
export function KhoanhPage() {
  const { rows, filters, ranges, search, ngaySoLieu, drillDown } = useDataStore();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<LoanRecord | null>(null);
  const [chartDvutType, setChartDvutType] = useState<BarGroupChartType>('pie');
  const [chartXaType, setChartXaType] = useState<BarGroupChartType>('bar');
  const [chartProgramType, setChartProgramType] = useState<BarGroupChartType>('bar');
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

  const kpi = useMemo(() => computeKpi(filtered), [filtered]);

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

  // Mức khoanh bình quân
  const mucKhoanhBQ =
    khoanhLoansCount > 0 ? kpi.duNoKhoanh / khoanhLoansCount : 0;

  // Tỷ lệ khoanh trên tổng dư nợ
  const tyLeKhoanh = kpi.tongDuNo > 0 ? (kpi.duNoKhoanh / kpi.tongDuNo) * 100 : 0;

  // Tổng lãi DT chưa đến hạn (các khế ước khoanh thường vẫn có cấu phần lãi
  // dự thu — theo dõi để ước lượng tổn thất tiềm ẩn).
  const tongLaiDT = useMemo(
    () => khoanhLoans.reduce((s, r) => s + (r.laiDTChuaDenHan || 0), 0),
    [khoanhLoans]
  );

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

  // Top 20 khế ước có dư nợ khoanh lớn nhất
  const topKhoanh = useMemo(
    () => [...khoanhLoans].sort((a, b) => b.duNoKhoanh - a.duNoKhoanh).slice(0, 20),
    [khoanhLoans]
  );

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
              '#chart-khoanh-dvut',
              '#chart-khoanh-xa',
              '#chart-khoanh-program',
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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Dư nợ khoanh"
          value={kpi.duNoKhoanh}
          tone="warning"
          icon={<Snowflake className="h-4 w-4" />}
          formatter={fmtCompact}
          caption={`Tỷ lệ ${fmtPercent(tyLeKhoanh)} tổng dư nợ`}
          infoKey="duNoKhoanh"
        />
        <KpiCard
          label="Số khế ước khoanh"
          value={khoanhLoansCount}
          tone="warning"
          icon={<FileWarning className="h-4 w-4" />}
          caption={`${fmtPercent(filtered.length > 0 ? (khoanhLoansCount / filtered.length) * 100 : 0)} số khế ước`}
        />
        <KpiCard
          label="Khách hàng có nợ khoanh"
          value={khoanhKhCount}
          tone="warning"
          icon={<Users className="h-4 w-4" />}
          caption={
            khMultipleKhoanh > 0
              ? `${fmtNumber(khMultipleKhoanh)} KH có ≥ 2 khế ước khoanh`
              : 'Duy nhất theo mã KH'
          }
        />
        <KpiCard
          label="Mức khoanh bình quân/khế ước"
          value={mucKhoanhBQ}
          tone="default"
          icon={<Coins className="h-4 w-4" />}
          formatter={fmtCompact}
          caption="Dư nợ khoanh / số KƯ khoanh"
        />
        <KpiCard
          label="Lãi DT chưa đến hạn (khoanh)"
          value={tongLaiDT}
          tone="default"
          icon={<Coins className="h-4 w-4" />}
          formatter={fmtCompact}
          caption="Tổng lãi dự thu trên các KƯ khoanh"
          infoKey="laiDtKhoanh"
        />
        <KpiCard
          label="Tỷ lệ khoanh / Tổng NPL"
          value={
            kpi.duNoQuaHan + kpi.duNoKhoanh > 0
              ? (kpi.duNoKhoanh / (kpi.duNoQuaHan + kpi.duNoKhoanh)) * 100
              : 0
          }
          tone="default"
          icon={<Percent className="h-4 w-4" />}
          formatter={(v) => fmtPercent(v)}
          caption="Khoanh chiếm bao nhiêu % NPL"
        />
      </div>

      {/* Row 1: theo ĐVUT + Xã */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Dư nợ khoanh theo Đơn vị ủy thác</CardTitle>
              <div className="flex items-center gap-1">
                <ChartSwitcher
                  options={BAR_GROUP_OPTS}
                  value={chartDvutType}
                  onChange={setChartDvutType}
                />
                <InfoPopover metricKey="chartKhoanhDvut" />
              </div>
            </div>
          </CardHeader>
          <CardContent id="chart-khoanh-dvut">
            {byDVUT_K.length === 0 ? (
              <EmptyKhoanhNote />
            ) : (
              <BarByGroup
                data={byDVUT_K}
                metric="duNoKhoanh"
                tooltipLabel="Dư nợ khoanh"
                limit={10}
                chartType={chartDvutType}
                onClick={(v) => drillTo('tenDVUT', v)}
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Dư nợ khoanh theo Xã</CardTitle>
              <div className="flex items-center gap-1">
                <ChartSwitcher
                  options={BAR_GROUP_OPTS}
                  value={chartXaType}
                  onChange={setChartXaType}
                />
                <InfoPopover metricKey="chartKhoanhXa" />
              </div>
            </div>
          </CardHeader>
          <CardContent id="chart-khoanh-xa">
            {byXa_K.length === 0 ? (
              <EmptyKhoanhNote />
            ) : (
              <BarByGroup
                data={byXa_K}
                metric="duNoKhoanh"
                tooltipLabel="Dư nợ khoanh"
                limit={10}
                chartType={chartXaType}
                onClick={(v) => drillTo('tenXa', v)}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: theo Chương trình tín dụng */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Dư nợ khoanh theo Chương trình tín dụng</CardTitle>
            <div className="flex items-center gap-1">
              <ChartSwitcher
                options={BAR_GROUP_OPTS}
                value={chartProgramType}
                onChange={setChartProgramType}
              />
              <InfoPopover metricKey="chartKhoanhProgram" />
            </div>
          </div>
        </CardHeader>
        <CardContent id="chart-khoanh-program">
          {byProgram_K.length === 0 ? (
            <EmptyKhoanhNote />
          ) : (
            <BarByGroup
              data={byProgram_K}
              metric="duNoKhoanh"
              tooltipLabel="Dư nợ khoanh"
              limit={10}
              chartType={chartProgramType}
              onClick={(v) => drillTo('tenChuongTrinh', v)}
            />
          )}
        </CardContent>
      </Card>

      {/* Row 3: Hotspot — Tỷ lệ khoanh cao nhất theo Xã */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-amber-600" />
              <CardTitle>Điểm nóng khoanh — Tỷ lệ dư nợ khoanh theo Xã (Top 15)</CardTitle>
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

      {/* Row 4: Top 20 khế ước khoanh lớn nhất */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CardTitle>Top 20 khế ước khoanh lớn nhất</CardTitle>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                (Excel xuất đầy đủ {fmtNumber(khoanhLoans.length)} khế ước)
              </span>
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
              Không có khế ước khoanh trong phạm vi lọc.
            </div>
          ) : (
            <div className="scrollbar-thin max-h-[520px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                  <tr className="text-left text-slate-500 dark:text-slate-400">
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Khách hàng</th>
                    <th className="px-3 py-2">Xã · ĐVUT</th>
                    <th className="px-3 py-2">Tổ TK&VV</th>
                    <th className="px-3 py-2">Chương trình</th>
                    <th className="px-3 py-2 text-right">Mức vay</th>
                    <th className="px-3 py-2 text-right">Dư nợ khoanh</th>
                    <th className="px-3 py-2 text-right">Dư nợ QH</th>
                    <th className="px-3 py-2 text-right">Lãi DT chưa đến hạn</th>
                  </tr>
                </thead>
                <tbody>
                  {topKhoanh.map((r, i) => (
                    <tr
                      key={r.soKheUoc || `${r.maKH}-${i}`}
                      onClick={() => setDetail(r)}
                      className="cursor-pointer border-t border-slate-100 hover:bg-amber-50 dark:border-slate-700 dark:hover:bg-amber-900/20"
                    >
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{i + 1}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-800 dark:text-slate-100">
                          {r.tenKH}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {r.soKheUoc}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                        <div>{r.tenXa || '—'}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {r.tenDVUT || '—'}
                        </div>
                      </td>
                      <td className="max-w-[160px] truncate px-3 py-2 text-slate-600 dark:text-slate-300" title={r.tenTo}>
                        {r.tenTo || '—'}
                      </td>
                      <td className="max-w-[200px] truncate px-3 py-2 text-slate-600 dark:text-slate-300">
                        {r.tenChuongTrinh}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                        {fmtCurrency(r.mucVay)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-amber-700 dark:text-amber-300">
                        {fmtCurrency(r.duNoKhoanh)}
                      </td>
                      <td className="px-3 py-2 text-right text-rose-700 dark:text-rose-300">
                        {fmtCurrency(r.duNoQuaHan)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                        {fmtCurrency(r.laiDTChuaDenHan)}
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
